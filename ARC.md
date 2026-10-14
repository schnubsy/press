
## 2026-10-14 — pointer: thrift-shop rename (tenant-change arc)
CLOSED 2026-10-14 — press PR #44 merged `bd38aec` (thrift-shop PR #29 `ff3b592`); thrift-shop.html published, card-scout.html = redirect stub. Nothing to run here.

## 2026-10-14 — verify fixes: App Lab publish (vantage arc/web-twin S8)

HOME: github:schnubsy/press
BRANCH: arc/app-lab-publish
MAIN CHECKOUT: the cloud clone
INBOX FILES: none
PUBLISH TARGETS: schnubsy/council (snag registry row) · reads schnubsy/vantage (main @ c40a258)
DEPLOYS: press publish of app-lab.html + app-lab/vantage/ (family wing) and the `press_access_apps` row — Mark approved 2026-10-13 (vantage web-twin order)
SLICES: 2

**Why.** vantage PR #20 (merged `7b608f9`, stamp `c40a258`) staged the App Lab publish but could not push to press.
Chat verify 2026-10-14 re-staged it on press main `b01de06` (`npm --prefix web run build:press`, `git apply
docs/press/app-lab-marquee.patch`, `PRESS_DIR=… node web/tools/build-app-lab.mjs`) and ran the FULL press gauntlet:
RED on three counts the vantage report did not catch (it ran tenants-check only):
1. `test/access-names.test.mjs` — access.html `APP_NAMES` lacks `'app-lab.html':'App Lab'`.
2. `test/card-labels.spec.mjs:82` + `:98` (chromium + iphone-webkit) — the family-card / renamed-pairs expectations
   don't know App Lab.
3. tenants-check T8 — no council snag-registry row for `app-lab.html`.
(T2–T4 fails for other tenants were missing sibling clones — clone the tenant repos so tenants-check runs clean, or
record each as an environment SKIP with reason; T10 passes once app-lab.html is committed.)

**Decisions (Mark, 2026-10-13):** App Lab = ONE family-wing card → a subpage listing each in-development Apple web
prototype; Vantage is the first entry, served at `/press/app-lab/vantage/`, data local to the browser.

S1 — **council registry row** (council PR, its own CI): add the `app-lab.html` row to
`instruments/snag/registry.json` (repo `vantage`, family tier, mirror the other family rows; keep the snag-inlet copy
in sync if the council's tests require it). Merge per D1. Done = council origin/main has the row; tests green.
S2 — **press publish:** clone vantage (main) beside press; build + apply the patch + release script as above; add
App Lab to access.html `APP_NAMES`; update `test/card-labels.spec.mjs` for the new family card (icon `flask`);
apply `db/20261014_app_lab_access.sql` via the Supabase connector BEFORE the page ships (read it back: one row,
gated=true); `bash scripts/gauntlet.sh` GREEN with COUNCIL_DIR at the S1 council main; Lane A hash-verify →
commit → PR → D1 merge. Ship proof: `https://schnubsy.github.io/press/app-lab.html` 200 and gated (signed-out ⇒ the
family sign-in), `app-lab/vantage/` 200 and its JS asset 200; the index family wing shows the App Lab card (screenshot).
Then post a one-line comment on schnubsy/vantage PR #20: "App Lab published — press <merge sha>".
Carry for vantage's next arc (do NOT fix here): flaky `web/tests/e2e/inbox.spec.ts:27` (fixed 80 ms wait →
`expect.poll`), seen 1/508 under 4 workers in chat verify.
LAST line `Chat: run verify`.
