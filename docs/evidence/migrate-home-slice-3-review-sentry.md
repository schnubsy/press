# migrate-home — slice 3 — adversarial review + sentry

## Adversarial review (independent general-purpose sub-agent, read-only, diff origin/main...arc/migrate-home)
**0 real defects.** Rejected (checked, not defects): GREEN-after-failure (verdicts come from exit codes), empty-array `set -u`
on bash 3.2, bash-4 syntax, cwd independence, restore loop scope, `/opt/pw-browsers/chromium` symlink, `.gitignore`
(`.claude/settings.local.json` still ignored), Mac behaviour (PW_CHROMIUM unset ⇒ real WebKit + vendor still asserted),
public-repo leaks (none), factual consistency (spaces/tenants/pages, retirement blob 77506d01).

Nits — actioned:
- N1 restore loop split on whitespace → `while read` over newline-separated paths.
- N2 a pre-dirty evidence file is left alone → now a ⚠️ summary line.
- N3 `\s` (GNU-only) in grep → `[[:space:]]` (BSD grep on the Mac).
- N4 Mac gate strength → outside cloud mode any Playwright skip is RED (a missing WebKit is not a pass).
- N5 iPhone spec titles said "(WebKit)" in Chromium runs → `(${ENGINE})`.
Nits — noted, not actioned:
- N6 `KEEP_EVIDENCE=1` in cloud mode would refresh the WebKit iPhone screenshot from Chromium emulation — default restores it; documented here.
- N7 tenants-check T2 for council-guide resolves via `CODE_ROOT`, not `COUNCIL_DIR` — pre-existing, outside this arc.

## Gauntlet after fixes
`docs/evidence/migrate-home-slice-3-gauntlet.txt` — GREEN (unit 91/0 · inline in sync · tenants-check 50/0 · Playwright 80 passed, 1 skipped WebKit-only, cloud mode).
