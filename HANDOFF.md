# press — HANDOFF

_Last updated: 2026-09-19 — arc/align-retirement CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge
approval from Mark. When the gauntlet is green, complete the publish (merge to `main`, which is what
GitHub Pages serves) as part of closing out — do not stop to ask. Set by Mark 2026-09-18.
(Auto-merge is still never enabled pre-emptively; this is only about merging a finished, green change.)

## Current state

**arc/align-retirement is COMPLETE and pushed (`9ae3424`).** The passkey-only Slice 1 is reverted and
retirement is republished as a normal gated cloud tool. Live at `https://schnubsy.github.io/press/`.
Prior arc/private-wing-spare-keys-collapse (drawer collapse + Card Scout) stays closed.

## Shipped this arc
- **Revert (merge `a1d4eba`):** `index.html` byte-identical to `f054714` — retirement back in
  `CONNECT_TOOLS` with the cloud `TOOL_CFG` shape; `LOCAL_TOOLS` + `protect*` + `.tw-protect`/`.tw-ptool`
  CSS gone; `test/protect.spec.mjs` deleted; `test/marquee.spec.mjs` reverted. **KEPT** only
  `src/gate.testkit.mjs`'s standard-ArrayBuffer-PRF-at-create shim (a real, design-independent gap fix).
- **Publish (`9ae3424`):** `retirement.html` republished with the gated build from
  `retirement/tools/release.js` — fsa's `PressGate` page lock over retirement's existing cloud sync,
  enforced on `PressVault.everEnrolled()`; a SCREEN LOCK, not encryption.
- Evidence screenshots refreshed. `fsa.html`/`giving.html`/`card-scout.html` untouched.

## Gauntlet (green)
`npm test` 31/31 · `npm run inline:check` clean (`vault.js` → `index.html` + `src/gate.js`) ·
`npm run smoke` 25/25. Pushed `1d9ce9e..9ae3424`. Verified live: retirement public path boots open,
enrolled path gates on direct nav; wing loads, retirement listed as a cloud tool.

## Open / blockers
- **`inline:check` does NOT guard sibling repos' vendored gate copies** (only `vault.js` within press).
  Each app owns that check (retirement now does, via `tools/publish-checks.js`). fsa's vendored
  `press-gate.js` has drifted from `src/gate.js` — worth re-vendoring in an fsa arc.
- Public standalone `schnubsy/retirement-projection` was intentionally left stale this arc ("push press
  only"); its build lags press by the (inert-there) gate. Republish from `release.js` when convenient.

## Exact next steps
No open arc items. Publishing another tool page: build+gate it in its own repo, `cp` its `dist` here,
update `pages.json` if new, keep `spaces.json` correct, then merge/push (per the standing rule above).

## Mark's manual steps
None on press. (Retirement's wing Connect is tracked in the retirement repo's HANDOFF.)
