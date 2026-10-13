# safari-ui slice 2 — every audit defect fixed; ui-audit GREEN on WebKit 26.6 (2026-10-12)

Gauntlet: `safari-ui-slice-2-fixes-gauntlet.txt` (GREEN — unit 137 · inline in sync · tenants-check 0 fail · Playwright 132
incl. the `iphone-webkit` project, 0 skips · ui-audit GREEN 190 surfaces). Audit: `safari-ui-slice-2-fixes-ui-audit.{txt,json}`.
Screens (WebKit, dark): `safari-ui-slice-2-webkit-{320,390}.png`.

| defect (S1) | fix |
|---|---|
| font16 `.tw-cinput` 13px (connect inputs) · `#lk` 13px (access) | 16px |
| touch `.tw-back` 122×25 (index + agent-health) | 44px tap box; the 25px pill is `::before` (look unchanged) |
| clickable `<span class="tw-mini">` ×8 (Lock now/Devices/Recovery kit/Add device/Remove/Print/Done/Log out) — ungated + the 390px pill wrap | real `<button type="button">`, one line, 44px box, pill drawn by `::before`; secbar wraps rows instead of wrapping labels |
| touch `#unlockBtn` 175×38 | `.tw-btn` min-height 44 |
| wrap+touch `#setupLink` (span role=button, a 2-line sentence) | "First time on any device?" plain text + one-line `<button>` "Set up a new passkey" (44px) |
| touch `.fg-back` (family gate) · `.pg-back` 86×20 + `.pg-btn` 181×41 (passkey gate on steward) | 44px — as PAGE-LEVEL overrides (`html #family-gate …` in index.html, `html #press-gate …` in steward.html). `src/gate.js` / `src/family-gate.js` stay byte-identical: changing them drifted 7 tenants' vendored copies (tenants-check T3 RED in the first S2 run) — moving the fix into the shared modules is a tenant-wave arc |
| touch `a.back` (steward, access) | 44px inline-flex box, underline via text-decoration |
| touch `.sw2` switch 38×21 (access) | 44×44 tap box; track `::before`, knob `::after` (look unchanged) |
| touch `.pbtn` 28 · `.on-btn` 36 (access) · `.refresh` 28 · `.lnk` 31 · `.retry` 31 (agent-health) | min-height 44 |
| wrap `.row .line` (agent-health) | **designed exception** (named in the config + evidence): the row is one `<button>`, so its server-copy status line reads as a label; it must wrap at phone width — truncating hides why an agent needs attention. The row title stays gated. |
| (visual, not gated) access "PEOPLE / on = can open · tap to opt out" header ran together at 320 | `.zone-hd` wraps with a gap |

Also: the harness wipes storage once per page (a context is shared across one width×scheme's states — the first run
audited access-"locked" while unlocked by an earlier state's seed), and the catch-all `functions/v1/**` fake is registered
first (Playwright's last-registered route wins).
Static guards: `test/safari-ui.test.mjs` (4).
Design check (folded Eye LITE): the 320/390 sheets reviewed — pills/links keep their look, no clipped or crowded control;
no 🔴. Performance slice: N/A — CSS + markup only, no new asset or script; press's gauntlet has no Lighthouse stage.
