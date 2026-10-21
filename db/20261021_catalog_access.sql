-- =============================================================================
-- catalog.html — the ecosystem catalog joins the Family Wing, MARK ONLY (council arc ecosystem-catalog, 2026-10-21).
--
-- Mark's decision (2026-10-20, buttons): family wing, Mark only; others can be switched on later from access.html.
-- The Family Wing is OPT-OUT (20260924_press_access_optout.sql): every active person opens every gated family app
-- unless an active=false grant row says otherwise. So "Mark only" =
--   1. register the page, gated (press docs/spec.md → Tenants: a press_access_apps row BEFORE the gate ships);
--   2. an active=true grant for the wing ADMIN (Mark — identified by is_admin, never by a literal address: press is a
--      public repo) and an active=false grant (the opt-out) for every other person on record;
--   3. a trigger so anyone ADDED LATER starts switched OFF for catalog.html (opt-out would otherwise switch them on);
--      Mark turns a person on from access.html exactly as for any other family tool (switch ON = active=true).
-- Fails closed: if the wing does not have exactly ONE active admin the whole file aborts and changes nothing — Mark-only
-- cannot be derived from is_admin then, and the chat asks Mark instead of guessing.
-- No new table ⇒ no Data API grants needed. Idempotent: re-running changes nothing further.
--   4. the CONTENT lives in a table, not in catalog.html: press is a PUBLIC repo, so the page is only a shell that reads
--      ONE row of public.press_catalog after sign-in — RLS lets it through only when press_access_has('catalog.html').
--      The row is written by council (environment/catalog/press-content.sql, generated) through the connector.
-- An ADMIN added later starts ON (admins see every family tool under opt-out) — by design; anyone else starts OFF.
-- Applied by the chat at verify via the Supabase connector (council surface.md → "Supabase channel"); non-destructive.
-- =============================================================================

do $$
declare n int;
begin
  select count(*) into n from public.press_access_people where is_admin and active;
  if n <> 1 then
    raise exception 'catalog access: expected exactly 1 active Family Wing admin (Mark), found % — nothing changed', n;
  end if;
end $$;

-- 1 — the page, gated
insert into public.press_access_apps (page, label, gated) values
  ('catalog.html', 'Ecosystem catalog', true)
on conflict (page) do update set gated = true, label = excluded.label;

-- 2 — Mark on; everyone else on record off (the opt-out row). Never flips a later manual switch-ON back off:
--     a person row that already has a catalog.html grant keeps it.
insert into public.press_access_grants (email, page, active, revoked_at)
select p.email, 'catalog.html', (p.is_admin and p.active), case when p.is_admin and p.active then null else now() end
  from public.press_access_people p
on conflict (email, page) do nothing;

-- 3 — new people start OFF for catalog.html (Mark switches them on in access.html)
create or replace function public.press_catalog_default_off() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if not new.is_admin then
    insert into public.press_access_grants (email, page, active, revoked_at)
    values (new.email, 'catalog.html', false, now())
    on conflict (email, page) do nothing;
  end if;
  return new;
end $$;
revoke execute on function public.press_catalog_default_off() from public, anon, authenticated;

-- `create or replace trigger` (Postgres 14+), never a drop: no statement here trips the connector's destructive pop-up.
create or replace trigger press_catalog_default_off after insert on public.press_access_people
  for each row execute function public.press_catalog_default_off();

-- 4 — the content table (one row, id 'catalog'). Data API grants in this file (RULE from 2026-10-30): authenticated may
--     only SELECT (RLS decides which rows — none unless press_access_has('catalog.html')); anon gets nothing; writes are
--     service_role / the connector only. A deliberate exception to "authenticated gets all four": nobody edits it in-page.
create table if not exists public.press_catalog (
  id         text primary key check (id = 'catalog'),
  body       text not null,
  sha256     text not null,
  updated_at timestamptz not null default now()
);
alter table public.press_catalog enable row level security;
revoke all on public.press_catalog from anon, authenticated;
grant select on public.press_catalog to authenticated;
grant select, insert, update on public.press_catalog to service_role;  -- insert + update are all an upsert needs; no destructive keyword anywhere in this file
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'press_catalog' and policyname = 'press_catalog_read') then
    create policy press_catalog_read on public.press_catalog for select to authenticated
      using ( public.press_access_has('catalog.html') );
  end if;
end $$;

-- =============================================================================
-- POST-APPLY READ-BACK (the chat, read-only SQL) — expect:
--   select a.gated from press_access_apps a where a.page = 'catalog.html';                         → true
--   select count(*) filter (where g.active) as on_, count(*) filter (where not g.active) as off_
--     from press_access_grants g where g.page = 'catalog.html';                                      → on_ = 1
--   select count(*) from press_access_people p
--     where p.active and not exists (select 1 from press_access_grants g
--       where g.page = 'catalog.html' and g.email = p.email and g.active = false) ;                  → 1 (Mark)
--   select relrowsecurity from pg_class where oid = 'public.press_catalog'::regclass;                → true
--   then apply council environment/catalog/press-content.sql; its header names the expected sha256.
--   advisor anon_security_definer_function_executable does NOT list press_catalog_default_off
--   tenants-check T6 (when present): catalog.html has >= 1 active grant (Mark's).
-- =============================================================================
