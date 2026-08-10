-- ENUMS
CREATE TYPE public.blood_group AS ENUM ('A+','A-','B+','B-','O+','O-','AB+','AB-');
CREATE TYPE public.urgency_level AS ENUM ('critical','urgent','normal');
CREATE TYPE public.request_status AS ENUM ('active','fulfilled','cancelled','expired');
CREATE TYPE public.response_status AS ENUM ('accepted','declined');

-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  blood_group public.blood_group,
  permanent_address text NOT NULL DEFAULT '',
  current_address text NOT NULL DEFAULT '',
  last_donation_date date,
  is_available boolean NOT NULL DEFAULT true,
  lat double precision,
  lng double precision,
  location_updated_at timestamptz,
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- REQUESTS
CREATE TABLE public.blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name text NOT NULL DEFAULT '',
  blood_group public.blood_group NOT NULL,
  units integer NOT NULL DEFAULT 1,
  urgency public.urgency_level NOT NULL DEFAULT 'urgent',
  hospital_name text NOT NULL,
  hospital_address text NOT NULL DEFAULT '',
  hospital_phone text,
  lat double precision,
  lng double precision,
  required_by timestamptz,
  note text,
  radius_km integer NOT NULL DEFAULT 10,
  status public.request_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_requests TO authenticated;
GRANT ALL ON public.blood_requests TO service_role;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "requests readable by signed in" ON public.blood_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "own request insert" ON public.blood_requests FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "own request update" ON public.blood_requests FOR UPDATE TO authenticated USING (requester_id = auth.uid()) WITH CHECK (requester_id = auth.uid());
CREATE POLICY "own request delete" ON public.blood_requests FOR DELETE TO authenticated USING (requester_id = auth.uid());
CREATE INDEX blood_requests_status_idx ON public.blood_requests(status, created_at DESC);

-- RESPONSES
CREATE TABLE public.request_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.response_status NOT NULL,
  eta_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.request_responses TO authenticated;
GRANT ALL ON public.request_responses TO service_role;
ALTER TABLE public.request_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "response read by participants" ON public.request_responses FOR SELECT TO authenticated
  USING (donor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.blood_requests r WHERE r.id = request_id AND r.requester_id = auth.uid()));
CREATE POLICY "donor inserts own response" ON public.request_responses FOR INSERT TO authenticated WITH CHECK (donor_id = auth.uid());
CREATE POLICY "donor updates own response" ON public.request_responses FOR UPDATE TO authenticated USING (donor_id = auth.uid()) WITH CHECK (donor_id = auth.uid());

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages read by participants" ON public.messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "messages insert by sender" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE INDEX messages_thread_idx ON public.messages(request_id, created_at);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications read" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);

-- HELPERS
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER requests_updated BEFORE UPDATE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER responses_updated BEFORE UPDATE ON public.request_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.distance_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN lat1 IS NULL OR lng1 IS NULL OR lat2 IS NULL OR lng2 IS NULL THEN NULL
  ELSE 6371 * acos(least(1, greatest(-1,
    cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
    + sin(radians(lat1)) * sin(radians(lat2))))) END;
$$;

CREATE OR REPLACE FUNCTION public.can_donate_to(donor public.blood_group, recipient public.blood_group)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE recipient
    WHEN 'AB+' THEN true
    WHEN 'AB-' THEN donor IN ('AB-','A-','B-','O-')
    WHEN 'A+'  THEN donor IN ('A+','A-','O+','O-')
    WHEN 'A-'  THEN donor IN ('A-','O-')
    WHEN 'B+'  THEN donor IN ('B+','B-','O+','O-')
    WHEN 'B-'  THEN donor IN ('B-','O-')
    WHEN 'O+'  THEN donor IN ('O+','O-')
    WHEN 'O-'  THEN donor IN ('O-')
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_eligible(last_donation date)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT last_donation IS NULL OR last_donation <= (CURRENT_DATE - INTERVAL '90 days');
$$;

-- Privacy-safe donor matching: returns masked identity + approximate distance only.
CREATE OR REPLACE FUNCTION public.find_donors(p_request_id uuid)
RETURNS TABLE (donor_id uuid, display_name text, blood_group public.blood_group, distance_km double precision, is_available boolean, has_responded boolean, response_status public.response_status, phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.blood_requests%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.blood_requests WHERE id = p_request_id;
  IF r.id IS NULL OR r.requester_id <> auth.uid() THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id,
         split_part(p.full_name, ' ', 1) || CASE WHEN position(' ' in p.full_name) > 0 THEN ' ' || left(split_part(p.full_name, ' ', 2), 1) || '.' ELSE '' END,
         p.blood_group,
         round(public.distance_km(r.lat, r.lng, p.lat, p.lng)::numeric, 1)::double precision,
         p.is_available,
         rr.id IS NOT NULL,
         rr.status,
         CASE WHEN rr.status = 'accepted' THEN p.phone ELSE NULL END
  FROM public.profiles p
  LEFT JOIN public.request_responses rr ON rr.request_id = r.id AND rr.donor_id = p.id
  WHERE p.id <> r.requester_id
    AND p.blood_group IS NOT NULL
    AND public.can_donate_to(p.blood_group, r.blood_group)
    AND public.is_eligible(p.last_donation_date)
    AND p.is_available
    AND (r.lat IS NULL OR p.lat IS NULL OR public.distance_km(r.lat, r.lng, p.lat, p.lng) <= r.radius_km)
  ORDER BY 4 NULLS LAST
  LIMIT 100;
END; $$;
GRANT EXECUTE ON FUNCTION public.find_donors(uuid) TO authenticated;

-- Nearby requests the signed-in user is eligible to answer
CREATE OR REPLACE FUNCTION public.nearby_requests()
RETURNS TABLE (id uuid, requester_id uuid, patient_name text, blood_group public.blood_group, units integer, urgency public.urgency_level, hospital_name text, hospital_address text, hospital_phone text, required_by timestamptz, note text, status public.request_status, created_at timestamptz, distance_km double precision, my_response public.response_status)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO me FROM public.profiles WHERE profiles.id = auth.uid();
  IF me.id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT r.id, r.requester_id, r.patient_name, r.blood_group, r.units, r.urgency, r.hospital_name, r.hospital_address, r.hospital_phone,
         r.required_by, r.note, r.status, r.created_at,
         round(public.distance_km(me.lat, me.lng, r.lat, r.lng)::numeric, 1)::double precision,
         rr.status
  FROM public.blood_requests r
  LEFT JOIN public.request_responses rr ON rr.request_id = r.id AND rr.donor_id = me.id
  WHERE r.status = 'active'
    AND r.requester_id <> me.id
    AND (me.blood_group IS NULL OR public.can_donate_to(me.blood_group, r.blood_group))
    AND (me.lat IS NULL OR r.lat IS NULL OR public.distance_km(me.lat, me.lng, r.lat, r.lng) <= r.radius_km)
  ORDER BY r.created_at DESC
  LIMIT 100;
END; $$;
GRANT EXECUTE ON FUNCTION public.nearby_requests() TO authenticated;

-- Notify eligible donors on new request
CREATE OR REPLACE FUNCTION public.notify_donors_on_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, request_id)
  SELECT p.id, 'new_request',
         NEW.blood_group::text || ' blood needed' || CASE WHEN NEW.urgency = 'critical' THEN ' — CRITICAL' ELSE '' END,
         NEW.units::text || ' unit(s) at ' || NEW.hospital_name,
         NEW.id
  FROM public.profiles p
  WHERE p.id <> NEW.requester_id
    AND p.blood_group IS NOT NULL
    AND public.can_donate_to(p.blood_group, NEW.blood_group)
    AND public.is_eligible(p.last_donation_date)
    AND p.is_available
    AND (NEW.lat IS NULL OR p.lat IS NULL OR public.distance_km(NEW.lat, NEW.lng, p.lat, p.lng) <= NEW.radius_km);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_request_created AFTER INSERT ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.notify_donors_on_request();

-- Notify requester on donor response
CREATE OR REPLACE FUNCTION public.notify_on_response() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.blood_requests%ROWTYPE; nm text;
BEGIN
  SELECT * INTO r FROM public.blood_requests WHERE id = NEW.request_id;
  SELECT full_name INTO nm FROM public.profiles WHERE id = NEW.donor_id;
  INSERT INTO public.notifications (user_id, type, title, body, request_id)
  VALUES (r.requester_id,
    CASE WHEN NEW.status = 'accepted' THEN 'response_accepted' ELSE 'response_declined' END,
    CASE WHEN NEW.status = 'accepted' THEN 'A donor accepted your request' ELSE 'A donor declined your request' END,
    coalesce(nullif(nm,''),'A donor') || COALESCE(' — ' || NEW.eta_note, ''), NEW.request_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_response_created AFTER INSERT ON public.request_responses FOR EACH ROW EXECUTE FUNCTION public.notify_on_response();

-- Notify on new message
CREATE OR REPLACE FUNCTION public.notify_on_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, request_id)
  VALUES (NEW.recipient_id, 'new_message', 'New message', left(NEW.body, 80), NEW.request_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_message_created AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Chat participant directory (privacy-safe): name + phone only for connected counterparties
CREATE OR REPLACE FUNCTION public.chat_threads()
RETURNS TABLE (request_id uuid, peer_id uuid, peer_name text, peer_phone text, hospital_name text, blood_group public.blood_group, status public.request_status, last_message text, last_message_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH pairs AS (
    SELECT rr.request_id, rr.donor_id AS donor, r.requester_id AS requester
    FROM public.request_responses rr
    JOIN public.blood_requests r ON r.id = rr.request_id
    WHERE rr.status = 'accepted' AND (rr.donor_id = auth.uid() OR r.requester_id = auth.uid())
  )
  SELECT pr.request_id,
         CASE WHEN pr.donor = auth.uid() THEN pr.requester ELSE pr.donor END,
         coalesce(nullif(p.full_name,''), 'BloodConnect user'),
         p.phone,
         r.hospital_name, r.blood_group, r.status,
         (SELECT m.body FROM public.messages m WHERE m.request_id = pr.request_id ORDER BY m.created_at DESC LIMIT 1),
         (SELECT m.created_at FROM public.messages m WHERE m.request_id = pr.request_id ORDER BY m.created_at DESC LIMIT 1)
  FROM pairs pr
  JOIN public.blood_requests r ON r.id = pr.request_id
  JOIN public.profiles p ON p.id = CASE WHEN pr.donor = auth.uid() THEN pr.requester ELSE pr.donor END
  ORDER BY 9 DESC NULLS LAST;
END; $$;
GRANT EXECUTE ON FUNCTION public.chat_threads() TO authenticated;

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;