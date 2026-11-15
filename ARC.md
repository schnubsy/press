## 2026-11-15 — monitor-view-runs-branch — finish the Agent Monitor view speed-up

Work order — monitor-view-runs-branch: finish the Agent Monitor view speed-up (the runs branch) + harden fetchRows

Repo: schnubsy/press
HOME: github:schnubsy/press
LANE: Full (extras: db)        (recommended — db/ view SQL + a monitor script)
BRANCH: arc/monitor-view-runs-branch
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
Read CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md; + one Explore sub-agent over lessons + history (Full lane) — read
docs/history/2026-11-15-monitor-view-timeout.md, its evidence files and docs/evidence/verify-2026-11-15.md first.

CONTEXT (verified 2026-11-15 by the chat at verify of PR #63, read-only)
- Live view = v3 (db/20261115_agent_monitor_view_v3.sql). After the first prune (cron.job_run_details 25,232 rows),
  EXPLAIN ANALYZE (timing off) = 317.6 ms; target < 200 ms.
- Remaining cost: the `runs` CTE reads ALL-TIME press_agent_runs (~22,956 rows, oldest 2026-09-12), is materialised
  and re-scanned: `rf` aggregate, `c` (40-day costs), SubPlan "last note" (Limit/Sort over the whole CTE, loops=11,
  ~22.6k rows removed per loop), SubPlan over press_deals. `n_runs` is only ever tested `= 0`.
- Index press_agent_runs_app_agent_finished_idx (app, agent, finished_at) exists and is under-used.

=== SLICE 1 — the runs branch, index-backed (db) ===
Scope: rewrite only the `runs`-fed parts (rf, c, the last-note SubPlan, and anything else reading `runs`) so each monitored
item does bounded, index-backed lookups (e.g. per-id LATERAL with order by finished_at desc limit 1 / filtered max,
a 40-day bounded scan for costs, EXISTS for n_runs>0 where only =0 is tested) instead of materialising all-time rows.
Files in play: db/2026111X_agent_monitor_view_v4.sql (guard on the live v3 md5 + `create or replace view`, same columns,
same grants), db/2026111X_agent_monitor_view_v4_rollback.sql (the live v3 definition captured read-only, md5-guarded),
test/monitor-view-timeout.test.mjs (or a new test) — the unchanged CTEs stay byte-identical, enforced by test.
An index on press_agent_runs is allowed if needed (it is a public table) — say which and why.
Done-criteria: all rows, every column md5-identical to the live view (read-only, one statement ⇒ one now());
EXPLAIN ANALYZE (timing off, read-only) < 200 ms, no temp/disk spill; evidence committed. Live apply = STAGED deploy.
If n_runs semantics must change to get there, keep the output value identical (e.g. a capped count only if the view
never shows it — prove where n_runs is read: view, agent-health.html, agent-watch).

=== SLICE 2 — fetchRows hardening (script) ===
Scope: .github/scripts/agent-health-check.mjs — (a) each fetch attempt gets an AbortSignal timeout (~20 s) and a timeout
counts as a transient error (retried like a network error); (b) a 200 with an unparseable / non-JSON body fails with the
existing "Not reporting healthy on a failed check" wording (via fail()), never an unhandled throw.
Files in play: .github/scripts/agent-health-check.mjs, test/monitor-view-timeout.test.mjs. Workflow file unchanged.
Done-criteria: unit tests — hang then 200 ⇒ OK (fake timer/injected signal), hang ×3 ⇒ exit 1 with the message,
200 + bad JSON ⇒ exit 1 with the message; scoped run cited.

=== SLICE 3 — db/ mirror drift ===
Scope: the live migration `20261106185336 press_agent_due_times_multi_dow` has no db/ mirror (PR #63 gates evidence).
Files in play: db/20261106_press_agent_due_times_multi_dow.sql (new — the live function definition, read-only via
pg_get_functiondef / list_migrations), no live apply (it is already live).
Done-criteria: the mirror's function body == the live definition (read-only md5 compare), cited in evidence.

STAGED DEPLOY (docs/evidence/monitor-view-runs-branch-staged-deploy.md): view v4 (+ any index) through the Council
deployer after merge; precondition = live view md5 == v3; postconditions = same 29-row id/status/watch_status snapshot,
< 200 ms; rollback = the v4_rollback file (+ drop the index if one was added).

RETURN POINTS: arc-complete, or genuinely blocked.
