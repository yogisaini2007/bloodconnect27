ALTER FUNCTION public.distance_km(double precision, double precision, double precision, double precision) SET search_path = public;
ALTER FUNCTION public.can_donate_to(public.blood_group, public.blood_group) SET search_path = public;
ALTER FUNCTION public.is_eligible(date) SET search_path = public;

REVOKE ALL ON FUNCTION public.find_donors(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.nearby_requests() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.chat_threads() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_donors(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.nearby_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.chat_threads() TO authenticated;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_donors_on_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_response() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;