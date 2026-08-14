
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 1. has_responded -> private (still needed inside RLS policies, but off the public API)
CREATE OR REPLACE FUNCTION private.has_responded(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.request_responses rr
    WHERE rr.request_id = p_request_id AND rr.donor_id = auth.uid()
  );
$function$;
REVOKE ALL ON FUNCTION private.has_responded(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_responded(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "requests visible to participants and matched donors" ON public.blood_requests;
CREATE POLICY "requests visible to participants and matched donors"
ON public.blood_requests FOR SELECT TO authenticated
USING (
  requester_id = auth.uid()
  OR private.has_responded(id)
  OR (status = 'active' AND EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND (me.blood_group IS NULL OR public.can_donate_to(me.blood_group, blood_requests.blood_group))
          AND (me.lat IS NULL OR blood_requests.lat IS NULL
               OR public.distance_km(me.lat, me.lng, blood_requests.lat, blood_requests.lng) <= blood_requests.radius_km::double precision)
      ))
);

DROP FUNCTION IF EXISTS public.has_responded(uuid);

-- 2. nearby_requests becomes SECURITY INVOKER (RLS on blood_requests already scopes rows)
CREATE OR REPLACE FUNCTION public.nearby_requests()
RETURNS TABLE(id uuid, requester_id uuid, patient_name text, blood_group blood_group, units integer, urgency urgency_level, hospital_name text, hospital_address text, hospital_phone text, required_by timestamp with time zone, note text, status request_status, created_at timestamp with time zone, distance_km double precision, my_response response_status)
LANGUAGE plpgsql
STABLE SECURITY INVOKER
SET search_path TO 'public'
AS $function$
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
END; $function$;
REVOKE ALL ON FUNCTION public.nearby_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_requests() TO authenticated, service_role;

-- 3. chat_threads / find_donors move to private, server-only, explicit user id
CREATE OR REPLACE FUNCTION private.chat_threads(p_user uuid)
RETURNS TABLE(request_id uuid, peer_id uuid, peer_name text, peer_phone text, hospital_name text, blood_group blood_group, status request_status, last_message text, last_message_at timestamp with time zone)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH pairs AS (
    SELECT rr.request_id, rr.donor_id AS donor, r.requester_id AS requester
    FROM public.request_responses rr
    JOIN public.blood_requests r ON r.id = rr.request_id
    WHERE rr.status = 'accepted' AND (rr.donor_id = p_user OR r.requester_id = p_user)
  )
  SELECT pr.request_id,
         CASE WHEN pr.donor = p_user THEN pr.requester ELSE pr.donor END,
         coalesce(nullif(p.full_name,''), 'BloodConnect user'),
         p.phone,
         r.hospital_name, r.blood_group, r.status,
         (SELECT m.body FROM public.messages m WHERE m.request_id = pr.request_id ORDER BY m.created_at DESC LIMIT 1),
         (SELECT m.created_at FROM public.messages m WHERE m.request_id = pr.request_id ORDER BY m.created_at DESC LIMIT 1)
  FROM pairs pr
  JOIN public.blood_requests r ON r.id = pr.request_id
  JOIN public.profiles p ON p.id = CASE WHEN pr.donor = p_user THEN pr.requester ELSE pr.donor END
  ORDER BY 9 DESC NULLS LAST;
END;
$function$;
REVOKE ALL ON FUNCTION private.chat_threads(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.chat_threads(uuid) TO service_role;

CREATE OR REPLACE FUNCTION private.find_donors(p_request_id uuid, p_user uuid)
RETURNS TABLE(donor_id uuid, display_name text, blood_group blood_group, distance_km double precision, is_available boolean, has_responded boolean, response_status response_status, phone text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r public.blood_requests%ROWTYPE;
BEGIN
  IF p_user IS NULL THEN RETURN; END IF;
  SELECT * INTO r FROM public.blood_requests WHERE id = p_request_id;
  IF r.id IS NULL OR r.requester_id <> p_user THEN RETURN; END IF;
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
END; $function$;
REVOKE ALL ON FUNCTION private.find_donors(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.find_donors(uuid, uuid) TO service_role;

DROP FUNCTION IF EXISTS public.chat_threads();
DROP FUNCTION IF EXISTS public.find_donors(uuid);

-- 4. messages may only be sent between an accepted donor and the requester of that request
CREATE OR REPLACE FUNCTION private.can_message(p_request_id uuid, p_sender uuid, p_recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_sender IS NOT NULL AND p_recipient IS NOT NULL AND p_sender <> p_recipient AND EXISTS (
    SELECT 1
    FROM public.request_responses rr
    JOIN public.blood_requests r ON r.id = rr.request_id
    WHERE rr.request_id = p_request_id
      AND rr.status = 'accepted'
      AND ((rr.donor_id = p_sender AND r.requester_id = p_recipient)
        OR (rr.donor_id = p_recipient AND r.requester_id = p_sender))
  );
$function$;
REVOKE ALL ON FUNCTION private.can_message(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.can_message(uuid, uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "messages insert by sender" ON public.messages;
CREATE POLICY "messages insert by matched participants"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND private.can_message(request_id, auth.uid(), recipient_id)
);
