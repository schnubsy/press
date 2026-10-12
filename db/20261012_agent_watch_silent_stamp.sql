-- arc/marquee-wings-monitor slice 5 (review fix): a SILENT watcher state change owes no alert, so stamp it
-- notified at once. The GitHub watcher-of-the-watcher reads notified_at < since as "an alert was owed but never
-- delivered"; without this a failed → late flip (silent by design) raised a false GitHub failure every hour.
-- Mirrors watch-core.mjs isAlertingChange: alert = into late|failed (except failed → late), or late|failed → healthy.
create or replace function public.press_agent_watch_state_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_from text := case when tg_op = 'UPDATE' then old.status end;
        v_to   text := new.status;
        v_alert boolean;
begin
  if tg_op = 'UPDATE' and v_from is not distinct from v_to then return new; end if;
  v_alert := (v_to in ('late','failed') and not (v_from = 'failed' and v_to = 'late'))
          or (v_from in ('late','failed') and v_to = 'healthy');
  if not v_alert then new.notified_at := coalesce(new.since, now()); end if;
  return new;
end $$;
revoke execute on function public.press_agent_watch_state_stamp() from public, anon, authenticated;
create trigger press_agent_watch_state_stamp before insert or update on public.press_agent_watch_state
  for each row execute function public.press_agent_watch_state_stamp();
-- backfill: rows already sitting in a silent state with no stamp
update public.press_agent_watch_state set notified_at = since
 where notified_at is null and status not in ('late','failed');
