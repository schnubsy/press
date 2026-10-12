# steward-report — D1 merge review (arc.md "Merge policy (D1)")

The reviewer was a fresh-context general-purpose sub-agent that did not write the change. Its inputs were PR numbers,
the ARC.md block and the diffs only.
- schnubsy/press PR #36 @ `1316095`
- schnubsy/council PR #28 @ `9e6b45d`

It ran `node --test test/steward-reports.test.mjs` (10/10) and `test/steward.spec.mjs` (8/8).

**VERDICT: no 🔴.** It was conditional on one check, which the Builder ran (below) and which came back clean.

## Findings
| sev | finding | disposition |
|---|---|---|
| 🟡 → conditional 🔴 | If anon could read PostgREST's OpenAPI (`GET /rest/v1/`), the `press_deals.sync_id` column default (the capability) might be exposed. | **CHECKED CLEAN.** pg_net GET `/rest/v1/` with the publishable key and `accept: application/openapi+json` returned **401 "Secret API key required — Only secret API keys can be used for this endpoint."** The default appears nowhere in the body (boolean check in SQL; the value was never printed). |
| 🟡 | A later Card Scout hardening arc could drop or change the `sync_id` default, which would make Steward deny silently. | Carried. HANDOFF next step 3 now adds a done-criterion: `press_steward_capability_ok(<real key>)` still returns true. |
| 🟡 | The fixture row is still in the live table. | Already handled. It sits outside the read window, and the guarded delete is Mark's step 1. |
| 🟢 | HANDOFF referenced this file before it existed. | This file. |
| 🟢 | Merge-state lines still read "PR pending". | Handled by the post-merge stage stamp. |
| 🟢 | Slice-2 evidence describes the v1 gate. | Evidence is append-only and slice-3 supersedes it. |
| 🟢 | localhost CORS | Matches the council `_shared/cors` policy; the capability is still required. |

## Gates at merge
- Gauntlet `steward-report-slice-3-gauntlet.txt`:
  - unit 101/0, inline ✓, Playwright 88 + 1 WebKit-only skip.
  - tenants-check: steward rows PASS. Its 21 FAILs are all "tenant repo MISSING at /home/claude/<repo>", because seven tenant repos are outside this cloud session's GitHub scope; it is identical on base and not this PR's.
- PR CI: none configured on press or council (no `pull_request` workflows).
