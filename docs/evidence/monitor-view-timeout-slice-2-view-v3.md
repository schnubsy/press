# monitor-view-timeout — slice 2 — the view's cron branch, cheap (done-proof)

Files: `db/20261115_agent_monitor_view_v3.sql` (guard + `create or replace view` + grants) · rollback
`db/20261115_agent_monitor_view_v3_rollback.sql` (the LIVE definition, `pg_get_viewdef(…, true)`, md5
`7b0ddf18fea7ae19e0eb8508e7507012` — the local capture's md5 was checked equal to the live md5). Applied live only at
verify (STAGED). The rollback lives in `db/` (precedent `db/20260922_perth_rls_gate_rollback.sql`), not
`docs/evidence/` as the order named, because evidence is cleared each arc and a code test reads it. Every read below was a SELECT / EXPLAIN on project `eepjhpyziczrxvirczio`; nothing was written.

## What changed
Only the `cf` CTE (`cf_jobs` + `cf`); `e`, `runs`, `rf`, `costs`, `f`, `g`, `s` and the final SELECT are byte-identical to
the live definition (enforced by `test/monitor-view-timeout.test.mjs`). `cf` is now one LATERAL aggregate per monitored
cron job (no sort) and the last success message by primary key (`runid = max(runid) filter succeeded`) instead of
`array_agg(return_message ORDER BY start_time DESC)`.

## Same values (read-only diff, 2026-11-15, the exact v3 SELECT as a subquery beside the live view, one statement ⇒ one `now()`)
| | live view | v3 |
|---|---|---|
| rows | 28 | 28 |
| md5 of every row, every column (`to_jsonb`, ordered by id) | `5592663927eda72fafaafe21dcb349c9` | `5592663927eda72fafaafe21dcb349c9` |
| ids whose row differs | — | none |

Status / watch_status per row at that read (both sides): agent-fix no-data · agent-health-notifier healthy · agent-watch
healthy · amazon-memos healthy · capture healthy · card-scout healthy · card-scout-prune healthy ·
card-scout-weekly-store-check healthy · cardsharp-receipt no-data · cardsharp-ynab no-data · chrome-preflight off ·
cowork-popup-watch off · fsa-capture off · fsa-monthly late · fsa-ynab-sync no-data · gmail-capture-inlet healthy ·
import-extract no-data · marquee-agent-heartbeat healthy · plan-day no-data · planner-calendar-sync healthy ·
planner-purge-tombstones healthy · planner-push-send healthy · propublica no-data · snag-inlet healthy · snag-train failed ·
steward-audit failed · steward-watch healthy · ynab-sync off (watch_status = status for each).
The cron branch alone (old `cf` vs v3 `cf`, all 6 columns, EXCEPT both ways): 0 / 0 rows differ — also after the slice-1
prune predicate (slice-1 evidence).

## Cost (EXPLAIN ANALYZE, read-only)
| | before (live view) | v3 |
|---|---|---|
| whole view, today's unpruned table | 949 ms (timing on) · 533 ms (timing off) | 563 ms (timing off; select list abbreviated, same CTEs) |
| cron branch | GroupAggregate over a Sort of 61,561 rows, **external merge, Disk 4,896 kB** | 6 × (Aggregate over a seq scan, no Sort) + 6 pkey lookups: 152–223 ms |
| external-merge sort in the cron branch | yes | **none** |

**< 200 ms is NOT met on today's table, and is not claimed.** No index can be added (cron.job_run_details is owned by
`supabase_admin`), so each per-job scan reads the whole table: today 80.6k rows; after slice 1's prune 25.2k (×0.31).
The remaining time is the unchanged `runs` branch (all-time `press_agent_runs`, 22,950 rows, materialised to temp and
re-scanned 11× by the last-note subquery: ~3,476 temp blocks). Measuring after the prune needs the deploy, so the
`< 200 ms` check is a **postcondition at verify** (staged-deploy step 4); the `runs` branch is the next step if it misses.

## Scoped test
`node --test test/monitor-view-timeout.test.mjs` → tests 9 · pass 9 · fail 0.
