-- 20260918_press_deals_gate_cleanup.sql — PHASE 2 (CLEANUP) of the press_deals gate.
--
-- Companion to db/20260918_press_deals_gate.sql (PHASE 1, ADDITIVE). This is the deferred
-- destructive step (Amendment B). It ran ONLY after both preconditions were met:
--   1. a live agent tick was observed writing a correctly-stamped row (the column DEFAULT
--      auto-stamps a service-role insert), so SET NOT NULL is safe; and
--   2. the private-wing passkey enrolment succeeded AND Card Scout renders deals through the
--      vault (Mark confirmed), so the header-gated path is proven live.
--
-- It drops the two OPEN policies (anon/authenticated could read AND write every row — the 🔴
-- finding), revokes anon/authenticated DELETE, and pins sync_id NOT NULL. The column DEFAULT
-- (the card-scout capability key) is LEFT IN PLACE so the deployed agent's service-role
-- inserts keep auto-stamping; the secret never appears in this file.
--
-- Applied: 2026-09-19 via the Supabase MCP apply_migration (name 20260918_press_deals_gate_cleanup,
-- version 20260919043403, project eepjhpyziczrxvirczio).
-- Rollback (restores the exact pre-image): docs/evidence/two-space-slice-4-preimage.txt.
-- Negative-probe receipts: docs/evidence/two-space-slice-4-deals-rls.txt.

drop policy if exists press_deals_anon_all on public.press_deals;
drop policy if exists press_deals_auth_all on public.press_deals;
revoke delete on table public.press_deals from anon, authenticated;
alter table public.press_deals alter column sync_id set not null;

-- After this, the only policies on public.press_deals are the header-gated
-- press_deals_sel / press_deals_ins / press_deals_upd (x-plan-id = sync_id): an anon caller
-- with no header (or a wrong header) sees zero rows and cannot insert/update/delete/enumerate.
