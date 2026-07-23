-- Keep trigger-only and compatibility SECURITY DEFINER functions out of the
-- public Data API. The auth trigger continues to execute as the function
-- owner; browser callers do not need direct EXECUTE privileges.

begin;

revoke all on function public.handle_new_user()
  from public, anon, authenticated;
grant execute on function public.handle_new_user()
  to service_role;

-- Hardened policies use the private, caller-bound helper instead. Retain this
-- legacy signature for server-side compatibility without exposing it as RPC.
revoke all on function public.is_community_member(text, uuid)
  from public, anon, authenticated;
grant execute on function public.is_community_member(text, uuid)
  to service_role;

commit;
