# Vantage App Lab release — whiteboard, colours, tour, fonts (arc/vantage-app-lab-tour-fonts S1)

Date: 2026-10-22 · cloud Builder (press home) · EFFORT S · PUBLISH TARGETS: none (press is the home; merge to main = publish)

## Build
- Source: schnubsy/vantage main `76da0c2` (fresh shallow clone at /home/user/vantage).
- `cd web && npm ci && npm run build:press` then `PRESS_DIR=<press clone> node tools/build-app-lab.mjs`.
- Changed: only `app-lab/vantage/**` — 54 paths (48 A · 2 R · 3 D · 1 M). app-lab.html, app-lab/frame.html,
  app-lab/prototypes.json, pages.json: unchanged (git status clean outside app-lab/vantage/).

## Compare with vantage `docs/evidence/whiteboard-tour-fonts-staged-press.patch` (base press 96ad977)
- Patch applied cleanly to a worktree at 96ad977; name-status lists: 54 vs 54, **identical**.
- `git hash-object` of every A/M file: **0 byte differences** — the rebuild == the staged patch.
- Note: the staged .md names `NotesEditor-KP0a8KtJ.js` / `TagPopover-Dhj_CtmY.js`; the patch itself (and this build)
  carry `NotesEditor-BBlVpwm1.js` / `TagPopover-qgezRyFd.js` — the .md prose is stale, the patch is the truth.

## Content checks (pre-merge)
- `app-lab/vantage/index.html` (blob `4e299e7608a231f5c7c0221a3df4b7431728d54b`) references `assets/index-BsNeUenB.js`.
- `index-BsNeUenB.js` contains "Take the tour" (1 hit) · `Whiteboard-C4E02ABj.js` contains "Stroke smoothing" (1 hit).

## Gauntlet (EVIDENCE=vantage-app-lab-tour-fonts) — log `vantage-app-lab-tour-fonts-gauntlet.txt`
- 🟡 0 webkit UNAVAILABLE — egress (cdn.playwright.dev) → PARTIAL; 🟡 5 ui-audit PARTIAL (Chromium, 200 surfaces)
- 🟢 1 unit 152/0 · 🟢 2 inline:check · 🟢 4 Playwright 116 passed, 1 WebKit-only skip
- 🔴 3 tenants-check 43/25/27 — **every App Lab row PASSES** (T1 · T2 vantage present · T3 gate 532e6ae3 · T4 · T9).
  The 25 FAILs = T2/T3/T4 × 8 private tenant repos not in this session (cardsharp, fsa-claims, giving-tracker, optimo,
  rebate-radar, remit, retirement, thrift-shop) + T8 (council not cloned) → BLOCKED (access), per the ARC order; same
  43/25/27 verdict as vantage's staged validation.

## Sentry (secret scan of every added/modified text file)
- One hit: `sb_publishable_…` in the bundle — the Supabase publishable key, public by design. No secret keys,
  service_role JWTs, tokens or private keys.

## Ship proof (post-merge) — see the close-out report on the PR.

## File list
```
A	app-lab/vantage/assets/Whiteboard-C4E02ABj.js
A	app-lab/vantage/assets/Whiteboard-CmX3AOUZ.css
A	app-lab/vantage/assets/atkinson-hyperlegible-latin-400-normal-BbWidj28.woff
A	app-lab/vantage/assets/atkinson-hyperlegible-latin-400-normal-BrHNak5F.woff2
A	app-lab/vantage/assets/atkinson-hyperlegible-latin-700-normal-BK6Glc0m.woff
A	app-lab/vantage/assets/atkinson-hyperlegible-latin-700-normal-GZI4o3u0.woff2
A	app-lab/vantage/assets/index-BsNeUenB.js
A	app-lab/vantage/assets/index-ieoaEdJQ.css
A	app-lab/vantage/assets/inter-latin-400-normal-C38fXH4l.woff2
A	app-lab/vantage/assets/inter-latin-400-normal-CyCys3Eg.woff
A	app-lab/vantage/assets/inter-latin-600-normal-CiBQ2DWP.woff
A	app-lab/vantage/assets/inter-latin-600-normal-LgqL8muc.woff2
A	app-lab/vantage/assets/inter-latin-700-normal-BLAVimhd.woff
A	app-lab/vantage/assets/inter-latin-700-normal-Yt3aPRUw.woff2
A	app-lab/vantage/assets/latin-400-B3mq7pvk.css
A	app-lab/vantage/assets/latin-400-B6s061Dm.css
A	app-lab/vantage/assets/latin-400-C2mjkbqB.css
A	app-lab/vantage/assets/latin-400-CCmoqNsJ.css
A	app-lab/vantage/assets/latin-400-CHKb53bK.css
A	app-lab/vantage/assets/latin-600-1qsrkCiB.css
A	app-lab/vantage/assets/latin-600-B4vg92gH.css
A	app-lab/vantage/assets/latin-600-B6B_QHpV.css
A	app-lab/vantage/assets/latin-600-CYqfeFSq.css
A	app-lab/vantage/assets/latin-700-B51m9Bd6.css
A	app-lab/vantage/assets/latin-700-C4-Z-rBi.css
A	app-lab/vantage/assets/latin-700-CSb4jb3F.css
A	app-lab/vantage/assets/latin-700-DiVQ3Kzn.css
A	app-lab/vantage/assets/latin-700-MirRjARh.css
A	app-lab/vantage/assets/lexend-latin-400-normal-CHypAkT3.woff
A	app-lab/vantage/assets/lexend-latin-400-normal-CwRJVcUA.woff2
A	app-lab/vantage/assets/lexend-latin-600-normal-DSBzZxpA.woff
A	app-lab/vantage/assets/lexend-latin-600-normal-DdvlkEkX.woff2
A	app-lab/vantage/assets/lexend-latin-700-normal-DVyJlN8t.woff
A	app-lab/vantage/assets/lexend-latin-700-normal-DqO8md6r.woff2
A	app-lab/vantage/assets/merriweather-latin-400-normal-CvqO63Ah.woff
A	app-lab/vantage/assets/merriweather-latin-400-normal-G4kZaoXi.woff2
A	app-lab/vantage/assets/merriweather-latin-600-normal-C6E9L-0K.woff
A	app-lab/vantage/assets/merriweather-latin-600-normal-R6Oab5xe.woff2
A	app-lab/vantage/assets/merriweather-latin-700-normal-D4-nzrAh.woff
A	app-lab/vantage/assets/merriweather-latin-700-normal-DoUP8Ce-.woff2
A	app-lab/vantage/assets/nunito-latin-400-normal-DKg4f3fz.woff
A	app-lab/vantage/assets/nunito-latin-400-normal-r8SDr6Up.woff2
A	app-lab/vantage/assets/nunito-latin-600-normal-Br8yIETf.woff2
A	app-lab/vantage/assets/nunito-latin-600-normal-Cd0eNu1l.woff
A	app-lab/vantage/assets/nunito-latin-700-normal-Dort48En.woff2
A	app-lab/vantage/assets/nunito-latin-700-normal-OcDqTBcA.woff
A	app-lab/vantage/assets/permanent-marker-latin-400-normal-BF23djCy.woff2
A	app-lab/vantage/assets/permanent-marker-latin-400-normal-BnZj5c41.woff
D	app-lab/vantage/assets/Whiteboard-DG6NJ5y3.js
D	app-lab/vantage/assets/index-B5UBch43.css
D	app-lab/vantage/assets/index-PzQikWRp.js
M	app-lab/vantage/index.html
R092	app-lab/vantage/assets/TagPopover-CXe-L0P3.js	app-lab/vantage/assets/TagPopover-qgezRyFd.js
R094	app-lab/vantage/assets/NotesEditor-6PCSNPyu.js	app-lab/vantage/assets/NotesEditor-BBlVpwm1.js
```
