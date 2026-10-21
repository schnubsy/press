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

## 2026-10-21 — publish Vantage App Lab (onboarding tour) + catalog row

Work order — publish Vantage App Lab (onboarding tour) + catalog row

Repo: schnubsy/press (GitHub: schnubsy/press)
HOME: github:schnubsy/press
BRANCH: arc/publish-vantage-onboarding-tour
DEPLOYS: none
PUBLISH TARGETS: none (press is the home)
SLICES: 2 · SINGLE-SLICE JUSTIFICATION: none · EFFORT: S
Source: chat verify of schnubsy/vantage PR #29 (docs/evidence/verify-2026-10-21.md on vantage main). Mark's go 2026-10-21.

S1 — Rebuild + publish the Vantage App Lab release from vantage MERGED main
- `gh repo clone schnubsy/vantage ../vantage` (attached to this session) at origin/main (merge 9ef418c; main is now
  stamp/verify commits on top — `web/`+`shared/` unchanged since 8f70424).
- `cd ../vantage/web && npm ci && npm run build:press && PRESS_DIR=<this press clone> node tools/build-app-lab.mjs`.
- The resulting file list must equal the staged list in vantage `docs/evidence/polish-onboarding-tour-staged-press.md`
  (index.html M; 5 hashed assets A; 5 old hashed assets D; app-lab.html / frame.html / prototypes.json / pages.json unchanged).
  Any difference: STOP and report.
- Press FULL gauntlet. Known baseline: tenants-check's 21 rows for the 7 private tenant repos outside this session's
  scope = BLOCKED (scope), identical on main — every App Lab row (T1–T4, T8, T9) must PASS. WebKit/ui-audit PARTIAL (egress)
  is the known baseline too.
- Done: App Lab rows pass; after merge, `https://schnubsy.github.io/press/app-lab/vantage/` returns 200, serves the new
  `index-*.js`, and that bundle contains a string only the tour build has ("Take the tour"); `git hash-object
  app-lab/vantage/index.html` == the GitHub blob SHA.

S2 — Catalog marquee row (press_catalog) — Vantage described + live
- The council data already landed (schnubsy/council 76a3a6c, `environment/catalog/press-content.sql`, expected read-back
  sha256 `cc7780e984817051c4cc6ff8d1dcda4a44ea5fc58c5cb9c44f30c3e6f6278911`, octet_length 100529). Live row is still
  `86ec7381…5a43`: the chat's connector UPDATE was auto-cancelled twice by the destructive pop-up (claude-code #94450).
- Apply it via the Supabase connector (`execute_sql`, project eepjhpyziczrxvirczio) as the guarded replace-UPDATE
  `... where id='catalog' and sha256='86ec7381cbaf413dd675d8ba18f0d4790651b458bc83f3e88f2719caaa305a43'` (or the full
  upsert from council's press-content.sql). Read back: stored sha == computed `encode(sha256(convert_to(body,'UTF8')),'hex')`
  == `cc7780e9…6911`.
- If the connector cancels again: write it as `db/20261021_catalog_vantage_live.sql` (the guarded UPDATE) in this PR,
  report `catalog row: BLOCKED (#94450) — needs press on the Council deployer allowlist`, and continue the close.
- Done: read-back matches, or the BLOCKED row + staged SQL file.

Close per the council arc instrument: one full gauntlet → full close → PR → D1 → merge → reconcile → stamp → ship proof
→ report as PR comment. Last line: Chat: run verify
