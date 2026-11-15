# monitor-view-runs-branch — slice 1 — the runs branch, index-backed (done-proof)

Files: `db/20261115_agent_monitor_view_v4.sql` (guard + `create or replace view` + grants) · rollback
`db/20261115_agent_monitor_view_v4_rollback.sql` (the LIVE v3, `pg_get_viewdef(…, true)`, body md5
`a2a900ff147518f278f072ecde2e93df`, 14,141 bytes — the local capture's md5 equals the live md5) ·
`test/monitor-view-runs-branch.test.mjs` (9 tests). Applied live only at verify (STAGED —
`monitor-view-runs-branch-staged-deploy.md`). Every read below ran inside `begin read only; … commit;` on project
`eepjhpyziczrxvirczio` (`current_setting('transaction_read_only') = on` checked); nothing was written.

## Where the time went (live v3, 2026-11-15, EXPLAIN ANALYZE timing off)
| cost | evidence |
|---|---|
| `runs` CTE: all-time press_agent_runs for 18 items, materialised, re-scanned 4× | 22,958 rows; `temp read=4108 written=316`; last-note SubPlan loops=11 × 22,647 rows removed |
| inlined g → s → SELECT repeats `press_agent_last_due()` (STABLE SQL, not visible in the plan) per textual use of `eff_due` | same expressions over press_agent_expect: **113.6 ms inlined → 20.8 ms with `g` MATERIALIZED** |
| cron branch: one seq scan of cron.job_run_details PER JOB (no index possible — owner supabase_admin) | 7 × 25.2k rows, 41,503 buffers; the branch alone 94.5 ms vs one grouped scan 17.5 ms |
Live view runs measured 334 – 749 ms (one sample 1,831 ms under load); the 2026-11-15 verify read was 317.6 ms.

## What changed (v4)
- `runs` removed. `ek` = each runs-fed item + its run key (`checkin` ⇒ `('task', id)`, every dead row kept; runs-* ⇒
  `(run_app, run_agent)`, `outcome <> 'dead'`) — the rows the two UNION ALL branches selected.
- `rf` = per item, LIMIT 1 lookups in `press_agent_runs_app_agent_finished_idx` order: work_at · alive_at · fail_at
  (`finished_at` is NOT NULL, so `ORDER BY finished_at DESC LIMIT 1` = `max(finished_at)`); `n_runs` capped at 1.
  **n_runs:** not a view column; its only test is `g.n_runs = 0` (status, `sched IS NULL`) — proven by the test, which also
  checks agent-health.html, agent-watch (`index.ts`, `watch-core.mjs`) and the GH health check never read it. Items with
  no runs keep `n_runs = 0` (v3: no rf row ⇒ `COALESCE(…, 0)`); cron / none items get no rf row, as before.
- `costs` = the 40-day window through the same index (`finished_at > now() - 40 days` in the Index Cond).
- last-note and deals-judged SubPlans read press_agent_runs by the same key, LIMIT 1 in index order (no Sort).
- `g AS MATERIALIZED` (body unchanged) — `eff_due` computed once per item.
- cron: `cf_runs` (MATERIALIZED) = ONE grouped scan by jobid; `cf` = max of maxes / sum of counts over its jobs
  (`COALESCE(sum, 0)::bigint` = v3's `count` 0); the `cf` SELECT list and last_msg lookup unchanged.
  This and `g` go beyond "only the runs-fed parts": the runs rewrite alone measured 243 ms (still > 200); with `g`
  145 ms; with both 85 ms. Both keep every value identical (below).
- **No index added** — every press_agent_runs read uses the existing `(app, agent, finished_at desc)` index.
  Noted, not fixed: `fail_at` for an item that has never errored walks that item's runs to the end (today 2,475
  buffers, ≤ 1,098 rows per item); a partial index `… where outcome = 'error'` would bound it if it ever matters.
- Unchanged, enforced by test: `e`, `cf_jobs`, `f` byte-identical; `g` = identical but `MATERIALIZED`; `s` + the final
  SELECT byte-identical outside the two SubPlans; grants as v3.

## Same values (read-only, one statement ⇒ one `now()`; v3 = the live view, v4 = the exact body as a subquery)
| | live v3 (1st) | v4 | live v3 (2nd) |
|---|---|---|---|
| rows | 29 | 29 | 29 |
| md5 of every row, every column (`to_jsonb`, ordered by id) | `a014e3192318cfe7a402f822fa3b2b0f` | `a014e3192318cfe7a402f822fa3b2b0f` | `a014e3192318cfe7a402f822fa3b2b0f` |
| wall time inside the statement (incl. to_jsonb) | 341.6 ms | **84.8 ms** | 255.8 ms |
An earlier candidate (runs rewrite + `g` only) also matched, md5 `eb07264e…` on all three sides of its statement.

id status/watch_status at that read (both sides): agent-fix no-data/no-data · agent-health-notifier healthy/healthy ·
agent-watch healthy/healthy · amazon-memos healthy/healthy · capture healthy/healthy · card-scout healthy/healthy ·
card-scout-prune healthy/healthy · card-scout-weekly-store-check healthy/healthy · cardsharp-receipt no-data/no-data ·
cardsharp-ynab no-data/no-data · chrome-preflight off/off · cowork-popup-watch off/off · cron-history-prune no-data/no-data ·
fsa-capture off/off · fsa-monthly late/late · fsa-ynab-sync no-data/no-data · gmail-capture-inlet healthy/healthy ·
import-extract no-data/no-data · marquee-agent-heartbeat healthy/healthy · plan-day no-data/no-data ·
planner-calendar-sync healthy/healthy · planner-purge-tombstones healthy/healthy · planner-push-send healthy/healthy ·
propublica no-data/no-data · snag-inlet healthy/healthy · snag-train failed/failed · steward-audit failed/failed ·
steward-watch healthy/healthy · ynab-sync off/off (29 rows — the verify snapshot's 28 + `cron-history-prune`).

## Cost (EXPLAIN (ANALYZE, TIMING OFF, BUFFERS), read-only, the exact v4 body)
| | live v3 | v4 |
|---|---|---|
| Execution Time | 749.5 ms (334.7 ms in a later sample) | **156.4 ms** (with BUFFERS instrumentation) |
| shared buffers hit | 45,088 | 14,198 |
| temp read / written | 4,108 / 316 | **none** |
| Sort nodes over runs | 2 top-N heapsorts over the CTE (loops 11 + 1) | none (LIMIT 1 on index order) |
| cron.job_run_details scans | 7 seq scans | 1 seq scan (HashAggregate, 8 groups) |

## Scoped test
`node --test test/monitor-view-runs-branch.test.mjs test/monitor-view-timeout.test.mjs test/agent-monitor.test.mjs`
→ tests 41 · pass 41 · fail 0.
