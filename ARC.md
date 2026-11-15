- 2026-11-13 · cardsharp arc/own-origin-pilot (Full; one writer on press — this patch): gate.js own-origin mode + the 7-day seal retired (vault.js), wing OWN_ORIGIN card + one-time Move, tenants.json `origin` + tenants-check T11, cardsharp.html → redirect stub. Source + runbook: schnubsy/cardsharp.

## 2026-11-15 — monitor-view-timeout — stop the Agent Monitor status view timing out

Work order — monitor-view-timeout: stop the Agent Monitor status view timing out (PostgREST 57014)

Repo: schnubsy/press
HOME: github:schnubsy/press
LANE: Full (extras: db)        (recommended — the diff touches db/ SQL + a monitor script)
BRANCH: arc/monitor-view-timeout
PUBLISH TARGETS: none (the SQL ships through the Council deployer after merge — STAGED deploy)
DATA: none (no teach/score/tune path)
SLICES: 3 · SINGLE-SLICE JUSTIFICATION: none
/goal close-out manifest all DONE/N/A/STAGED, gauntlet + sentry green, verify evidence committed

STANDING RULES (verbatim in every order)
(1) Batch every question up front, then run every slice back-to-back. Return only at arc-complete or a real blocker.
(2) Branch arc/<slug>. `git add` by name only; never `rm -rf` (CLAUDE.md → "Project rules").
(3) PER SLICE: extend the tests → build/lint clean → SCOPED checks only (testing.md → "Test budget") → done-proof
    citing that run in docs/evidence/<arc>-slice-<N>-<name>.<ext> → commit `feat: slice <N> — <summary>` → tick the slice
    `Status: done <sha>` in ARC.md and commit (tick + commit only — handoff.md STEP 4).
(4) ARC-COMPLETE CLOSE: FULL CLOSE FIRST, so it ships in the PR: /council:handoff (handoff.md) → the gates LAST,
    on the final head (gauntlet + sentry at the lane's stages) → push → PR → the D1 gate ("Merge policy (D1)") →
    STOP with the PR open. Post-merge steps belong to whoever runs after the merge (the chat at
    verify): reconcile (origin/main == the merge SHA) → any STAGED publish / deploy / cross-repo write (dispatch.md → "Cross-repo writes"; verify.md §3a) with SHIP PROOF
    (control-files.md → "Verify the artifact"). A publish before the merge is a RED close.
    Report: commits · PR + reviewed head · evidence · ship proof · `test time:` · the CLOSE-OUT MANIFEST · the sync
    canary (council only — handoff.md → "Canary") — posted as the PR's FINAL COMMENT and returned to the dispatcher;
    its last line is `Chat: run verify`.
    A RED gate, or a 🔴 that cannot be fixed in-arc: stop at the last green slice, push, open the PR as DRAFT, report.
(5) Publishing and deploying are part of the close, strictly after the merge; a Builder STAGES them (it stops before
    the merge). Every release names its rollback path before it ships (snag.md → "Rollback").
(6) Never claim "deployed" / "published" / "live" from an exit code, a success line or a version number — ship proof.

ORIENT FIRST
Read CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md; + one Explore sub-agent over lessons + history (Full lane).

CONTEXT (verified 2026-11-15 by the chat, read-only — Supabase project eepjhpyziczrxvirczio)
- GitHub "Agent health notifier" failed 2026-11-15 06:42 + 18:55 UTC: `/rest/v1/press_agent_monitor_public` → HTTP 500,
  `proxy_status: PostgREST; error=57014` (statement timeout; anon ~3 s). agent-watch (service key) also hit it at 05:45 (8.3 s).
- EXPLAIN ANALYZE of the view: ~630 ms when idle; the cost is the cron branch — a seq scan of `cron.job_run_details`
  over 40 days (66k of 80.5k rows) + an external-merge sort spilling to disk; plus the `runs` CTE (~23k rows).
- `cron.job_run_details`: 80,531 rows since 2026-09-11, never pruned (no job touches it). 70,161 are `planner_push_send`
  (`* * * * *`, ~1,440 rows/day) — none of which the monitor needs beyond its last few runs. Growth is unbounded, so
  timeouts will get more frequent.
- The view's 40-day window exists for monthly schedules (press_agent_due_times looks back 40 days).

=== SLICE 1 — prune pg_cron history (db) ===
Status: done 8f76e34
Scope: bound cron.job_run_details so the view's cron branch stays small, without changing any monitor status.
Files in play: db/2026111X_cron_history_prune.sql (new), test for it.
Implementation: a pg_cron job (e.g. `cron-history-prune`, daily, off the hour) that deletes `cron.job_run_details`
rows older than 45 days for every job, AND rows older than 2 days for jobs scheduled more often than hourly
(at minimum planner_push_send). Register it in press_agent_expect so the monitor watches the pruner too, following
the existing *_expect.sql pattern. Idempotent (re-runnable), grants per control-files.md.
Done-criteria: SQL file idempotent; a read-back query (read-only, via the connector) shows the view's id/status/watch_status
set BEFORE == what it computes against the post-prune predicate (prove with a read-only simulation, never a live delete);
evidence committed. The live DELETE/cron.schedule is a deploy → STAGED.

=== SLICE 2 — make the view's cron branch cheap (db) ===
Status: done 8625e1a
Scope: restrict the cron subquery to the jobs press_agent_expect actually names before it touches job_run_details,
and only the rows it needs (latest per job + the due-time window), so it no longer sorts every row to disk.
Files in play: db/2026111X_agent_monitor_view_v3.sql (new; `create or replace view`, same columns, same grants), test/agent-monitor.test.mjs.
Implementation: rewrite the `cf` (cron) part as a per-job LATERAL lookup (order by start_time desc limit N) or equivalent;
keep every output column and value identical. If an index on cron.job_run_details(jobid, start_time) is allowed in this
project, add it; if not, say so in evidence and rely on the lateral + slice 1.
Done-criteria: column list + every row's status/status_reason/watch_status identical to the current view (read-only diff
evidence); EXPLAIN ANALYZE (read-only) execution time < 200 ms with no external-merge sort; evidence committed.
The live `create or replace view` is a deploy → STAGED.

=== SLICE 3 — the watcher-of-the-watcher retries once (script) ===
Status: done 849c2bd
Scope: .github/scripts/agent-health-check.mjs must not fail the job on one transient 5xx / timeout.
Files in play: .github/scripts/agent-health-check.mjs, its test (test/agent-monitor.test.mjs or a new *.test.mjs).
Implementation: in fetchRows, on a network error or HTTP 5xx, wait ~10 s and retry up to 2 more times; only then die
with the existing "Not reporting healthy on a failed check" message (still never reports healthy on a failed check).
Print the attempt number in a ::warning:: on each retry. No change to assess(), exit codes or the workflow file.
Done-criteria: unit tests with a fake fetchImpl — 500 then 200 ⇒ OK; 500 ×3 ⇒ exit 1 with the message; network error
then 200 ⇒ OK; scoped test run cited in evidence.

STAGED DEPLOY (docs/evidence/monitor-view-timeout-staged-deploy.md): the two db/*.sql files, applied in order (view v3
first, then the prune job), via the Council deployer after merge; rollback = re-create the view from its LIVE
definition captured read-only today (`pg_get_viewdef('public.press_agent_monitor_public', true)` → committed as
docs/evidence/monitor-view-timeout-view-before.sql; the live view was string-patched by 20261013_agent_monitor_quiet_alerts.sql,
so no single db/ file holds it) + `cron.unschedule('cron-history-prune')` (deleted history is not restored — say so).

RETURN POINTS: arc-complete, or genuinely blocked.
