# monitor-view-timeout — STAGED deploy (the chat completes it at verify, strictly after the merge)

No cross-repo write: press `db/` is already an allowlisted migrations dir in council `deploy/targets.json`
(`schnubsy/press` → `migrations.dirs ["db/", …]`, project `eepjhpyziczrxvirczio`). Nothing was applied by the Builder.
Channel: the Council deployer (the prune file DELETEs — `surface.md` → "Supabase channel", the #94450 bullet). `<M>` = the merge SHA.

## 0. Precondition — the live view is still the one this arc was built from
```sql
select md5(pg_get_viewdef('public.press_agent_monitor_public'::regclass, true));   -- expect 7b0ddf18fea7ae19e0eb8508e7507012
select id, status, watch_status from public.press_agent_monitor_public order by id;  -- save: the BEFORE snapshot (28 rows)
```

## 1. View v3 first
`node <council>/tools/deploy-request.mjs --kind migration --repo schnubsy/press --sha <M> --project-ref eepjhpyziczrxvirczio --migration db/20261115_agent_monitor_view_v3.sql --push --wait 15`
Postcondition (expect: `true · 28`, then the same id/status/watch_status as the BEFORE snapshot):
```sql
select position('cf_jobs' in pg_get_viewdef('public.press_agent_monitor_public'::regclass, true)) > 0, (select count(*) from public.press_agent_monitor_public);
```
The guard aborts the file (no change) if the live view drifted since 2026-11-15 — then STOP, rebuild v3 from the live view.

## 2. Then the prune job
`node <council>/tools/deploy-request.mjs --kind migration --repo schnubsy/press --sha <M> --project-ref eepjhpyziczrxvirczio --migration db/20261115_cron_history_prune.sql --push --wait 15`
Postcondition (expect `cron-history-prune · 41 9 * * * · true · 1`):
```sql
select j.jobname, j.schedule, j.active, (select count(*) from public.press_agent_expect where id = 'cron-history-prune')
  from cron.job j where j.jobname = 'cron-history-prune';
```

## 3. First prune (optional — otherwise it runs at 09:41 UTC). It is a DELETE ⇒ through the deployer or the Fix button
(`cron:cron-history-prune`); postcondition: `select count(*) from cron.job_run_details;` ≈ 25k (80.6k on 2026-11-15), and
id/status/watch_status == the BEFORE snapshot (+ the new `cron-history-prune` row: `no-data` until its first run, then healthy).

## 4. Speed postcondition (not provable before the prune — slice-2 evidence)
`explain (analyze, timing off) select * from public.press_agent_monitor_public;` → Execution Time **< 200 ms** and no
`external merge` under the cron branch. If it misses, the remaining cost is the `runs` branch (all-time
`press_agent_runs`) — next arc, not a re-run of this one. Then dispatch the GH workflow "Agent health notifier" once and read it green.

## Rollback (named before it ships)
- View: apply `db/20261115_agent_monitor_view_v3_rollback.sql` (the captured live definition, same columns, grants kept).
- Prune: `select cron.unschedule('cron-history-prune'); delete from public.press_agent_expect where id = 'cron-history-prune';`
  (+ optionally `drop function public.press_cron_history_prune();`) — through the deployer (DELETE / DROP).
- **Deleted cron history is not restored** — rows older than 45 days (15 for sub-hourly jobs) are gone; no monitor status
  depends on them (slice-1 evidence).
- Slice 3 needs no deploy: the GH workflow reads the script from main at its next run; rollback = revert the commit.
