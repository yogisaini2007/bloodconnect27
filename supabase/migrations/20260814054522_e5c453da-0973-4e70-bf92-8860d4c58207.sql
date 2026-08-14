
CREATE OR REPLACE FUNCTION public.chat_threads_for(p_user uuid)
RETURNS TABLE(request_id uuid, peer_id uuid, peer_name text, peer_phone text, hospital_name text, blood_group blood_group, status request_status, last_message text, last_message_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$ SELECT * FROM private.chat_threads(p_user); $function$;
REVOKE ALL ON FUNCTION public.chat_threads_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chat_threads_for(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.find_donors_for(p_request_id uuid, p_user uuid)
RETURNS TABLE(donor_id uuid, display_name text, blood_group blood_group, distance_km double precision, is_available boolean, has_responded boolean, response_status response_status, phone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$ SELECT * FROM private.find_donors(p_request_id, p_user); $function$;
REVOKE ALL ON FUNCTION public.find_donors_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_donors_for(uuid, uuid) TO service_role;
