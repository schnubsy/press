-- 20261012_press_steward_capability.sql — the steward-reports Edge Function's capability check (press arc/steward-report,
-- slice 3 review fix 🔴). The first cut accepted any x-plan-id for which a `press_deals` row with page='card-scout'
-- existed — FORGEABLE, because anon may INSERT press_deals rows carrying any sync_id it also sends as x-plan-id
-- (press_deals_ins checks only sync_id = header). The ONLY server-held copy of the private wing's Card Scout
-- capability is the press_deals.sync_id COLUMN DEFAULT (minted in-DB by 20260918_press_deals_gate.sql, never
-- committed). This function compares a presented id against that default — nothing a client can write.
--
-- SERVICE-ROLE-ONLY: no execute for public/anon/authenticated (the default is never returned, only a boolean, and only
-- to the Edge Function). A missing/odd default ⇒ false (fail closed).
create or replace function public.press_steward_capability_ok(p text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce((
    select p ~ '^[0-9a-f]{32}$'
       and pg_get_expr(d.adbin, d.adrelid) ~ '^''[0-9a-f]{32}''::text$'
       and pg_get_expr(d.adbin, d.adrelid) = quote_literal(p) || '::text'
    from pg_attrdef d
    join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
    where d.adrelid = 'public.press_deals'::regclass and a.attname = 'sync_id'
  ), false);
$$;
revoke all on function public.press_steward_capability_ok(text) from public, anon, authenticated;
grant execute on function public.press_steward_capability_ok(text) to service_role;
comment on function public.press_steward_capability_ok(text) is
  'steward-reports gate: true iff p equals the press_deals.sync_id column default (the private wing''s Card Scout '
  'capability, server-held). Service-role only. press arc/steward-report.';
