-- perth RLS gate — Phase 2 of arc/family-wing-gate. Close perth's open (sync_id IS NULL) data.
-- Author: Claude Opus 4.8 for Mark Gubb, 2026-09-22.  Paired rollback: 20260922_perth_rls_gate_rollback.sql
--
-- APPLY ORDER (Card Scout lesson — a header-gated RLS 200 with ZERO rows is WRONG-KEY, not success):
-- perth.html ships and is verified live FIRST, already sending the signed-in family user's GoTrue JWT
-- (perth.html H() -> FamilyGate.authHeaders()), THEN this migration applies. That way the board never
-- loses its rows. Verified live 2026-09-22 before writing this: publish 200 + hash match; 72 perth +
-- 99 archive rows read; 171 rows writable under role authenticated with Mark's JWT (rolled back).
--
-- WHAT CHANGES. press_tasks_scoped / press_state_scoped currently admit any row with
--     (sync_id IS NULL) OR (sync_id = x-plan-id header)
-- The blanket `sync_id IS NULL` branch makes EVERY null-scoped page world-open — perth (72) +
-- perth-archive-20260921 (99), eagle-path (174), kayley (12). This closes that:
--   * HEADER-SCOPED branch (Card Scout and any x-plan-id row) — UNCHANGED, byte-for-byte.
--   * PUBLIC allow-list — ONLY press_tasks page='eagle-path' and press_state page='kayley' stay open.
--     Nothing else null-scoped remains public.
--   * PERTH — press_tasks page='perth' AND page='perth-archive-20260921' require the 'perth.html'
--     family grant via public.press_access_has('perth.html'). 'perth-archive-20260921' is a page TAG,
--     not a filename, so it is mapped explicitly (miss it and 99 archived rows go dark).
--
-- WHY A SEPARATE authenticated-ONLY POLICY FOR PERTH (not one merged press_tasks_scoped expression).
-- press_tasks is a SHARED table: eagle-path (public) and card-scout (header-scoped) are read by the
-- ANON role with the publishable key. public.press_access_has(text) has EXECUTE granted to
-- `authenticated` ONLY — anon/public were revoked in 20260921180000 (the enumeration-oracle hardening).
-- A single policy whose expression calls press_access_has('perth.html') is evaluated by anon too (the
-- planner folds the constant-arg STABLE call once per query), so an anon read of eagle-path ERRORS with
-- `permission denied for function press_access_has` — proven in a rolled-back dry-run 2026-09-22, which
-- would take eagle-path and card-scout down. Splitting by role fixes this AND keeps press_access_has
-- locked to authenticated: anon evaluates only the function-free press_tasks_scoped; the grant check
-- lives in press_tasks_perth (TO authenticated), which permissive-ORs in for signed-in users. No new
-- GRANT/REVOKE is introduced and remit_private.remit_has_access()/'remit.html' are untouched.
--
-- WHAT IS DELIBERATELY UNTOUCHED. Card Scout's header-scoped path (kept verbatim) and its CHECK
-- constraints press_tasks_cardscout_sync_id / press_state_cardscout_sync_id
-- (CHECK ((page <> 'card-scout') OR (sync_id IS NOT NULL))). press_state carries no perth rows, so it
-- gets only the reduced kayley allow-list and no grant-function call (anon-safe as-is).
--
-- MECHANISM. ALTER POLICY on the shared policies (no deny-all window; roles anon+authenticated and
-- command ALL preserved — only USING/WITH CHECK move) + one CREATE POLICY for the perth grant.

-- 1) Shared press_tasks policy → anon-safe allow-list, no grant-function call.
alter policy press_tasks_scoped on public.press_tasks
  using (
    (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text))
    or (page = 'eagle-path'::text)
  )
  with check (
    (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text))
    or (page = 'eagle-path'::text)
  );

-- 2) perth's data — authenticated-only, gated on the 'perth.html' family grant (live + archive tags).
create policy press_tasks_perth on public.press_tasks
  for all to authenticated
  using (
    page = any (array['perth'::text, 'perth-archive-20260921'::text]) and public.press_access_has('perth.html'::text)
  )
  with check (
    page = any (array['perth'::text, 'perth-archive-20260921'::text]) and public.press_access_has('perth.html'::text)
  );

-- 3) Shared press_state policy → anon-safe allow-list (kayley only). No perth rows live here.
alter policy press_state_scoped on public.press_state
  using (
    (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text))
    or (page = 'kayley'::text)
  )
  with check (
    (sync_id = NULLIF(((current_setting('request.headers'::text, true))::json ->> 'x-plan-id'::text), ''::text))
    or (page = 'kayley'::text)
  );
