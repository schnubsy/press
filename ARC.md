## 2026-10-21 — Vantage App Lab release (whiteboard, colours, tour, fonts)
SLICES: 1 · SINGLE-SLICE JUSTIFICATION: dependency — the build is the merged vantage main (PR #30), only known after that merge · EFFORT: S · DEPLOYS: none
HOME: github:schnubsy/press · BRANCH: arc/vantage-app-lab-tour-fonts · PUBLISH TARGETS: none
Source: chat verify of vantage PR #30 (`docs/evidence/verify-2026-10-21-2.md` in schnubsy/vantage) dispatched its STAGED press half here.

### S1 — Rebuild and publish the Vantage App Lab release
- Clone schnubsy/vantage as a sibling, at main `76da0c2` (merge `39c2a02`; `web/` + `shared/` unchanged since `ff50538`).
- Rebuild from merged main exactly as the last release did: `cd web && npm ci && npm run build:press`, then
  `PRESS_DIR=<this clone> node tools/build-app-lab.mjs` (vantage repo). Only `app-lab/vantage/**` changes;
  app-lab.html / frame / prototypes.json / pages.json untouched.
- Compare with vantage `docs/evidence/whiteboard-tour-fonts-staged-press.patch` (54 files, base press `96ad977`): same file
  list; note any byte differences in evidence.
- press FULL gauntlet; tenants-check rows for App Lab must pass (rows for private tenant repos this session cannot clone
  are BLOCKED (access), as last time — recorded, not routed around).
- Done: live `https://<press site>/press/app-lab/vantage/` returns 200; its index.html references the new hashed bundle;
  the bundle contains "Take the tour" and the Whiteboard chunk contains "Stroke smoothing"; `git hash-object` of each
  published file == its GitHub blob SHA on main. Evidence in docs/evidence/vantage-app-lab-tour-fonts.md.
