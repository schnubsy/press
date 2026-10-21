## 2026-10-21 — Publish thrift-shop.html (iphone-compact)

SLICES: 1 · SINGLE-SLICE JUSTIFICATION: dependency — one page publish from a merged source
EFFORT: S

Work order — Publish thrift-shop.html (iphone-compact)

HOME: github:schnubsy/press
DEPLOYS: none
BRANCH: arc/publish-thrift-shop-iphone-compact
PUBLISH TARGETS: none

Why: thrift-shop PR #33 (arc/iphone-compact) merged 95c72e1 (stamp cf1b6fa) and its card-scout v44 deploy is live (ezbr
c9f1dce7…, verified by the chat 2026-10-21). Its press publish was STAGED but the Builder could not run press's gauntlet
(press was outside its scope) — verify 3a step 4 ⇒ dispatched here. Mark asked for verify 2026-10-21 00:00 CT.

=== SLICE 1 — publish thrift-shop.html from thrift-shop merged main === [x] done 2026-10-21 (blob 2403c3bb; merge BLOCKED: tenants-check scope)
Rebuild from thrift-shop's MERGED main (never pre-merge bytes): clone schnubsy/thrift-shop as a sibling, checkout main
(must contain 95c72e1), `npm install`, `PRESS_DIR=<this clone> node tools/release.js --check` (must print no SKIPPED),
then `PRESS_DIR=<this clone> node tools/release.js`. Expected change: ONLY thrift-shop.html (card-scout.html stub,
pages.json, docs/favicons.md unchanged) — anything else ⇒ stop and report. Staged reference:
thrift-shop docs/evidence/iphone-compact-staged-press.{md,patch} (expected result blob 2403c3bb… from live d8818498…).
Run press's FULL gauntlet (incl. node tools/tenants-check.mjs + page checks).
Done: press main's thrift-shop.html blob == `git hash-object thrift-shop.html` at thrift-shop main AND changed from
d8818498…; live URL 200 (cache-bypassed) shows the one-row header (Feed · Sales · Gift cards · Sources · Settings beside
the logo); evidence in docs/evidence/.
