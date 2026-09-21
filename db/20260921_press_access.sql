-- =============================================================================
-- press_access — the Family Wing access tier (docs/access-framework.md §4–§6).
--
-- Three tables + three helpers + one auth hook, all in the shared `press` project
-- (eepjhpyziczrxvirczio). ADMIN-WRITABLE ONLY; anon revoked on every table. This
-- file MIRRORS what Cowork's Supabase connector applies — Code's Supabase MCP is
-- read-only for DDL, so this migration is AUTHORED here and APPLIED by Cowork.
--
-- The honest security claim (framework §2): the gate is courtesy; RLS is the lock.
-- Every tenant row sits behind `press_access_has('<page>')` on a valid JWT email.
--
-- SEED POLICY — the 🔴 HOLD (remit ARC.md): this migration seeds NOBODY. Mark alone
-- is inserted into press_access_people + press_access_grants at slice 8, by Cowork,
-- once he has confirmed the site is ready. An un-seeded address cannot receive a code
-- (the hook below) and reads nothing (RLS). The hold is enforced by the data.
-- =============================================================================

-- ── tables ───────────────────────────────────────────────────────────────────
create table if not exists public.press_access_people (
  email        text primary key,
  name         text,
  is_admin     boolean not null default false,
  active       boolean not null default true,
  added_at     timestamptz not null default now(),
  last_seen_at timestamptz                       -- stamped by the gate on sign-in (§6)
);

create table if not exists public.press_access_apps (
  page      text primary key,                    -- e.g. 'remit.html'
  label     text,
  gated     boolean not null default false,      -- the DB half of the fail-closed union (§3)
  added_at  timestamptz not null default now()
);

create table if not exists public.press_access_grants (
  email      text not null,
  page       text not null,
  active     boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (email, page)
);

create index if not exists press_access_grants_email_idx on public.press_access_grants (email);
create index if not exists press_access_grants_page_idx  on public.press_access_grants (page);

-- ── helpers (security definer, empty search_path) ────────────────────────────
-- is_admin(): true when the caller's own JWT email is an active admin. Used by every
-- write policy. No arguments — reveals only the caller's own admin status.
create or replace function public.press_access_is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.press_access_people p
    where p.email = (select auth.jwt() ->> 'email') and p.is_admin and p.active );
$$;

-- has(page): true when the caller's own active email holds an active grant for `page`.
-- This is the function each tenant app puts on its RLS: using ( press_access_has('remit.html') ).
create or replace function public.press_access_has(page text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.press_access_grants g
    join public.press_access_people p on p.email = g.email
    where g.page = press_access_has.page and g.active and p.active
      and g.email = (select auth.jwt() ->> 'email') );
$$;

-- touch(): the gate stamps the caller's OWN last_seen_at on successful sign-in (§6).
-- A security-definer RPC rather than a self-update policy, so writes stay admin-only
-- everywhere else — last_seen is the single exception and it can only ever move a
-- person's own timestamp forward.
create or replace function public.press_access_touch() returns void
  language sql volatile security definer set search_path = '' as $$
  update public.press_access_people
     set last_seen_at = now()
   where email = (select auth.jwt() ->> 'email') and active;
$$;

-- ── Before-User-Created hook (framework §5) ──────────────────────────────────
-- The belt to "sign-ups off in the dashboard" braces: refuse any address not active
-- in press_access_people, so inviting is a single row, never a deployment. Robust to
-- the payload shape (GoTrue has moved the email between locations across versions).
-- NB: takes effect only once wired in Dashboard → Auth → Hooks (a Mark manual step).
create or replace function public.press_access_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare addr text := lower(coalesce(
  event -> 'user_metadata' ->> 'email',
  event -> 'record'        ->> 'email',
  event -> 'claims'        ->> 'email',
  event                    ->> 'email'));
begin
  if addr is null or not exists (
       select 1 from public.press_access_people p
       where lower(p.email) = addr and p.active) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This address is not on the family list.'));
  end if;
  return '{}'::jsonb;
end; $$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.press_access_people  enable row level security;
alter table public.press_access_apps    enable row level security;
alter table public.press_access_grants  enable row level security;

-- anon gets nothing on any of the three (the gate never needs anon reads; it fails
-- closed instead). authenticated is scoped by the policies below.
revoke all on public.press_access_people  from anon;
revoke all on public.press_access_apps    from anon;
revoke all on public.press_access_grants  from anon;

-- people: read your OWN row, or everything if you are an admin. Write: admin only.
drop policy if exists press_access_people_read on public.press_access_people;
create policy press_access_people_read on public.press_access_people
  for select to authenticated
  using ( email = (select auth.jwt() ->> 'email') or public.press_access_is_admin() );
drop policy if exists press_access_people_write on public.press_access_people;
create policy press_access_people_write on public.press_access_people
  for all to authenticated
  using ( public.press_access_is_admin() )
  with check ( public.press_access_is_admin() );

-- grants: read your OWN grants, or everything if admin. Write: admin only.
drop policy if exists press_access_grants_read on public.press_access_grants;
create policy press_access_grants_read on public.press_access_grants
  for select to authenticated
  using ( email = (select auth.jwt() ->> 'email') or public.press_access_is_admin() );
drop policy if exists press_access_grants_write on public.press_access_grants;
create policy press_access_grants_write on public.press_access_grants
  for all to authenticated
  using ( public.press_access_is_admin() )
  with check ( public.press_access_is_admin() );

-- apps: any signed-in user may READ the gated map (it carries no secret — spaces.json
-- exposes the same fact publicly, and the shared gate consults it, §7). Write: admin only.
drop policy if exists press_access_apps_read on public.press_access_apps;
create policy press_access_apps_read on public.press_access_apps
  for select to authenticated
  using ( true );
drop policy if exists press_access_apps_write on public.press_access_apps;
create policy press_access_apps_write on public.press_access_apps
  for all to authenticated
  using ( public.press_access_is_admin() )
  with check ( public.press_access_is_admin() );

-- execute grants: the tenant policies and the gate call these as `authenticated`.
grant execute on function public.press_access_is_admin()        to authenticated;
grant execute on function public.press_access_has(text)         to authenticated;
grant execute on function public.press_access_touch()           to authenticated;
-- the hook runs as the auth admin role; no anon/authenticated execute is granted.
revoke all on function public.press_access_before_user_created(jsonb) from anon, authenticated;
