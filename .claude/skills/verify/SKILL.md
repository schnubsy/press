---
name: verify
description: Run press's ship gate (scripts/gauntlet.sh — WebKit install, node --test, inline-vault drift check, tenants-check, Playwright smoke incl. iPhone WebKit, the iPhone UI audit) and report the ≤30-line summary. Use for "verify", "run the gauntlet", the per-slice loop, and the arc close.
---

# verify — press's gauntlet, summarised

Run `scripts/gauntlet.sh` from the repo root and report ONLY the ≤30-line summary it prints — never paste the full
log. The script writes its own log to `docs/evidence/${EVIDENCE:-gauntlet}-gauntlet.txt`. press is PUBLIC: nothing
the gauntlet prints may carry a secret (the specs fake Supabase; there is none to print).

## Preconditions
- `npm ci` (the script runs it when `node_modules/` is missing). Dev-only deps; the site has no build step.
- **WebKit (arc/safari-ui, 2026-10-12):** stage 0 runs `npx playwright install webkit` (idempotent; needs
  `cdn.playwright.dev` + `playwright.download.prss.microsoft.com` — `docs/secrets-map.md` "Egress"). Safari (WebKit) is the
  iPhone engine of record: the `iphone-webkit` Playwright project + the ui-audit run on it, in the cloud too. If the
  install fails the gauntlet runs chromium only and reports `GAUNTLET PARTIAL (egress)` (exit 2) — never green.
- **Cloud clone:** Chromium for the `chromium` project is auto-detected at `/opt/pw-browsers/chromium` (`PW_CHROMIUM`).
- **Optional sibling clones** (`../council`, `../<tenant repos>`) feed tenants-check T4/T8; absent ones SKIP, never fail.
  `CODE_ROOT` / `COUNCIL_DIR` override.

```sh
EVIDENCE=<arc>-slice-<N>-<name> bash scripts/gauntlet.sh; echo "exit=$?"
```
Specs rewrite tracked evidence PNGs as a side effect; the script restores them unless `KEEP_EVIDENCE=1`.

## What it runs (expected values as of 2026-10-12, cloud clone)
0. WebKit installed (26.x) · 1. `npm test` (node --test) — pass 133 / fail 0 · 2. `inline:check` — index.html + src/gate.js
in sync with src/vault.js (+ family-gate) · 3. `tenants-check` — 0 fail (skips depend on sibling clones) · 4. Playwright —
`chromium` + `iphone-webkit` projects, 0 skipped · 5. ui-audit — GREEN on WebKit (`test/ui-audit.config.mjs`: every
press-native state × 320/375/390/393/430 × dark+light; summary `docs/evidence/<EVIDENCE>-ui-audit.txt`).

Counts grow with the suites; a drop, any `fail` or any skip is the signal.

## Verdict
- `GAUNTLET GREEN — exit 0` → 🟢. `GAUNTLET PARTIAL (egress) — exit 2` → 🟡 WebKit hosts missing from the environment's
  allowlist (fix the environment; never call it green). `GAUNTLET RED` / any `✗ FAILED: <stage>` → 🔴 name the stage and its first error line.

## Not in the gauntlet (run on demand)
- `node tools/tenants-check.mjs --rebuild` (T5 rebuild-vs-live; needs built tenant clones) · `node tools/page-diff.mjs` (train only)
- Live checks: served page `curl -sI https://schnubsy.github.io/press/<page>` = 200 and `git hash-object <page>` == the
  GitHub blob (publish ship proof) · T6 family grants via the Supabase connector (SQL emitted by tenants-check).
