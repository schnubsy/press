-- =============================================================================
-- press_access_requests — the Family Wing "Request access" flow (arc/marquee-wings-monitor slice 2).
-- Applied via the Supabase MCP as migration `press_access_requests`; this file MIRRORS it byte-for-byte.
--
-- RULE (Mark, 2026-10-12): Family Wing = no extra passwords. A person whose switch for an app is OFF
-- opens the app, sees the blocked screen with a "Request access" button; Mark gets a push + email;
-- he flips the switch on in the Access Manager (access.html); their next visit works. Default all-on
-- (opt-out — 20260924_press_access_optout.sql), so a request only ever exists for an opted-out person.
--
--   press_access_requests          one row per (email, page); re-request resets it to pending
--   press_access_request(page)     the ONLY write path for a family member (security definer, JWT email)
--   press_access_requests_notify   AFTER INSERT/UPDATE → pg_net → edge fn `access-notify`
--                                  (header secret read from Vault `access_notify_secret`)
--   press_access_notify_secret_ok  service_role-only check the edge fn uses to verify that header
--   press_access_grants_resolve    turning a switch ON (or deleting a revoke row) marks the request handled
-- =============================================================================

-- ── table ────────────────────────────────────────────────────────────────────
create table if not exists public.press_access_requests (
  email        text not null,
  page         text not null,
  requested_at timestamptz not null default now(),
  handled_at   timestamptz,
  primary key (email, page)
);

-- Data API grants (control-files.md → Data API grants): the grant opens the door, RLS decides rows.
-- anon gets nothing (family members reach this table ONLY through press_access_request()).
revoke all on public.press_access_requests from anon;
grant select, insert, update, delete on public.press_access_requests to authenticated, service_role;

alter table public.press_access_requests enable row level security;

-- admin-only read + update (the Access Manager). No insert/delete policy: inserts go through the
-- security-definer RPC below; the grants trigger resolves rows as the definer.
create policy press_access_requests_read on public.press_access_requests
  for select to authenticated
  using ( public.press_access_is_admin() );
create policy press_access_requests_update on public.press_access_requests
  for update to authenticated
  using ( public.press_access_is_admin() )
  with check ( public.press_access_is_admin() );

-- ── the request RPC ──────────────────────────────────────────────────────────
-- press_access_request(page) → text status:
--   'requested'          a new pending request was recorded (→ Mark is notified by the trigger)
--   'already_requested'  a request for this (email,page) was made < 10 minutes ago (rate limit; no notify)
--   'already_granted'    the caller can already open the page (nothing to ask for)
--   'not_on_list'        the caller is not an ACTIVE person (deactivated people cannot self-request)
--   'not_gated'          the page is not a gated family app
--   'not_signed_in'      no JWT email
-- Uses the caller's OWN JWT email — a caller can never file a request for someone else.
create or replace function public.press_access_request(page text) returns text
  language plpgsql volatile security definer set search_path = '' as $$
declare
  me   text := (select auth.jwt() ->> 'email');
  prev timestamptz;
begin
  if me is null or me = '' then return 'not_signed_in'; end if;
  if not exists (select 1 from public.press_access_people p where p.email = me and p.active) then
    return 'not_on_list';
  end if;
  if not exists (select 1 from public.press_access_apps a
                 where a.page = press_access_request.page and a.gated) then
    return 'not_gated';
  end if;
  if public.press_access_has(press_access_request.page) then return 'already_granted'; end if;

  select r.requested_at into prev from public.press_access_requests r
   where r.email = me and r.page = press_access_request.page;
  if prev is not null and prev > now() - interval '10 minutes' then
    return 'already_requested';
  end if;

  insert into public.press_access_requests as r (email, page, requested_at, handled_at)
  values (me, press_access_request.page, now(), null)
  on conflict (email, page) do update set requested_at = now(), handled_at = null;
  return 'requested';
end; $$;

revoke execute on function public.press_access_request(text) from public, anon;
grant  execute on function public.press_access_request(text) to authenticated;

-- ── Vault secret for the trigger → edge-function header ─────────────────────
-- Generated IN the database, never printed, never committed. The edge function verifies the header
-- by asking press_access_notify_secret_ok() with its service-role key, so the value lives in ONE
-- place (Vault) — no copy in function secrets to drift.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'access_notify_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      'access_notify_secret',
      'press: header secret for press_access_requests → edge fn access-notify');
  end if;
end $$;

create or replace function public.press_access_notify_secret_ok(candidate text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce(candidate, '') <> '' and exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'access_notify_secret' and s.decrypted_secret = candidate );
$$;
revoke execute on function public.press_access_notify_secret_ok(text) from public, anon, authenticated;
grant  execute on function public.press_access_notify_secret_ok(text) to service_role;

-- ── notify trigger (only on a NEW pending request) ───────────────────────────
create or replace function public.press_access_requests_notify() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.handled_at is not null then return null; end if;
  if tg_op = 'UPDATE' and old.requested_at = new.requested_at then
    return null;   -- not a new request (e.g. an admin edit) — only a fresh requested_at notifies
  end if;
  begin
    perform net.http_post(
      url     := 'https://eepjhpyziczrxvirczio.supabase.co/functions/v1/access-notify',
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-access-notify-secret',
          (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'access_notify_secret')),
      body    := jsonb_build_object('email', new.email, 'page', new.page, 'requested_at', new.requested_at),
      timeout_milliseconds := 10000);
  exception when others then
    -- a notify failure must never lose the request row; the Access Manager still shows it
    raise warning 'press_access_requests_notify: % ', sqlerrm;
  end;
  return null;
end; $$;
revoke execute on function public.press_access_requests_notify() from public, anon, authenticated;

create trigger press_access_requests_notify
  after insert or update on public.press_access_requests
  for each row execute function public.press_access_requests_notify();

-- ── resolve: switching ON (or removing the revoke row) handles the request ───
create or replace function public.press_access_grants_resolve() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    update public.press_access_requests r set handled_at = now()
     where r.email = old.email and r.page = old.page and r.handled_at is null;
    return null;
  end if;
  if new.active then
    update public.press_access_requests r set handled_at = now()
     where r.email = new.email and r.page = new.page and r.handled_at is null;
  end if;
  return null;
end; $$;
revoke execute on function public.press_access_grants_resolve() from public, anon, authenticated;

create trigger press_access_grants_resolve
  after insert or update or delete on public.press_access_grants
  for each row execute function public.press_access_grants_resolve();
