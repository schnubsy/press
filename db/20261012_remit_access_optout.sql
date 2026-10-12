-- =============================================================================
-- remit_access_optout — remit's RLS helper follows the Family Wing OPT-OUT model
-- (arc/marquee-wings-monitor slice 2). Applied via the Supabase MCP as migration
-- `remit_access_optout`; this file MIRRORS it byte-for-byte.
--
-- WHY. 20260924_press_access_optout.sql moved press_access_has() to opt-out (active person + gated app +
-- no active=false grant), and perth/optimo enforce through it. remit's tables use
-- remit_private.remit_has_access(), which still required an ACTIVE grant row (opt-IN) — so a person
-- added in the Access Manager with every switch ON could not read remit until a grant row was hand-made.
-- Now it delegates to press_access_has('remit.html'): ONE decision for every family-wing app.
-- Signature, language, volatility, SECURITY DEFINER and the empty search_path are unchanged.
-- =============================================================================

create or replace function remit_private.remit_has_access() returns boolean
  language sql stable security definer set search_path = '' as $$
  select public.press_access_has('remit.html');
$$;

-- re-assert the lessons.md rule: EXECUTE off PUBLIC/anon, granted back explicitly.
revoke execute on function remit_private.remit_has_access() from public, anon;
grant  execute on function remit_private.remit_has_access() to authenticated;
