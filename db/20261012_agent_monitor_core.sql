-- db/20261012_agent_monitor_core.sql — Agent Monitor core (arc marquee-wings-monitor, slice 4).
--
-- WHY: the old dashboard read press_agent_registry.last_ok_at, which council agent-core bumps on `skipped`
-- ticks too — so an agent that never did real work still looked healthy (self-validating). This migration
-- moves health to the SERVER and derives it from REAL work only:
--   * press_agent_expect        — one row per monitored thing (agent, AI function, pg_cron job, cloud/Mac/browser
--                                  scheduled task, GH Action, inlet): app grouping, kind, where its evidence
--                                  lives (source), expected schedule + grace, fix hint/links, allowlisted retry.
--   * press_agent_watch_state   — the watcher's last-seen status per row (alerts fire on CHANGE only).
--   * press_agent_checkin()     — scheduled tasks (cloud / Mac / browser) report end-of-run via the Supabase
--                                  connector; service_role/postgres only.
--   * press_agent_monitor_public / press_agent_monitor_daily_public — the ONLY things the public page reads:
--                                  server-computed status, last real work + output, next due, cost MTD +
--                                  projected (America/Chicago days). No secrets, emails, prompts or commands.
-- council agent-core is NOT changed: `skipped` still bumps registry.last_ok_at; this monitor simply never reads it.
--
-- Grants (docs/spec.md DB grants RULE): both new tables are service-role-only (RLS on, no policies; the public
-- reads go through the two views), so each grants service_role alone. Every SECURITY DEFINER function revokes
-- EXECUTE from PUBLIC first (docs/lessons.md) and grants back explicitly.

-- ── 1. press_agent_runs: a check-in can say `warn`, and any run can carry a short output note ─────────────────
alter table public.press_agent_runs drop constraint if exists press_agent_runs_outcome_check;
alter table public.press_agent_runs add constraint press_agent_runs_outcome_check
  check (outcome = any (array['ok','skipped','refused','error','dead','warn']));
alter table public.press_agent_runs add column if not exists note text;

-- ── 2. expectation table ─────────────────────────────────────────────────────────────────────────────────────
-- source:  runs-work  = real work = press_agent_runs outcome ok|warn for (run_app, run_agent)   [never skipped]
--          runs-alive = liveness  = any non-`dead` run for (run_app, run_agent) (an inlet poll proves the pipe)
--          runs-event = on demand = status from the last attempt's outcome; no cadence
--          cron       = cron.job_run_details for cron_job (dispatch_only: an http_post job — "succeeded" = queued)
--          checkin    = press_agent_runs app='task', agent=id, written by press_agent_checkin()
--          none       = not instrumented (shown honestly as "No data")
-- sched (America/Chicago): {"every":min} | {"daily":["HH:MM",…]} | {"weekly":{"dow":0-6,"at":"HH:MM"}}
--                          | {"monthly":{"dom":1-28,"at":"HH:MM"}} | null (on demand)
create table if not exists public.press_agent_expect (
  id            text primary key check (id ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  app_label     text not null,
  label         text not null,
  what          text not null,
  kind          text not null check (kind in ('edge-cron','edge-on-demand','pg-cron','cloud-task','mac-task','browser-task','gh-action','inlet')),
  enabled       boolean not null default true,
  source        text not null check (source in ('runs-work','runs-alive','runs-event','cron','checkin','none')),
  run_app       text,
  run_agent     text,
  cron_job      text,
  dispatch_only boolean not null default false,
  output_page   text,
  sched         jsonb,
  grace_minutes integer not null default 60 check (grace_minutes >= 0),
  fix_hint      text,
  fix_links     jsonb not null default '[]'::jsonb,
  retry_action  text check (retry_action is null or retry_action ~ '^(cron|invoke):[a-z0-9_-]+$'),
  sort          integer not null default 100,
  registered_at timestamptz not null default now()
);
alter table public.press_agent_expect enable row level security;
-- service-role-only base table (no policies; the public reads go through press_agent_monitor_public).
grant select, insert, update, delete on public.press_agent_expect to service_role;

create table if not exists public.press_agent_watch_state (
  id          text primary key references public.press_agent_expect(id) on delete cascade,
  status      text not null,
  since       timestamptz not null default now(),
  notified_at timestamptz
);
alter table public.press_agent_watch_state enable row level security;
-- service-role-only (written by the agent-watch Edge Function; exposed read-only via the monitor view).
grant select, insert, update, delete on public.press_agent_watch_state to service_role;

-- ── 3. schedule helpers (America/Chicago wall-clock) ──────────────────────────────────────────────────────────
create or replace function public.press_agent_due_times(p_sched jsonb, p_from timestamptz, p_to timestamptz)
returns setof timestamptz language sql stable set search_path = '' as $$
  with days as (
    select g::date as d
    from generate_series(((p_from at time zone 'America/Chicago')::date - 1)::timestamp,
                         ((p_to   at time zone 'America/Chicago')::date + 1)::timestamp, interval '1 day') g
  ), cand as (
    select (days.d + t.at::time) at time zone 'America/Chicago' as ts
    from days cross join lateral (
      select jsonb_array_elements_text(p_sched -> 'daily') as at where p_sched ? 'daily'
      union all
      select p_sched -> 'weekly' ->> 'at' where p_sched ? 'weekly'
        and extract(dow from days.d) = (p_sched -> 'weekly' ->> 'dow')::int
      union all
      select p_sched -> 'monthly' ->> 'at' where p_sched ? 'monthly'
        and extract(day from days.d) = (p_sched -> 'monthly' ->> 'dom')::int
    ) t
  )
  select ts from cand where ts >= p_from and ts <= p_to order by ts;
$$;

create or replace function public.press_agent_last_due(p_sched jsonb, p_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select max(ts) from public.press_agent_due_times(p_sched, p_at - interval '40 days', p_at) ts;
$$;

create or replace function public.press_agent_next_due(p_sched jsonb, p_at timestamptz)
returns timestamptz language sql stable set search_path = '' as $$
  select min(ts) from public.press_agent_due_times(p_sched, p_at, p_at + interval '40 days') ts where ts > p_at;
$$;

-- ── 4. the public status view ─────────────────────────────────────────────────────────────────────────────────
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
                    case when now() - g.registered_at > g.lim then 'failed' else 'no-data' end
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
    when 'late'    then case when s.is_calendar then 'Missed the run due '
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
       when s.is_interval then coalesce(s.basis_at, s.registered_at) + make_interval(mins => (s.sched ->> 'every')::int)
       when s.is_calendar then
         case when s.status = 'late' then s.eff_due else public.press_agent_next_due(s.sched, now()) end
  end as next_due_at,
  round(coalesce(c.mtd, 0), 4) as cost_mtd,
  case when s.source in ('runs-work','runs-alive','runs-event') then
    round(coalesce(c.mtd, 0) + coalesce(c.avg7, 0) *
      extract(epoch from ((date_trunc('month', now() at time zone 'America/Chicago') + interval '1 month')
                          at time zone 'America/Chicago') - now()) / 86400.0, 4)
  end as cost_projected,
  (s.source in ('runs-work','runs-alive','runs-event')) as cost_tracked,
  s.fix_hint, s.fix_links,
  (s.retry_action is not null and s.enabled) as retry_available,
  w.status as watch_status, w.since as watch_since, w.notified_at as watch_notified_at
from s
left join costs c on c.id = s.id
left join public.press_agent_watch_state w on w.id = s.id;

-- ── 5. the public 14-day strip (America/Chicago days) ────────────────────────────────────────────────────────
create or replace view public.press_agent_monitor_daily_public as
with e as (select * from public.press_agent_expect),
runs as (
  select e.id, x.outcome, x.finished_at, x.cost_usd
  from e join public.press_agent_runs x on x.app = e.run_app and x.agent = e.run_agent
  where e.source in ('runs-work','runs-alive','runs-event') and x.outcome <> 'dead'
    and x.finished_at > now() - interval '15 days'
  union all
  select e.id, x.outcome, x.finished_at, x.cost_usd
  from e join public.press_agent_runs x on x.app = 'task' and x.agent = e.id
  where e.source = 'checkin' and x.finished_at > now() - interval '15 days'
)
select id, (finished_at at time zone 'America/Chicago')::date as day,
       (count(*) filter (where outcome in ('ok','warn')))::int        as real_n,
       (count(*) filter (where outcome in ('skipped','refused')))::int as quiet_n,
       (count(*) filter (where outcome = 'error'))::int               as failed_n,
       round(coalesce(sum(cost_usd), 0), 6)                           as cost_usd
from runs
where (finished_at at time zone 'America/Chicago')::date > (now() at time zone 'America/Chicago')::date - 14
group by 1, 2
union all
select e.id, (d.start_time at time zone 'America/Chicago')::date as day,
       (count(*) filter (where d.status = 'succeeded'))::int,
       0,
       (count(*) filter (where d.status = 'failed'))::int,
       0::numeric
from e join cron.job j on j.jobname = e.cron_job
       join cron.job_run_details d on d.jobid = j.jobid
where e.source = 'cron' and d.start_time > now() - interval '15 days'
  and (d.start_time at time zone 'America/Chicago')::date > (now() at time zone 'America/Chicago')::date - 14
group by 1, 2;

revoke all on public.press_agent_monitor_public, public.press_agent_monitor_daily_public from anon, authenticated;
grant select on public.press_agent_monitor_public, public.press_agent_monitor_daily_public to anon, authenticated, service_role;

-- ── 6. check-in RPC (scheduled tasks call it at end of run via the Supabase connector) ───────────────────────
--   select public.press_agent_checkin('<agent id>', 'ok', '<what it produced, ≤280 chars>');   -- 'ok' | 'warn' | 'fail'
create or replace function public.press_agent_checkin(agent text, status text, note text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare v_outcome text; v_id text;
begin
  if not exists (select 1 from public.press_agent_expect e where e.id = agent and e.source = 'checkin') then
    raise exception 'press_agent_checkin: unknown check-in agent %', agent;
  end if;
  v_outcome := case lower(coalesce(status,'')) when 'ok' then 'ok' when 'warn' then 'warn'
                                               when 'fail' then 'error' when 'failed' then 'error' when 'error' then 'error' end;
  if v_outcome is null then raise exception 'press_agent_checkin: status must be ok | warn | fail'; end if;
  v_id := 'task:' || agent || ':' || to_char(clock_timestamp() at time zone 'UTC', 'YYYYMMDD"T"HH24MISS.US');
  insert into public.press_agent_runs (run_id, app, agent, kind, model, outcome, note, started_at, finished_at)
  values (v_id, 'task', agent, 'checkin', '-', v_outcome, left(note, 280), now(), now());
  return v_id;
end $$;
revoke execute on function public.press_agent_checkin(text, text, text) from public;
revoke execute on function public.press_agent_checkin(text, text, text) from anon, authenticated;
grant execute on function public.press_agent_checkin(text, text, text) to service_role;

-- ── 7. allowlisted retry (agent-fix Edge Function → service_role only) ───────────────────────────────────────
-- Only a row's own retry_action runs; cron:<job> re-runs that pg_cron job's OWN command once (the command text
-- never leaves the database). The admin check + 10-minute rate limit live in agent-fix.
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
    execute v_cmd;
    return 'Re-ran scheduled job ' || v_job;
  end if;
  raise exception 'retry action % is not allowlisted', v_action;
end $$;
revoke execute on function public.press_agent_fix_run(text) from public;
revoke execute on function public.press_agent_fix_run(text) from anon, authenticated;
grant execute on function public.press_agent_fix_run(text) to service_role;

-- schedule helpers are pure (no data); keep them off the anon Data API anyway.
revoke execute on function public.press_agent_due_times(jsonb, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.press_agent_last_due(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.press_agent_next_due(jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.press_agent_due_times(jsonb, timestamptz, timestamptz) to service_role;
grant execute on function public.press_agent_last_due(jsonb, timestamptz) to service_role;
grant execute on function public.press_agent_next_due(jsonb, timestamptz) to service_role;

-- ── 8. seed: the full inventory (2026-10-12 audit) ───────────────────────────────────────────────────────────
insert into public.press_agent_expect
  (id, app_label, label, what, kind, enabled, source, run_app, run_agent, cron_job, dispatch_only, output_page,
   sched, grace_minutes, fix_hint, fix_links, retry_action, sort, registered_at)
values
-- Card Scout
('card-scout', 'Card Scout', 'Deal judge', 'Checks gift-card deal sources and judges them with Haiku, 3× a day.',
 'edge-cron', true, 'runs-work', 'card-scout', 'card-scout', null, false, 'card-scout',
 '{"daily":["07:00","12:00","18:00"]}', 90,
 'Open the function logs; if the 30-minute trigger is firing but nothing is judged, re-run it.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/card-scout/logs"},{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"}]',
 'cron:card-scout-scheduled', 10, '2026-09-18'),
('card-scout-prune', 'Card Scout', 'Nightly tidy-up', 'Deletes Card Scout deals and run logs older than 30 days.',
 'pg-cron', true, 'cron', null, null, 'card-scout-prune', false, null,
 '{"every":1440}', 120, 'Check the cron job history; re-run if it failed.',
 '[{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"}]',
 'cron:card-scout-prune', 11, '2026-09-18'),
('card-scout-weekly-store-check', 'Card Scout', 'Weekly store check', 'Cloud scheduled task (browser lane) that checks store pages every Wednesday noon.',
 'browser-task', true, 'checkin', null, null, null, false, null,
 '{"weekly":{"dow":3,"at":"12:00"}}', 360,
 'Open Scheduled tasks on claude.ai, check the last run of "Card Scout — weekly store check", and run it now.',
 '[{"label":"Scheduled tasks","url":"https://claude.ai/code/scheduled"}]',
 null, 12, now()),
-- Cardsharp
('cardsharp-receipt', 'Cardsharp', 'Receipt reader', 'AI function that reads a gift-card receipt photo (on demand).',
 'edge-on-demand', true, 'none', null, null, null, false, null, null, 0,
 'It does not log runs yet — open the function logs to see recent calls.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/cardsharp-receipt/logs"}]',
 null, 20, now()),
('cardsharp-ynab', 'Cardsharp', 'YNAB sync', 'Pushes gift-card spend to YNAB (on demand).',
 'edge-on-demand', true, 'none', null, null, null, false, null, null, 0,
 'It does not log runs yet — open the function logs to see recent calls.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/cardsharp-ynab/logs"}]',
 null, 21, now()),
-- Optimo
('plan-day', 'Optimo', 'Day planner AI', 'AI function that plans the day (on demand).',
 'edge-on-demand', true, 'none', null, null, null, false, null, null, 0,
 'It does not log runs yet — open the function logs (a 401 there means the caller sent no signed-in token).',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/plan-day/logs"}]',
 null, 30, now()),
('planner-push-send', 'Optimo', 'Reminder push sender', 'pg_cron job that calls push-send every minute to deliver due reminders.',
 'pg-cron', true, 'cron', null, null, 'planner_push_send', true, null,
 '{"every":1}', 10, 'Check the cron history, then the push-send function logs.',
 '[{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"},{"label":"push-send logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/push-send/logs"}]',
 'cron:planner_push_send', 31, now()),
('planner-calendar-sync', 'Optimo', 'Calendar sync', 'pg_cron job that calls calendar-sync every 15 minutes.',
 'pg-cron', true, 'cron', null, null, 'planner_calendar_sync', true, null,
 '{"every":15}', 30, 'Check the cron history, then the calendar-sync function logs.',
 '[{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"},{"label":"calendar-sync logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/calendar-sync/logs"}]',
 'cron:planner_calendar_sync', 32, now()),
('planner-purge-tombstones', 'Optimo', 'Nightly tidy-up', 'Deletes planner rows soft-deleted more than 30 days ago.',
 'pg-cron', true, 'cron', null, null, 'planner_purge_tombstones', false, null,
 '{"every":1440}', 120, 'Check the cron job history; re-run if it failed.',
 '[{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"}]',
 'cron:planner_purge_tombstones', 33, now()),
-- FSA Claims Tracker
('fsa-capture', 'FSA Claims Tracker', 'Receipt capture inlet', 'Gmail inlet that should hand FSA receipts to the fsa-capture agent every 10 minutes.',
 'inlet', true, 'runs-alive', 'fsa', 'fsa-capture', null, false, null,
 '{"every":10}', 50,
 'It has never received a tick — the Gmail Apps Script trigger for FSA capture is not set up (or points at the wrong URL).',
 '[{"label":"Apps Script","url":"https://script.google.com/home"},{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/fsa-capture/logs"}]',
 null, 40, '2026-09-18'),
('fsa-ynab-sync', 'FSA Claims Tracker', 'YNAB sync', 'Matches FSA claims against YNAB (on demand).',
 'edge-on-demand', true, 'runs-event', 'fsa', 'fsa-ynab-sync', null, false, null, null, 0,
 'Open the function logs.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/fsa-ynab-sync/logs"}]',
 null, 41, now()),
('fsa-monthly', 'FSA Claims Tracker', 'Monthly claims run', 'Mac Desktop scheduled task on the 1st at 9:00.',
 'mac-task', true, 'checkin', null, null, null, false, null,
 '{"monthly":{"dom":1,"at":"09:00"}}', 1440,
 'Wake the Mac, open Claude Desktop → Scheduled, and run "fsa-monthly" now.',
 '[]', null, 42, now()),
-- Giving Tracker
('capture', 'Giving Tracker', 'Donation reader', 'Reads donation receipts from Gmail with Haiku and files them.',
 'inlet', true, 'runs-event', 'giving', 'capture', null, false, null, null, 0,
 'Open the function logs for the failing call.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/capture/logs"}]',
 null, 50, '2026-09-12'),
('gmail-capture-inlet', 'Giving Tracker', 'Gmail inlet (Apps Script)', 'Apps Script that polls Gmail every 10 minutes and posts to capture.',
 'inlet', true, 'runs-alive', 'giving', 'capture', null, false, null,
 '{"every":10}', 50,
 'Open Apps Script → Triggers and check the time-driven trigger is still there and not erroring.',
 '[{"label":"Apps Script","url":"https://script.google.com/home"}]',
 null, 51, '2026-09-12'),
('import-extract', 'Giving Tracker', 'Import reader', 'AI function that extracts donations from an uploaded file (on demand).',
 'edge-on-demand', true, 'runs-event', 'giving', 'import-extract', null, false, null, null, 0,
 'Open the function logs.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/import-extract/logs"}]',
 null, 52, now()),
('propublica', 'Giving Tracker', 'Charity lookup', 'Looks charities up on ProPublica (on demand).',
 'edge-on-demand', true, 'none', null, null, null, false, null, null, 0,
 'It does not log runs yet — open the function logs to see recent calls.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/propublica/logs"}]',
 null, 53, now()),
('ynab-sync', 'Giving Tracker', 'Nightly YNAB sync', 'pg_cron job giving-ynab-nightly (switched off).',
 'pg-cron', false, 'cron', null, null, 'giving-ynab-nightly', true, null,
 '{"every":1440}', 120, 'Switched off on purpose.', '[]', null, 54, now()),
-- The Council
('snag-inlet', 'The Council', 'Snag inlet', 'Siri "Snag" → Haiku classifies → GitHub issue (on demand).',
 'inlet', true, 'runs-event', 'council', 'snag-inlet', null, false, null, null, 0,
 'Open the function logs for the failing call.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/snag-inlet/logs"}]',
 null, 60, '2026-09-26'),
('snag-train', 'The Council', 'Snag train', 'Mac Desktop scheduled task on the 2nd at 9:00 — works the snag backlog.',
 'mac-task', true, 'checkin', null, null, null, false, null,
 '{"monthly":{"dom":2,"at":"09:00"}}', 1440,
 'Wake the Mac, open Claude Desktop → Scheduled, and run "Snag train" now.', '[]', null, 61, now()),
('steward-audit', 'The Council', 'Steward audit', 'Mac Desktop scheduled task on the 1st at 9:00 — plugin drift audit.',
 'mac-task', true, 'checkin', null, null, null, false, null,
 '{"monthly":{"dom":1,"at":"09:00"}}', 1440,
 'Wake the Mac, open Claude Desktop → Scheduled, and run "Steward audit" now.', '[]', null, 62, now()),
('cowork-popup-watch', 'The Council', 'Cowork pop-up bug watch', 'Cloud scheduled task every Monday 8:52 — checks whether the Cowork Supabase pop-up bug is fixed.',
 'cloud-task', true, 'checkin', null, null, null, false, null,
 '{"weekly":{"dow":1,"at":"08:52"}}', 360,
 'Open Scheduled tasks on claude.ai and run "Watch: Cowork Supabase pop-up bug" now.',
 '[{"label":"Scheduled tasks","url":"https://claude.ai/code/scheduled"}]', null, 63, now()),
-- Marquee (the monitor's own machinery)
('agent-watch', 'Marquee', 'Agent watcher', 'Checks everything on this page every 15 minutes and alerts (push + email) when something changes.',
 'edge-cron', true, 'runs-work', 'marquee', 'agent-watch', null, false, null,
 '{"every":15}', 30, 'Open the function logs; re-run it.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/agent-watch/logs"},{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"}]',
 'cron:agent-watch', 70, now()),
('agent-health-notifier', 'Marquee', 'Watcher of the watcher', 'GitHub Action (hourly-ish) that fails — and GitHub emails — if the agent watcher stops.',
 'gh-action', true, 'runs-alive', 'marquee', 'agent-health-notifier', null, false, null,
 '{"every":60}', 1500, 'Open the workflow; re-enable it if GitHub disabled the schedule.',
 '[{"label":"Workflow runs","url":"https://github.com/schnubsy/press/actions/workflows/agent-health-notifier.yml"}]',
 null, 71, now()),
('agent-fix', 'Marquee', 'Fix button', 'Admin-only retry behind the Fix buttons on this page (on demand).',
 'edge-on-demand', true, 'runs-event', 'marquee', 'agent-fix', null, false, null, null, 0,
 'Open the function logs.',
 '[{"label":"Function logs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/functions/agent-fix/logs"}]',
 null, 72, now()),
('marquee-agent-heartbeat', 'Marquee', 'Legacy heartbeat', 'Old daily job that marks silent agents dead (superseded by the watcher).',
 'pg-cron', true, 'cron', null, null, 'marquee-agent-heartbeat', false, null,
 '{"every":1440}', 120, 'Check the cron job history.',
 '[{"label":"Cron jobs","url":"https://supabase.com/dashboard/project/eepjhpyziczrxvirczio/integrations/cron/jobs"}]',
 'cron:marquee-agent-heartbeat', 73, now())
on conflict (id) do nothing;
