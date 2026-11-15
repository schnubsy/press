# monitor-view-runs-branch — merge review (D1)

Lane: Full (extras: db) · PR #64 · Reviewed head: c226645 (8296526 = gates + gauntlet evidence only)
One fresh-context reviewer (did not write the change), read-only: the ARC.md block (`git show 611fd74:ARC.md`), the PR
diff and the committed proof; re-ran nothing.

| round | reviewer | 🔴 | 🟡 | 🟢 | outcome |
|---|---|---|---|---|---|
| 1 | independent sub-agent | 0 | 2 | 16 | no 🔴 — no further round |

## Findings
- 🟡 Version guards are permissive by marker: v4's guard passes whenever the live view contains `cf_runs`, and v3's
  (`cf_jobs`) now passes against v4 — a hand re-apply of an OLD view file would silently revert a newer one. Safe for
  the staged deploy (precondition md5 = v3). → Exact next steps: pin each guard to "live md5 = its predecessor OR = its
  own rendered md5" once v4's rendered md5 is known at verify.
- 🟡 `fail_at` (and `work_at` for an item with no ok run) walks that item's runs through the index (~1.1k rows today);
  grows with press_agent_runs. Not correctness. → Exact next steps: partial index `(app, agent, finished_at desc) where
  outcome = 'error'` if the read creeps back toward 200 ms.
- 🟢 SQL equivalence (run key, rf row existence + COALESCE, n_runs cap only tested `= 0`, LIMIT 1 vs max on a NOT NULL
  column, costs, the two SubPlans, cf_runs max/sum, g MATERIALIZED), grants, script timeout / bad-JSON paths (no
  healthy-on-failure path), tests assert what they claim, the db/ mirror, scope deviation justified by measurement.

Verdict: no 🔴
