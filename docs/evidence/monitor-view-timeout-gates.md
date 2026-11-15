# monitor-view-timeout — close gates (final head 403d8e0)

## Gauntlet — `LANE=full PRIMARY=iphone-webkit EXTRAS=db EVIDENCE=monitor-view-timeout bash scripts/gauntlet.sh`
Log: `docs/evidence/monitor-view-timeout-gauntlet.txt` (HEAD 403d8e0, 2026-11-15T20:52Z, WebKit 26.6).
🟢 unit (214 / 214) · 🟢 build (inline:check) · 🟢 Playwright iphone-webkit · 🟢 Playwright desktop · 🟡 `run_db_readback` —
the script's by-design reminder (exit 2 until the connector read-back is cited) ⇒ `GAUNTLET PARTIAL (other) — exit 2`.
Every executable stage is green; the PARTIAL is closed by the citation below.

## db extra — migration read-back (Supabase `list_migrations`, read-only, after the run)
- `db/20261115_agent_monitor_view_v3.sql` and `db/20261115_cron_history_prune.sql`: **not applied — as intended (STAGED for
  verify, `monitor-view-timeout-staged-deploy.md`)**; no migration named for them exists live.
- Latest live: `20261106185336 press_agent_due_times_multi_dow` — 🟡 pre-existing, not from this arc: it has no `db/` mirror.
- RLS / anon probe: no table, policy or grant changes; the view keeps `anon`/`authenticated` SELECT only (live grants read
  2026-11-15: anon SELECT · authenticated SELECT · service_role/postgres all) — restated unchanged in v3; the prune function has
  no anon / authenticated execute.

## Sentry — secrets scan of the diff (`origin/main...HEAD`, 15 files)
GitHub `run_secret_scanning`: unavailable ("Repository does not have GitHub Advanced Security enabled"). Fallback: pattern scan
of the full diff (JWT `eyJ…`, `sb_secret`/`sb_publishable`, `ghp_`, `sk-`, private-key blocks, `password=` / `api_key=` literals)
→ **0 hits**. The only key touched is read from env (`SUPABASE_PRESS_ANON_KEY`), unchanged.
