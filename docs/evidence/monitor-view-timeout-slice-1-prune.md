# monitor-view-timeout — slice 1 — prune pg_cron history (done-proof)

File: `db/20261115_cron_history_prune.sql` (function `public.press_cron_history_prune()`, pg_cron job
`cron-history-prune` `41 9 * * *`, monitor row `cron-history-prune`). Applied live only at verify (STAGED —
`monitor-view-timeout-staged-deploy.md`). Nothing below wrote to the database.

## Facts read (Supabase `eepjhpyziczrxvirczio`, read-only, 2026-11-15)
- `cron.job_run_details` owner `supabase_admin`; `postgres` can DELETE, is not a member of the owner role ⇒ **no index
  can be added** on `(jobid, start_time)` (slice 2 relies on the lateral + this prune).
- Rows by job (before): planner_push_send 70,189 · planner_calendar_sync 4,679 · agent-watch 3,285 · card-scout-scheduled
  2,194 · marquee-agent-heartbeat 65 · card-scout-prune 55 · planner_purge_tombstones 50 · github-usage-alert 46 · giving-ynab-nightly 1.

## Read-only simulation of the exact predicate (a SELECT over the would-be survivors — never a delete)
| | value |
|---|---|
| rows now / would delete / after | 80,570 / 55,338 / 25,232 (re-read with the file's own DELETE predicate as a `count(*)`: 55,343 of 80,575 minutes later) |
| sub-hourly jobs (15-day rule) | jobid 4, 8, 9, 10 (card-scout-scheduled, planner_push_send, planner_calendar_sync, agent-watch); all others 45 days |
| after, by job | 1=1 · 2=45 · 3=45 · 4=570 · 6=45 · 8=21,600 · 9=1,440 · 10=1,440 · 11=46 |
| view cron evidence, full vs pruned (work_at, alive_at, fail_at, any-runs, last message — 6 monitored jobs) | **0 / 0 rows differ** (EXCEPT both ways) |
| 14-day strip cron rows (jobid × CT day × succeeded/failed), full vs pruned | **0 / 0 rows differ** |
| `EXPLAIN` (no ANALYZE) of the file's DELETE | plans (syntax + permissions resolve) |

The view's id / status / status_reason / watch_status set is a function of those cron evidence values plus inputs this
prune does not touch, so it is unchanged (the full 28-row before/after identity is in slice 2's evidence).
`n_runs` drops for sub-hourly jobs but the view only tests it for `= 0` (preserved: the latest run is always kept).

## Deviation from the order (named)
The order said "older than 2 days" for sub-hourly jobs. 2 days would blank 12 of the 14 strip days for
planner-push-send and planner-calendar-sync on agent-health.html. 15 days (the strip's own window) keeps every
visible value identical; it is one constant to tighten if the chat prefers 2 days (strip loss accepted).

## Scoped test
`node --test test/monitor-view-timeout.test.mjs` → tests 5 · pass 5 · fail 0 (duration 90 ms).
