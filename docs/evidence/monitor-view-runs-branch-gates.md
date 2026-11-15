# monitor-view-runs-branch — gates on the final head c226645 (Full, extras: db)

## Gauntlet — `LANE=full PRIMARY=iphone-webkit EXTRAS=db EVIDENCE=monitor-view-runs-branch bash scripts/gauntlet.sh`
Run once, last, on HEAD c226645 (2026-11-15T21:26:59Z, node v22.23.4); log `monitor-view-runs-branch-gauntlet.txt`.
| stage | result |
|---|---|
| unit (`npm test`) | 🟢 231 tests · 231 pass · 0 fail |
| build (`inline:check`) | 🟢 |
| Playwright iphone-webkit (every spec + axe) | 🟢 34 passed |
| Playwright desktop | 🟢 124 passed |
| db (`run_db_readback`) | 🟡 PARTIAL by design until the read-back is cited — **cited below ⇒ closed** |
Exit 2 (PARTIAL) only for the db reminder; no RED stage, no flaky retry reported. No ui-audit (`VIEWS=` empty — no page,
CSS or view file changed).

## db read-back (Supabase connector, read-only, 2026-11-15)
- `list_migrations` vs `db/`: the last live migration `20261106185336 press_agent_due_times_multi_dow` now has its mirror
  (`db/20261106_press_agent_due_times_multi_dow.sql`, md5 == live — slice-3 evidence). This arc applied no DDL: view v4 is
  STAGED (`monitor-view-runs-branch-staged-deploy.md`), its db/ file is the source the deployer applies.
- Live view is v3 (`md5(pg_get_viewdef) = a2a900ff…` == `db/20261115_agent_monitor_view_v4_rollback.sql`).
- anon / RLS probe (`begin read only; set local role anon; …`): anon reads `press_agent_monitor_public` (29 rows); anon has
  no INSERT on it and no direct SELECT on `press_agent_runs`; the view is owner-security (`reloptions` null). v4 reads the
  same six relations as v3 (press_agent_expect, press_agent_runs, press_deals, press_agent_watch_state, cron.job,
  cron.job_run_details) with the same grants — nothing widened (test `grants as v3`).

## Sentry (secrets scan of the diff, origin/main..c226645)
- Local scan of every added line for JWT / `sb_secret` / `ghp_` / `github_pat_` / `sk-` / AWS keys / `password=` /
  `api_key=` literals: **0 hits** (the one match is a removed line of deleted evidence describing the patterns).
- GitHub `run_secret_scanning`: unavailable — "Repository does not have GitHub Advanced Security enabled" (reported, not
  routed around).
- No dependency change (package.json: only the test list). Threat sketch: no new data, flow or reader — the same public
  status view with the same columns and grants; the GH script reads only the publishable key, as before.
