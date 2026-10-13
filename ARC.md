## 2026-10-12 — safari-ui roll-out

SLICES: 3 · SINGLE-SLICE JUSTIFICATION: none
Work order — press: safari-ui roll-out (iPhone UI audit on WebKit)
HOME: github:schnubsy/press
BRANCH: arc/safari-ui
PUBLISH TARGETS: none
/goal close-out manifest all DONE/N/A, gauntlet (incl. ui-audit GREEN on WebKit) + sentry green, verify evidence committed
Stack: schnubsy/press is the marquee itself — publish = its own merge; PUBLISH TARGETS: none
S1 — harness: from a council clone at main, vendor `instruments/ui-audit/{ui-probe,run}.mjs` into `test/ui-audit/`
     byte-identical (stamp `council-ui-audit@1.0.0`); write `test/ui-audit.config.mjs` (from `ui-audit.config.example.mjs`):
     Shell + every press-native page (index lobby/wings, steward.html, agent-health.html, access pages). The passkey gate is press-owned here — its states ARE in scope (unlike tenant repos, where the vendored gate is advisory). Seed the gate past-lock via its test hook, never real credentials.
     Designed exceptions named with a why. Gauntlet: `npx playwright install webkit`, then
     `node test/ui-audit/run.mjs test/ui-audit.config.mjs --evidence docs/evidence/safari-ui-audit`; exit 2 ⇒
     `GAUNTLET PARTIAL (egress)`. Smoke gains an iPhone WebKit project. `docs/secrets-map.md` → "Egress" lists
     `cdn.playwright.dev` + `playwright.download.prss.microsoft.com`.
     Done: the audit RAN ON WEBKIT in this session (GREEN, or RED with the defect list). A PARTIAL means the dispatch
     env lacks the WebKit hosts: STOP, report BLOCKED (egress) — never continue on Chromium.
     Status: done 334d533
S2 — fix every defect the audit found (fix, or a named designed exception with its why — an exception added only
     to turn red green is a 🔴 in review); re-run until GREEN on WebKit across 320/375/390/393/430 × dark + light.
     Status: done 3c734f2
S3 — /code-review slice; close per arc.md rule 4 (publish + ship proof where a target is named).
Chat: run verify
