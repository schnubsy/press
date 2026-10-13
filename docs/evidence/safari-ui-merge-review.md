# safari-ui — D1 merge-gate review (PR #40, head a96e12c, 2026-10-13)

Reviewer: a fresh general-purpose sub-agent given only the PR number, the ARC.md block and the PR diff (not the build
conversation). **VERDICT: no 🔴.**

Checked: vendored ui-audit pair byte-identical to council (run b3e244af, ui-probe b554a025); `src/` (gate, family-gate,
vault), tools/, .github, pages/spaces/tenants.json untouched; inline-vault --check 0; npm test 137/0; lockfile dedupes
playwright 1.63.0; close gauntlet GREEN (WebKit 26.6, Playwright 130 / 0 skips, ui-audit GREEN 200 surfaces); no secrets.
The one designed exception (`.row .line`, agent-health) judged a real design reason, not a red→green exception.

🟡 follow-ups (non-blocking → HANDOFF): (1) tenant pages keep the sub-44px gate controls until a tenant wave moves the
page-level overrides into src/gate.js + src/family-gate.js; (2) unaudited states: steward gate before enrolment, access OTP
code step + "not an admin", family-gate send/verify errors; (3) access `.sw2` `<i role=switch>` has no tabindex (keyboard a11y,
pre-existing); (4) a bare `npx playwright test` without WebKit now fails the iphone-webkit project (the gauntlet handles it).
🟢 nit: the ui-audit test server's `startsWith(ROOT)` lacks a trailing separator (127.0.0.1-only, no exposure).
