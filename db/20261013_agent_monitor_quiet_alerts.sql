-- db/20261013_agent_monitor_quiet_alerts.sql — arc quiet-alerts (2026-10-13).
--
-- Mark: "only tell me when an agent is down for a day and needs me — not when it is a bit late."
--   1. press_agent_watch_state gains the episode fields the watcher (watch-core.mjs) now needs:
--        bad_since     — start of the current unbroken late|failed run (late ↔ failed keeps it)
--        down_alerted  — the one "down 24h+" alert for this episode has gone out
--   2. press_agent_expect.idle_is_work — an agent whose "checked, nothing to do" tick is real work. Card Scout's deal
--      judge logs outcome 'skipped' with the empty-input hash h-811c9dc5 when there are no new deals; that is a
--      healthy run, not a missed one (it caused the 13 Oct 7am "Deal judge is late" false alarm). Only that exact
--      idle marker counts — a skip for any other reason still does not.
--   3. Data: Card Scout judge opts in; FSA receipt inlet (never connected) switched off on the monitor; the GitHub
--      watcher-of-the-watcher now runs every 6 hours.
-- The view is rebuilt from its LIVE definition (string patch) so nothing else in it can drift.

alter table public.press_agent_watch_state
  add column if not exists bad_since    timestamptz,
  add column if not exists down_alerted boolean not null default false;

alter table public.press_agent_expect
  add column if not exists idle_is_work boolean not null default false;

-- backfill: rows already down start their episode at `since`; ones already notified count as alerted (no repeat)
update public.press_agent_watch_state
   set bad_since = coalesce(bad_since, since),
       down_alerted = (notified_at is not null and notified_at >= since)
 where status in ('late','failed');

do $$
declare d text := pg_get_viewdef('public.press_agent_monitor_public'::regclass, true);
        n text;
begin
  if position('idle_is_work' in d) > 0 then return; end if;   -- already patched
  n := replace(d, 'press_agent_expect.registered_at' || E'\n' || '           FROM press_agent_expect',
                  'press_agent_expect.registered_at,' || E'\n' || '            press_agent_expect.idle_is_work' || E'\n' || '           FROM press_agent_expect');
  n := replace(n, '            x.note' || E'\n' || '           FROM e' || E'\n' || '             JOIN press_agent_runs x ON x.app = e.run_app',
                  '            x.note,' || E'\n' || '            x.input_hash,' || E'\n' || '            e.idle_is_work' || E'\n' || '           FROM e' || E'\n' || '             JOIN press_agent_runs x ON x.app = e.run_app');
  n := replace(n, '            x.note' || E'\n' || '           FROM e' || E'\n' || '             JOIN press_agent_runs x ON x.app = ''task''',
                  '            x.note,' || E'\n' || '            x.input_hash,' || E'\n' || '            e.idle_is_work' || E'\n' || '           FROM e' || E'\n' || '             JOIN press_agent_runs x ON x.app = ''task''');
  n := replace(n, 'max(runs.finished_at) FILTER (WHERE runs.outcome = ANY (ARRAY[''ok''::text, ''warn''::text])) AS work_at',
                  'max(runs.finished_at) FILTER (WHERE runs.outcome = ANY (ARRAY[''ok''::text, ''warn''::text]) OR runs.idle_is_work AND runs.outcome = ''skipped''::text AND runs.input_hash = ''h-811c9dc5''::text) AS work_at');
  if n = d or (length(n) - length(replace(n, 'idle_is_work', ''))) / length('idle_is_work') <> 4 then
    raise exception 'quiet-alerts: view patch did not apply cleanly (live definition changed?)';
  end if;
  execute 'create or replace view public.press_agent_monitor_public as ' || n;
end $$;

update public.press_agent_expect set idle_is_work = true where id = 'card-scout';
update public.press_agent_expect set enabled = false
 where id = 'fsa-capture';  -- never connected; switch back on (enabled = true) once the inlet reports in
update public.press_agent_expect set sched = '{"every":360}'::jsonb where id = 'agent-health-notifier';
