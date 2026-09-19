-- 20260918_press_deals_gate.sql — close the 🔴 press_deals finding (anon could read AND
-- write every row) by moving it onto the same header-gated RLS as press_fsa (x-plan-id =
-- sync_id), WITHOUT ever committing the secret sync_id to this repo.
--
-- The sync_id is a 128-bit capability generated IN THE DATABASE (gen_random_bytes) and kept
-- as the column DEFAULT, so it never appears in this file, in a migration text, or in any
-- transcript. It is retrieved once (server-side) and handed to Mark for enrolment.
--
-- Applied in TWO phases (Amendment A — additive-then-cleanup; nothing is destructive before
-- the cleanup phase, and rollback is one statement from docs/evidence/two-space-slice-4-preimage.txt):
--   ADDITIVE  (migration 20260918_press_deals_gate_additive): add column + default + backfill,
--             then add the header-gated policies ALONGSIDE the existing open ones.
--   CLEANUP   (migration 20260918_press_deals_gate_cleanup): only AFTER a live agent tick is
--             observed writing a correctly-stamped row (Amendment B) — drop the open policies,
--             revoke anon DELETE, and SET NOT NULL.

-- ─── PHASE 1 — ADDITIVE (safe; existing + in-flight inserts keep working) ───────────────────
alter table public.press_deals add column if not exists sync_id text;

do $$
declare sid text;
begin
  -- idempotent: reuse an already-set sync_id, otherwise mint one in-DB (never leaves the server)
  select sync_id into sid from public.press_deals where sync_id is not null limit 1;
  if sid is null then sid := encode(gen_random_bytes(16), 'hex'); end if;
  execute format('alter table public.press_deals alter column sync_id set default %L', sid);
  update public.press_deals set sync_id = sid where sync_id is null;   -- backfill
end $$;

comment on column public.press_deals.sync_id is
  'Secret 128-bit capability. RLS gates every row on the x-plan-id header = sync_id. Kept as the '
  'column DEFAULT so the service-role agent''s inserts are auto-stamped (belt) even without an '
  'explicit value (braces). Generated in-DB; never committed to schnubsy/press.';

-- header-gated policies ALONGSIDE the open ones (mirror press_fsa; no DELETE policy)
drop policy if exists press_deals_sel on public.press_deals;
create policy press_deals_sel on public.press_deals for select to anon, authenticated
  using (sync_id = nullif(current_setting('request.headers', true)::json ->> 'x-plan-id', ''));

drop policy if exists press_deals_ins on public.press_deals;
create policy press_deals_ins on public.press_deals for insert to anon, authenticated
  with check (sync_id = nullif(current_setting('request.headers', true)::json ->> 'x-plan-id', ''));

drop policy if exists press_deals_upd on public.press_deals;
create policy press_deals_upd on public.press_deals for update to anon, authenticated
  using (sync_id = nullif(current_setting('request.headers', true)::json ->> 'x-plan-id', ''))
  with check (sync_id = nullif(current_setting('request.headers', true)::json ->> 'x-plan-id', ''));

-- ─── PHASE 2 — CLEANUP (destructive; applied only after Amendment B is satisfied) ────────────
-- drop policy if exists press_deals_anon_all on public.press_deals;
-- drop policy if exists press_deals_auth_all on public.press_deals;
-- revoke delete on table public.press_deals from anon, authenticated;
-- alter table public.press_deals alter column sync_id set not null;
