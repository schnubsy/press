-- press_access — FIX: revoke EXECUTE from PUBLIC on the security-definer helpers.
-- Applied by Cowork 2026-09-21 as migration `press_access_revoke_public_execute`.
--
-- WHY. 20260921_press_access.sql ended with
--     revoke all on function public.press_access_before_user_created(jsonb) from anon, authenticated;
-- That is not enough. Postgres grants EXECUTE to **PUBLIC** by default on every function, and both
-- anon and authenticated inherit PUBLIC — so revoking the roles individually leaves the function
-- callable. The post-apply advisor caught it:
--     anon_security_definer_function_executable (WARN) x4
--
-- IMPACT. press_access_before_user_created() is SECURITY DEFINER, takes arbitrary jsonb, and
-- returns `{}` for an address on the family list but a 403 error object for one that is not. Reachable
-- anonymously at /rest/v1/rpc/press_access_before_user_created, that is an ENUMERATION ORACLE: anyone
-- with the publishable key could test whether a given email is on the family list, one address at a
-- time. The other three helpers were also PUBLIC-callable but return false / no-op for anon
-- (auth.jwt() is null), so they leaked nothing — revoked anyway on principle.
--
-- LESSON (docs/lessons.md): RULE: revoking EXECUTE from `anon, authenticated` never removes the
-- default PUBLIC grant. Always `revoke execute ... from public` first, then grant back explicitly.
-- Applies to every security-definer helper in the press project.

revoke execute on function public.press_access_before_user_created(jsonb) from public, anon, authenticated;
revoke execute on function public.press_access_is_admin()   from public, anon;
revoke execute on function public.press_access_has(text)    from public, anon;
revoke execute on function public.press_access_touch()      from public, anon;
revoke execute on function remit_private.remit_has_access() from public, anon;

-- GoTrue invokes the hook as supabase_auth_admin — it must keep EXECUTE.
grant execute on function public.press_access_before_user_created(jsonb) to supabase_auth_admin;

-- Signed-in callers still need these (the RLS policies and the gate call them).
grant execute on function public.press_access_is_admin()   to authenticated;
grant execute on function public.press_access_has(text)    to authenticated;
grant execute on function public.press_access_touch()      to authenticated;
grant execute on function remit_private.remit_has_access() to authenticated;
