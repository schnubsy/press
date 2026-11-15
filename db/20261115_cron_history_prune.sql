-- db/20261115_cron_history_prune.sql — arc monitor-view-timeout, slice 1 (2026-11-15).
--
-- Why: cron.job_run_details was never pruned (80,570 rows on 2026-11-15, 70k of them planner_push_send, ~1,440/day),
-- and press_agent_monitor_public reads it on every call — the anon request hit the 3 s statement timeout (57014).
-- What: one pg_cron job, `cron-history-prune` (daily 09:41 UTC = 03:41 CDT / 02:41 CST, off the hour), that deletes
--   • rows older than 45 days for every job (the monitor's widest window is 40 days), and
--   • rows older than 15 days for jobs that run more often than hourly (minute field not a single number, or a
--     "N seconds" schedule) — 15 days = the 14-day strip's window (press_agent_monitor_daily_public), so the strip
--     never loses a day;
--   • but NEVER a job's latest run, latest succeeded run or latest failed run (by runid), whatever their age — so a
--     job that stops is still read as "silent" / "last attempt failed", never as "has never run".
-- Read-only simulation on 2026-11-15 (docs/evidence/monitor-view-timeout-slice-1-prune.md): 80,570 → 25,232 rows;
-- the view's cron evidence (work/alive/fail times, any-runs, last message) and the 14-day strip identical.
-- The monitor watches the pruner too (press_agent_expect row `cron-history-prune`, source cron).
-- Idempotent: create or replace · cron.schedule upserts by name · insert … on conflict do nothing.
-- Creates no table (no table GRANTs); the function is kept off the Data API (no anon / authenticated execute).
-- Rollback: select cron.unschedule('cron-history-prune'); — deleted history is NOT restored.

create or replace function public.press_cron_history_prune()
returns integer language plpgsql set search_path = '' as $$
declare n integer;
begin
  with jobs as (
    select j.jobid,
           (j.schedule ~* 'second' or split_part(btrim(j.schedule), ' ', 1) !~ '^[0-9]+$') as frequent
      from cron.job j
  ), keep as (
    select max(d.runid) as runid from cron.job_run_details d group by d.jobid
    union select max(d.runid) from cron.job_run_details d where d.status = 'succeeded' group by d.jobid
    union select max(d.runid) from cron.job_run_details d where d.status = 'failed' group by d.jobid
  )
  delete from cron.job_run_details d
   where d.start_time < now() - case when coalesce((select j.frequent from jobs j where j.jobid = d.jobid), false)
                                     then interval '15 days' else interval '45 days' end
     and d.runid not in (select k.runid from keep k where k.runid is not null);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.press_cron_history_prune() from public;
revoke all on function public.press_cron_history_prune() from anon, authenticated;

select cron.schedule('cron-history-prune', '41 9 * * *', $cron$select public.press_cron_history_prune()$cron$);

insert into public.press_agent_expect
  (id, app_label, label, what, kind, enabled, source, run_app, run_agent, cron_job, dispatch_only, output_page,
   sched, grace_minutes, fix_hint, fix_links, retry_action, sort, registered_at)
values
('cron-history-prune', 'Marquee', 'Job history tidy-up', 'Database job, daily at 3:41 — trims old scheduled-job history so the monitor stays fast.',
 'pg-cron', true, 'cron', null, null, 'cron-history-prune', false, null,
 '{"every":1440}', 120, 'Check the cron job history; re-run if it failed.',
 '[{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"}]',
 'cron:cron-history-prune', 77, now())
on conflict (id) do nothing;
