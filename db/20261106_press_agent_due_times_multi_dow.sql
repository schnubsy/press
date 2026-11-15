-- db/20261106_press_agent_due_times_multi_dow.sql — db/ MIRROR of the live migration 20261106185336
-- `press_agent_due_times_multi_dow` (applied 2026-11-06 for the twice-weekly store check: sched.weekly.dow may be one
-- weekday or a list). Added by arc monitor-view-runs-branch, slice 3 (2026-11-15) — it was applied live with no db/ file
-- (PR #63 gates evidence). NOT re-applied: it is already live.
-- The statement below is the migration's recorded statement (supabase_migrations.schema_migrations, version
-- 20261106185336) and equals pg_get_functiondef('public.press_agent_due_times(jsonb, timestamptz, timestamptz)') —
-- md5 646435c0d3c0bfdcdd166a114c7252b0 of that definition, read-only on 2026-11-15
-- (docs/evidence/monitor-view-runs-branch-slice-3-mirror.md). CREATE OR REPLACE keeps the function's existing grants.
CREATE OR REPLACE FUNCTION public.press_agent_due_times(p_sched jsonb, p_from timestamp with time zone, p_to timestamp with time zone)
 RETURNS SETOF timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  -- weekly.dow: one weekday (int 0-6) OR a list ([2,6] = Tue + Sat). 2026-11-06, twice-weekly store check.
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
        and extract(dow from days.d)::int = any (
          case when jsonb_typeof(p_sched -> 'weekly' -> 'dow') = 'array'
               then array(select jsonb_array_elements_text(p_sched -> 'weekly' -> 'dow')::int)
               else array[(p_sched -> 'weekly' ->> 'dow')::int] end)
      union all
      select p_sched -> 'monthly' ->> 'at' where p_sched ? 'monthly'
        and extract(day from days.d) = (p_sched -> 'monthly' ->> 'dom')::int
    ) t
  )
  select ts from cand where ts >= p_from and ts <= p_to order by ts;
$function$;
