# monitor-view-timeout — merge review (D1)

Lane: Full (extras: db) · PR #63 · Reviewed head: cd2e273 · reviewer: one fresh-context sub-agent (diff + ARC block + committed proof; re-ran nothing)

| Round | Reviewer | 🔴 | 🟡 | 🟢 | Outcome |
|---|---|---|---|---|---|
| 1 | fresh sub-agent | 0 | 4 | 8 | no fix round needed |

🟡 (carried to Exact next steps, none blocks):
1. `< 200 ms` likely still misses after the prune — the unchanged `runs` branch (all-time `press_agent_runs`, temp-spilled, rescanned 11×) dominates; staged-deploy step 4 red ≠ regression. → next arc: the `runs` branch.
2. `agent-health-check.mjs` fetch has no timeout/AbortSignal — a hung connection is not retried (fails via the job time limit, never healthy; pre-existing). → next arc slice.
3. A 200 with an unparseable body throws unhandled (exit 1, fails closed, pre-existing). → same slice.
4. Prune's sub-hourly test also matches `@daily`/`$` syntax — harmless (latest runs always kept), no current job uses it.
🟢: prune predicate vs keep guard · max(runid) last_msg equivalence · v3 guard + grants · function security · retry flow · both deviations · evidence.

Verdict: no 🔴
