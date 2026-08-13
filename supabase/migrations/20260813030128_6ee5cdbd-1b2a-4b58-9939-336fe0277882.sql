
CREATE OR REPLACE FUNCTION public.has_responded(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.request_responses rr
    WHERE rr.request_id = p_request_id AND rr.donor_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.has_responded(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_responded(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "requests readable by signed in" ON public.blood_requests;

CREATE POLICY "requests visible to participants and matched donors"
ON public.blood_requests
FOR SELECT
TO authenticated
USING (
  requester_id = auth.uid()
  OR public.has_responded(id)
  OR (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND (me.blood_group IS NULL OR public.can_donate_to(me.blood_group, blood_requests.blood_group))
        AND (
          me.lat IS NULL OR blood_requests.lat IS NULL
          OR public.distance_km(me.lat, me.lng, blood_requests.lat, blood_requests.lng) <= blood_requests.radius_km
        )
    )
  )
);

CREATE OR REPLACE FUNCTION public.chat_threads()
RETURNS TABLE(request_id uuid, peer_id uuid, peer_name text, peer_phone text, hospital_name text, blood_group blood_group, status request_status, last_message text, last_message_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
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
END;
$fn$;

REVOKE ALL ON FUNCTION public.chat_threads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.chat_threads() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.find_donors(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_donors(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.nearby_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_requests() TO authenticated, service_role;
