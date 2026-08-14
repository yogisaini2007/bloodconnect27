
-- ============ ROLES / ADMIN ============
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- admin = role row OR the single official BloodConnect email (verified)
CREATE OR REPLACE FUNCTION public.is_app_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND lower(u.email) = 'connectblood27@gmail.com'
        AND u.email_confirmed_at IS NOT NULL
    )
  );
$$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_app_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_app_admin(uuid) TO authenticated, service_role;

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()));

-- ============ MODERATION STATE ON PROFILES ============
ALTER TABLE public.profiles
  ADD COLUMN is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN banned_at timestamptz,
  ADD COLUMN ban_reason text,
  ADD COLUMN restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN valid_report_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION private.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT p.is_banned FROM public.profiles p WHERE p.id = _user_id), false);
$$;
REVOKE ALL ON FUNCTION private.is_banned(uuid) FROM PUBLIC, anon, authenticated;

-- ============ REPORTS ============
CREATE TYPE public.report_reason AS ENUM (
  'fake_info','fraud_scam','harassment','spam','illegal_blood',
  'impersonation','platform_manipulation','harmful_content','other'
);
CREATE TYPE public.report_status AS ENUM ('pending','valid','invalid');

CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  reason public.report_reason NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_report CHECK (reporter_id <> reported_user_id),
  UNIQUE (reporter_id, reported_user_id)
);
GRANT SELECT, INSERT ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report insert by signed-in non-banned user" ON public.user_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND NOT private.is_banned(auth.uid()));
CREATE POLICY "reports readable by reporter or admin" ON public.user_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_app_admin(auth.uid()));

CREATE TRIGGER user_reports_updated BEFORE UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- auto validation + escalation
CREATE OR REPLACE FUNCTION public.moderate_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_valid integer; v_severe boolean;
BEGIN
  v_severe := NEW.reason IN ('fraud_scam','illegal_blood','impersonation','harmful_content','fake_info');
  IF TG_OP = 'INSERT' AND v_severe THEN
    NEW.status := 'valid';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER user_reports_autovalidate BEFORE INSERT ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.moderate_on_report();

CREATE OR REPLACE FUNCTION public.apply_moderation_outcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_valid integer; v_reason text;
BEGIN
  SELECT count(DISTINCT reporter_id) INTO v_valid
  FROM public.user_reports WHERE reported_user_id = NEW.reported_user_id AND status = 'valid';

  SELECT string_agg(DISTINCT reason::text, ', ') INTO v_reason
  FROM public.user_reports WHERE reported_user_id = NEW.reported_user_id AND status = 'valid';

  UPDATE public.profiles p SET
    valid_report_count = v_valid,
    restricted = (v_valid BETWEEN 3 AND 4) OR p.is_banned,
    is_banned = p.is_banned OR v_valid >= 5,
    banned_at = CASE WHEN NOT p.is_banned AND v_valid >= 5 THEN now() ELSE p.banned_at END,
    ban_reason = CASE WHEN NOT p.is_banned AND v_valid >= 5
                      THEN 'Automatic ban after ' || v_valid || ' valid reports (' || COALESCE(v_reason,'policy violations') || ')'
                      ELSE p.ban_reason END
  WHERE p.id = NEW.reported_user_id;

  IF v_valid >= 5 THEN
    UPDATE public.blood_requests SET status = 'cancelled'
    WHERE requester_id = NEW.reported_user_id AND status = 'active';
    INSERT INTO public.notifications (user_id, type, title, body)
    VALUES (NEW.reported_user_id, 'account_banned', 'Your account has been banned',
            'Your BloodConnect account was banned for policy violations. Contact support to appeal.');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER user_reports_outcome AFTER INSERT OR UPDATE OF status ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.apply_moderation_outcome();

-- ============ SUPPORT / HELP CENTER ============
CREATE TYPE public.ticket_status AS ENUM ('open','in_progress','resolved','closed');

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  subject text NOT NULL,
  message text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  status public.ticket_status NOT NULL DEFAULT 'open',
  admin_reply text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own ticket insert" ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "ticket read by owner or admin" ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_app_admin(auth.uid()));

CREATE TRIGGER support_tickets_updated BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BAN ENFORCEMENT ON EXISTING POLICIES ============
DROP POLICY IF EXISTS "own request insert" ON public.blood_requests;
CREATE POLICY "own request insert" ON public.blood_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND NOT private.is_banned(auth.uid()));

DROP POLICY IF EXISTS "donor inserts own response" ON public.request_responses;
CREATE POLICY "donor inserts own response" ON public.request_responses FOR INSERT TO authenticated
  WITH CHECK (donor_id = auth.uid() AND NOT private.is_banned(auth.uid()));

DROP POLICY IF EXISTS "messages insert by matched participants" ON public.messages;
CREATE POLICY "messages insert by matched participants" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND NOT private.is_banned(auth.uid())
              AND private.can_message(request_id, auth.uid(), recipient_id));

-- ============ ADMIN READ / ACTION FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'new_users_7d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '7 days'),
    'new_users_30d', (SELECT count(*) FROM public.profiles WHERE created_at > now() - interval '30 days'),
    'available_donors', (SELECT count(*) FROM public.profiles WHERE is_available AND NOT is_banned),
    'banned_users', (SELECT count(*) FROM public.profiles WHERE is_banned),
    'restricted_users', (SELECT count(*) FROM public.profiles WHERE restricted AND NOT is_banned),
    'total_requests', (SELECT count(*) FROM public.blood_requests),
    'active_requests', (SELECT count(*) FROM public.blood_requests WHERE status = 'active'),
    'accepted_responses', (SELECT count(*) FROM public.request_responses WHERE status = 'accepted'),
    'pending_reports', (SELECT count(*) FROM public.user_reports WHERE status = 'pending'),
    'open_tickets', (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','in_progress')),
    'by_blood_group', (SELECT COALESCE(jsonb_object_agg(bg, c), '{}'::jsonb) FROM (
        SELECT COALESCE(blood_group::text,'unknown') AS bg, count(*) AS c FROM public.profiles GROUP BY 1) t),
    'signups_by_day', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', d, 'count', c) ORDER BY d), '[]'::jsonb) FROM (
        SELECT date_trunc('day', created_at)::date AS d, count(*) AS c
        FROM public.profiles WHERE created_at > now() - interval '30 days' GROUP BY 1) s)
  ) INTO result;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_users(p_search text DEFAULT '')
RETURNS TABLE(id uuid, full_name text, email text, phone text,
              blood_group public.blood_group, current_address text, is_available boolean,
              is_banned boolean, restricted boolean, valid_report_count integer,
              last_donation_date date, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT p.id, p.full_name, u.email::text, p.phone, p.blood_group, p.current_address,
         p.is_available, p.is_banned, p.restricted, p.valid_report_count,
         p.last_donation_date, p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE COALESCE(p_search,'') = ''
     OR p.full_name ILIKE '%'||p_search||'%'
     OR p.phone ILIKE '%'||p_search||'%'
     OR u.email ILIKE '%'||p_search||'%'
  ORDER BY p.created_at DESC
  LIMIT 500;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_reports()
RETURNS TABLE(id uuid, reporter_id uuid, reporter_name text, reported_user_id uuid,
              reported_name text, reported_banned boolean, reason public.report_reason,
              details text, status public.report_status, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT r.id, r.reporter_id, rp.full_name, r.reported_user_id, tp.full_name, tp.is_banned,
         r.reason, r.details, r.status, r.created_at
  FROM public.user_reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  LEFT JOIN public.profiles tp ON tp.id = r.reported_user_id
  ORDER BY (r.status = 'pending') DESC, r.created_at DESC
  LIMIT 300;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_report(p_report_id uuid, p_status public.report_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.user_reports
  SET status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_report_id;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(p_user_id uuid, p_banned boolean, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.profiles SET
    is_banned = p_banned,
    banned_at = CASE WHEN p_banned THEN now() ELSE NULL END,
    ban_reason = CASE WHEN p_banned THEN COALESCE(p_reason,'Violation of BloodConnect safety policy') ELSE NULL END,
    restricted = CASE WHEN p_banned THEN true ELSE false END
  WHERE id = p_user_id;
  IF p_banned THEN
    UPDATE public.blood_requests SET status = 'cancelled'
    WHERE requester_id = p_user_id AND status = 'active';
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_tickets()
RETURNS TABLE(id uuid, user_id uuid, user_name text, contact_email text, category text,
              subject text, message text, status public.ticket_status, admin_reply text,
              created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY
  SELECT t.id, t.user_id, p.full_name, t.contact_email, t.category, t.subject, t.message,
         t.status, t.admin_reply, t.created_at
  FROM public.support_tickets t
  LEFT JOIN public.profiles p ON p.id = t.user_id
  ORDER BY (t.status IN ('open','in_progress')) DESC, t.created_at DESC
  LIMIT 300;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_ticket(p_ticket_id uuid, p_status public.ticket_status, p_reply text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_app_admin(auth.uid()) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  UPDATE public.support_tickets
  SET status = p_status, admin_reply = COALESCE(p_reply, admin_reply)
  WHERE id = p_ticket_id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_stats() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_users(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_reports() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_review_report(uuid, public.report_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_ban(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_tickets() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_ticket(uuid, public.ticket_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_report(uuid, public.report_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tickets() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_ticket(uuid, public.ticket_status, text) TO authenticated;
