# monitor-view-runs-branch — STAGED deploy (the chat completes it at verify, strictly after the merge)

No cross-repo write: press `db/` is already an allowlisted migrations dir in council `deploy/targets.json`
(`schnubsy/press`, project `eepjhpyziczrxvirczio`). Nothing was applied by the Builder (every read was
`begin read only; … commit;`). `<M>` = the merge SHA. **One file ships: the view v4.** No index is added; the slice-3
mirror (`db/20261106_press_agent_due_times_multi_dow.sql`) and the slice-2 script need no deploy (the mirror is already
live; the GH workflow reads the script from main at its next run).
Channel: the Council deployer (`surface.md` → "Supabase channel") — or the connector's `apply_migration` with the same
file, since it is a `create or replace view` (no drop / delete).

## 0. Precondition — the live view is still the v3 this arc was built from
```sql
select md5(pg_get_viewdef('public.press_agent_monitor_public'::regclass, true));   -- expect a2a900ff147518f278f072ecde2e93df
select id, status, watch_status from public.press_agent_monitor_public order by id;  -- save: the BEFORE snapshot (29 rows)
```
Any other md5 ⇒ STOP (the file's guard would abort anyway): rebuild v4 from the live definition.

## 1. View v4
`node <council>/tools/deploy-request.mjs --kind migration --repo schnubsy/press --sha <M> --project-ref eepjhpyziczrxvirczio --migration db/20261115_agent_monitor_view_v4.sql --push --wait 15`

Postconditions (read-only):
```sql
select position('cf_runs' in d) > 0 as is_v4, position('runs AS (' in d) = 0 as no_runs_cte, (select count(*) from public.press_agent_monitor_public) as n
  from (select pg_get_viewdef('public.press_agent_monitor_public'::regclass, true) d) v;      -- expect true · true · 29
select id, status, watch_status from public.press_agent_monitor_public order by id;           -- expect == the BEFORE snapshot
begin read only; set local role anon; select count(*) from public.press_agent_monitor_public; commit;   -- expect 29 (anon still reads it)
select has_table_privilege('anon','public.press_agent_monitor_public','insert');              -- expect false (grants as v3)
```
The Builder's snapshot (29 rows, 2026-11-15) is in `monitor-view-runs-branch-slice-1-view-v4.md`; statuses may move with
real runs between then and verify — the BEFORE snapshot of step 0 is the one to compare.

## 2. Speed postcondition
`explain (analyze, timing off) select * from public.press_agent_monitor_public;` → Execution Time **< 200 ms**, no `temp`
buffers, one `Seq Scan on job_run_details` (under `CTE cf_runs`), no Sort over `press_agent_runs`.
Builder's reads of the same body: 156.4 ms (with BUFFERS) and 84.8 ms in-statement (v3 beside it: 341.6 / 255.8 ms).
The project's timings swing 3–5× between samples; if one sample misses, take three and report the minimum and the spread.
Then dispatch the GH workflow "Agent health notifier" once and read it green (it also exercises slice 2's script).

## Rollback (named before it ships)
- View: apply `db/20261115_agent_monitor_view_v4_rollback.sql` (the captured live v3, body md5 `a2a900ff…`; same
  columns; CREATE OR REPLACE keeps the grants) — deployer or connector, it is a `create or replace view`.
  Postcondition: `md5(pg_get_viewdef(…, true)) = 'a2a900ff147518f278f072ecde2e93df'`.
- No index was added ⇒ nothing to drop.
- Slice 2 (script): revert the commit; the workflow reads main at its next run. Slice 3 (mirror): a file only.
