-- =============================================================================
-- press_access — OPT-OUT grants (arc/wings-polish slice 4).
--
-- Applied by Cowork via the Supabase connector (Code's Supabase MCP is read-only
-- for DDL). This file MIRRORS what is applied; it is authored here and the arc
-- STOPS after authoring it, pending Cowork's apply.
--
-- WHAT CHANGES. The Family Wing moves from opt-IN to opt-OUT grants. Previously a
-- person could open a page ONLY if they held an active grant row; the admin page
-- kept a grant row per person per app. Now every ACTIVE person can open every gated
-- family app BY DEFAULT — including apps gated LATER — and a grant row exists only to
-- record a REVOCATION (active=false). This makes "add someone" a single people row
-- and "gate a new tool" instantly available to the whole family, with no per-person
-- grant fan-out.
--
-- The admin page (access.html) is rewritten to match: one card per person with a
-- switch per family tool (ON by default), plus Deactivate. Switch OFF upserts an
-- active=false grant (+ revoked_at); switch ON upserts active=true (clears it).
--
-- RLS and admin-only writes are UNCHANGED — only press_access_has() is redefined and
-- two app rows are ensured. The three tables, the is_admin/touch helpers, the auth
-- hook, and every policy from 20260921_press_access.sql stay exactly as they are.
-- =============================================================================

-- ── press_access_has(page): the opt-out decision ────────────────────────────
-- TRUE when ALL of:
--   • the caller's own JWT email is an ACTIVE person, AND
--   • `page` is a gated family app (press_access_apps.gated), AND
--   • there is NO grant row (caller, page) marked active=false (no opt-out on record).
-- No grant row at all ⇒ granted (the default). An active=false row ⇒ denied.
create or replace function public.press_access_has(page text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select
    exists (
      select 1 from public.press_access_people p
      where p.email = (select auth.jwt() ->> 'email') and p.active )
    and exists (
      select 1 from public.press_access_apps a
      where a.page = press_access_has.page and a.gated )
    and not exists (
      select 1 from public.press_access_grants g
      where g.page = press_access_has.page
        and g.email = (select auth.jwt() ->> 'email')
        and g.active = false );
$$;

-- ── the family apps must exist AND be gated in the DB half of the union ──────
-- press_access_has now keys "is this a family tool?" off press_access_apps.gated, so
-- both current family pages must carry gated=true (spaces.json still gates them for the
-- client, but the function reads the DB). Idempotent: insert if missing, force gated on.
insert into public.press_access_apps (page, label, gated) values
  ('remit.html', 'Remit',            true),
  ('perth.html', 'The Runway — Perth', true)
on conflict (page) do update set gated = true;

-- ── security: keep EXECUTE off PUBLIC, grant back explicitly (lessons.md) ────
-- create-or-replace preserves the existing ACL, but re-assert the rule so a future
-- reader can't mistake the default PUBLIC grant for intent.
revoke execute on function public.press_access_has(text) from public, anon;
grant  execute on function public.press_access_has(text) to authenticated;

-- =============================================================================
-- POST-APPLY VERIFICATION (Cowork / read-only MCP) — expect:
--   • an active person with NO grant rows:      press_access_has('remit.html') = true
--                                               press_access_has('perth.html') = true
--   • the same person with an active=false row for remit.html:  = false
--   • a DEACTIVATED person (people.active=false): = false for both
--   • advisor `anon_security_definer_function_executable` does NOT list press_access_has
--   • T6 (tenants-check): remit.html + perth.html still each >= 1 active grant (Mark's
--     existing rows are untouched; opt-out only adds active=false rows on revoke).
-- =============================================================================
