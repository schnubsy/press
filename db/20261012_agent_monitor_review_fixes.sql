-- arc/marquee-wings-monitor slice 5 (review fixes, 2026-10-12)
-- 1. press_agent_expect / press_agent_watch_state are service-role-only: revoke Supabase's default anon/authenticated grants
--    (RLS with no policy was the only lock).
-- 2. press_agent_fix_run: cron commands may use unqualified names (planner_purge_tombstones) — run them with
--    search_path=public for the one statement (local to the transaction).
-- 3. press_agent_monitor_public: an enabled interval agent that has NEVER run is 'late' (amber, "Has never run —
--    check it is connected"), not 'failed' with "0 failed" beside it (Eye P0).
revoke all on public.press_agent_expect, public.press_agent_watch_state from anon, authenticated;
grant select, insert, update, delete on public.press_agent_expect, public.press_agent_watch_state to service_role;

create or replace function public.press_agent_fix_run(p_id text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_action text; v_job text; v_cmd text;
begin
  select retry_action into v_action from public.press_agent_expect where id = p_id and enabled;
  if v_action is null then raise exception 'no retry available for %', p_id; end if;
  if v_action like 'cron:%' then
    v_job := substr(v_action, 6);
    select command into v_cmd from cron.job where jobname = v_job and active;
    if v_cmd is null then raise exception 'cron job % not found or inactive', v_job; end if;
    perform pg_catalog.set_config('search_path', 'public, extensions', true);
    execute v_cmd;
    return 'Re-ran scheduled job ' || v_job;
  end if;
  raise exception 'retry action % is not allowlisted', v_action;
end $$;
revoke execute on function public.press_agent_fix_run(text) from public;
revoke execute on function public.press_agent_fix_run(text) from anon, authenticated;
grant execute on function public.press_agent_fix_run(text) to service_role;

create or replace view public.press_agent_monitor_public as
with e as (
  select * from public.press_agent_expect
),
runs as (   -- the evidence rows for every runs-*/checkin source (never `dead`: that is the old heartbeat's marker)
  select e.id, x.outcome, x.finished_at, x.started_at, x.cost_usd, x.note
  from e join public.press_agent_runs x
    on x.app = e.run_app and x.agent = e.run_agent
  where e.source in ('runs-work','runs-alive','runs-event') and x.outcome <> 'dead'
  union all
  select e.id, x.outcome, x.finished_at, x.started_at, x.cost_usd, x.note
  from e join public.press_agent_runs x on x.app = 'task' and x.agent = e.id
  where e.source = 'checkin'
),
rf as (
  select id,
         max(finished_at) filter (where outcome in ('ok','warn')) as work_at,
         max(finished_at)                                          as alive_at,
         max(finished_at) filter (where outcome = 'error')         as fail_at,
         count(*)                                                  as n_runs
  from runs group by id
),
cf as (
  select e.id,
         max(d.end_time)   filter (where d.status = 'succeeded') as work_at,
         max(d.start_time)                                       as alive_at,
         max(d.start_time) filter (where d.status = 'failed')    as fail_at,
         count(d.runid)                                          as n_runs,
         bool_or(j.active)                                       as active,
         (array_agg(d.return_message order by d.start_time desc) filter (where d.status = 'succeeded'))[1] as last_msg
  from e join cron.job j on j.jobname = e.cron_job
         left join cron.job_run_details d on d.jobid = j.jobid and d.start_time > now() - interval '40 days'
  where e.source = 'cron'
  group by e.id
),
costs as (
  select r.id,
         sum(coalesce(r.cost_usd,0)) filter (where (r.finished_at at time zone 'America/Chicago')::date
                                               >= date_trunc('month', now() at time zone 'America/Chicago')::date) as mtd,
         sum(coalesce(r.cost_usd,0)) filter (where (r.finished_at at time zone 'America/Chicago')::date
                                               between (now() at time zone 'America/Chicago')::date - 7
                                                   and (now() at time zone 'America/Chicago')::date - 1) / 7.0 as avg7
  from runs r where r.finished_at > now() - interval '40 days'
  group by r.id
),
f as (
  select e.*,
         coalesce(rf.work_at, cf.work_at)   as work_at,
         coalesce(rf.alive_at, cf.alive_at) as alive_at,
         coalesce(rf.fail_at, cf.fail_at)   as fail_at,
         coalesce(rf.n_runs, cf.n_runs, 0)  as n_runs,
         coalesce(cf.active, true)          as job_active,
         cf.last_msg,
         (e.sched ? 'every')                as is_interval,
         (e.sched is not null and not (e.sched ? 'every')) as is_calendar
  from e left join rf on rf.id = e.id left join cf on cf.id = e.id
),
g as (
  select f.*,
         case when f.source = 'runs-alive' then f.alive_at else f.work_at end as basis_at,
         case when f.is_calendar then public.press_agent_last_due(f.sched, now() - make_interval(mins => f.grace_minutes)) end as eff_due,
         case when f.is_interval then make_interval(mins => (f.sched ->> 'every')::int + f.grace_minutes) end as lim
  from f
),
s as (
  select g.*,
         (g.fail_at is not null and g.fail_at > coalesce(g.basis_at, '-infinity'::timestamptz)) as fail_after,
         case
           when not g.enabled or not g.job_active then 'off'
           when g.source = 'none' then 'no-data'
           when g.sched is null then
             case when g.n_runs = 0 then 'no-data'
                  when g.fail_at is not null and g.fail_at > coalesce(g.work_at, '-infinity'::timestamptz)
                       and g.fail_at > now() - interval '7 days' then 'failed'
                  else 'healthy' end
           when g.is_interval then
             case when g.basis_at is null then
                    case when now() - g.registered_at > g.lim then 'late' else 'no-data' end
                  when g.fail_at is not null and g.fail_at > g.basis_at then 'failed'
                  when now() - g.basis_at > g.lim * 4 then 'failed'
                  when now() - g.basis_at > g.lim then 'late'
                  else 'healthy' end
           else -- calendar
             case when g.eff_due is null or g.eff_due < g.registered_at then
                    case when g.basis_at is null then 'no-data'
                         when g.fail_at is not null and g.fail_at > g.basis_at then 'failed'
                         else 'healthy' end
                  when g.fail_at is not null and g.fail_at > coalesce(g.basis_at, '-infinity'::timestamptz)
                       and g.fail_at >= g.eff_due - interval '30 minutes' then 'failed'
                  when g.basis_at >= g.eff_due - interval '30 minutes' then 'healthy'
                  else 'late' end
         end as status
  from g
)
select
  s.id, s.app_label, s.label, s.what, s.kind, s.enabled, s.sched, s.grace_minutes, s.sort,
  s.status,
  case s.status
    when 'off'     then 'Switched off'
    when 'no-data' then case when s.source = 'none' then 'Not instrumented yet — nothing records its runs'
                             when s.sched is null then 'On demand · no calls logged yet'
                             else 'Waiting for its first run' end
    when 'failed'  then case when s.basis_at is null then 'Has never run'
                             when s.fail_at is not null and s.fail_at > coalesce(s.basis_at,'-infinity'::timestamptz) then 'Last attempt failed'
                             else 'Silent far longer than expected' end
    when 'late'    then case when s.basis_at is null then 'Has never run — check it is connected'
                             when s.is_calendar then 'Missed the run due '
                                  || to_char(s.eff_due at time zone 'America/Chicago', 'Dy Mon FMDD, FMHH12:MI AM') || ' CT'
                             else 'Overdue — no run within its expected window' end
    else case when s.sched is null then 'On demand · no failures seen'
              when s.dispatch_only then 'Fired on schedule · function result not tracked here'
              else 'Working' end
  end as status_reason,
  s.work_at  as last_real_work_at,
  case when s.source = 'runs-alive' then s.alive_at else s.work_at end as last_seen_at,
  s.fail_at  as last_failed_at,
  case
    when s.source = 'cron' and s.work_at is not null then
      case when s.dispatch_only then 'Called its function (HTTP request queued)' else 'Database job: ' || left(coalesce(s.last_msg,'done'), 60) end
    when s.work_at is not null then coalesce(
      (select left(r.note, 160) from runs r where r.id = s.id and r.outcome in ('ok','warn') and r.note is not null
        order by r.finished_at desc limit 1),
      case when s.output_page is not null then
        (select count(*)::text || ' deal' || case when count(*) = 1 then '' else 's' end || ' judged/updated'
           from public.press_deals d,
                (select r.started_at, r.finished_at from runs r where r.id = s.id and r.outcome = 'ok'
                  order by r.finished_at desc limit 1) lr
          where d.page = s.output_page and d.updated_at between lr.started_at and lr.finished_at + interval '2 minutes')
      end,
      'Real work logged')
  end as last_output_note,
  case when not s.enabled or s.status = 'off' then null
       when s.is_interval and s.basis_at is null and s.status in ('failed','late') then null
       when s.is_interval then coalesce(s.basis_at, s.registered_at) + make_interval(mins => (s.sched ->> 'every')::int)
       when s.is_calendar then
         case when s.status = 'late' then s.eff_due else public.press_agent_next_due(s.sched, now()) end
  end as next_due_at,
  case when s.source in ('runs-work','runs-event') then round(coalesce(c.mtd, 0), 4) end as cost_mtd,
  case when s.source in ('runs-work','runs-event') then
    round(coalesce(c.mtd, 0) + coalesce(c.avg7, 0) *
      extract(epoch from ((date_trunc('month', now() at time zone 'America/Chicago') + interval '1 month')
                          at time zone 'America/Chicago') - now()) / 86400.0, 4)
  end as cost_projected,
  (s.source in ('runs-work','runs-event')) as cost_tracked,
  s.fix_hint, s.fix_links,
  (s.retry_action is not null and s.enabled) as retry_available,
  w.status as watch_status, w.since as watch_since, w.notified_at as watch_notified_at
from s
left join costs c on c.id = s.id
left join public.press_agent_watch_state w on w.id = s.id;

revoke all on public.press_agent_monitor_public from anon, authenticated;
grant select on public.press_agent_monitor_public to anon, authenticated, service_role;
