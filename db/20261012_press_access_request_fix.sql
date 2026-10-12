-- =============================================================================
-- press_access_request_fix — follow-up to 20261012_press_access_requests.sql (same slice).
-- Applied via the Supabase MCP as migration `press_access_request_fix`; this file MIRRORS it byte-for-byte.
--
-- BUG (caught by the slice-2 SQL proof, before any caller existed): `on conflict (email, page)` inside
-- the plpgsql function is AMBIGUOUS — `page` is both the parameter and a column (42702). The upsert now
-- names the primary-key constraint instead. Body otherwise identical; ACL re-asserted.
-- =============================================================================

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
  on conflict on constraint press_access_requests_pkey do update set requested_at = now(), handled_at = null;
  return 'requested';
end; $$;

revoke execute on function public.press_access_request(text) from public, anon;
grant  execute on function public.press_access_request(text) to authenticated;
