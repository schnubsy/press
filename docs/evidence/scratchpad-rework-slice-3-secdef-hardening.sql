-- ============================================================================
-- press — SECURITY DEFINER execute-grant hardening (arc/scratchpad-rework slice 3)
-- AUTHORED 2026-09-22 by Code. NOT APPLIED — Cowork's Supabase connector applies DDL.
-- Code's Supabase MCP is read-only for DDL (CLAUDE.md). Apply on Mark's go, then read the
-- post-apply advisor.
--
-- WHY THIS EXISTS
--   Postgres grants EXECUTE to PUBLIC by DEFAULT on every new function. `revoke execute … from
--   anon, authenticated` does NOT remove that PUBLIC grant — the classic latent bug that once left
--   press_access_before_user_created() an anonymous email-enumeration oracle
--   (press/docs/lessons.md: "revoking a role never removes Postgres's default PUBLIC EXECUTE grant").
--
-- AUDIT FINDING (2026-09-22, read-only over pg_proc/pg_namespace on eepjhpyziczrxvirczio)
--   Every SECURITY DEFINER function in the project is ALREADY clean — none is PUBLIC-executable.
--   See scratchpad-rework-slice-3-public-execute-sweep.md for each function's live ACL.
--   This migration is therefore DEFENSIVE, not a fix of a live hole: it re-asserts the correct,
--   least-privilege grants so that a future `drop + create` (which resets the ACL to default PUBLIC)
--   cannot silently re-open any of them. It is idempotent — safe to apply now and to re-run.
--
-- The pattern, for EVERY security-definer helper: revoke from PUBLIC (and anon) FIRST, then grant
-- back only the roles that must call it.
-- ============================================================================

begin;

-- 1. press_access_before_user_created(event jsonb) — the Auth Before-User-Created hook.
--    Callable ONLY by the auth admin (GoTrue) and service_role. Never anon/authenticated/PUBLIC.
revoke execute on function public.press_access_before_user_created(event jsonb) from public;
revoke execute on function public.press_access_before_user_created(event jsonb) from anon, authenticated;
grant  execute on function public.press_access_before_user_created(event jsonb) to supabase_auth_admin, service_role;

-- 2. press_access_has(page text) — the per-page grant check used by the gate + RLS. authenticated only.
revoke execute on function public.press_access_has(page text) from public;
revoke execute on function public.press_access_has(page text) from anon;
grant  execute on function public.press_access_has(page text) to authenticated, service_role;

-- 3. press_access_is_admin() — admin check behind access.html RLS + the passkey overlay. authenticated only.
revoke execute on function public.press_access_is_admin() from public;
revoke execute on function public.press_access_is_admin() from anon;
grant  execute on function public.press_access_is_admin() to authenticated, service_role;

-- 4. press_access_touch() — fire-and-forget last_seen_at stamp. authenticated only.
revoke execute on function public.press_access_touch() from public;
revoke execute on function public.press_access_touch() from anon;
grant  execute on function public.press_access_touch() to authenticated, service_role;

-- 5. remit_private.remit_has_access() — the remit RLS policy helper. authenticated only; never anon.
revoke execute on function remit_private.remit_has_access() from public;
revoke execute on function remit_private.remit_has_access() from anon;
grant  execute on function remit_private.remit_has_access() to authenticated;

commit;

-- POST-APPLY CHECK (read-only): every row must report public_can_execute = false.
--   select n.nspname, p.proname,
--          (p.proacl is null or exists (select 1 from unnest(p.proacl) a
--             where split_part(a::text,'=',1) = '')) as public_can_execute
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where p.prosecdef and n.nspname in ('public','remit_private')
--     and p.proname like any (array['press_access_%','remit_has_access']);
