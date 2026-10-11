---
name: verify
description: Run press's ship gate (scripts/gauntlet.sh — node --test, inline-vault drift check, tenants-check, Playwright smoke) and report the ≤30-line summary. Use for "verify", "run the gauntlet", the per-slice loop, and the arc close.
---

# verify — press's gauntlet, summarised

Run `scripts/gauntlet.sh` from the repo root and report ONLY the ≤30-line summary it prints — never paste the full
log. The script writes its own log to `docs/evidence/${EVIDENCE:-gauntlet}-gauntlet.txt`. press is PUBLIC: nothing
the gauntlet prints may carry a secret (the specs fake Supabase; there is none to print).

## Preconditions
- `npm ci` (the script runs it when `node_modules/` is missing). Dev-only deps; the site has no build step.
- **Cloud clone:** Chromium is auto-detected at `/opt/pw-browsers/chromium` (`PW_CHROMIUM`). Never `playwright install`.
  No WebKit in the cloud image — the iPhone drag spec runs as Chromium iPhone-15 emulation and the one real-WebKit
  IDB test self-skips (named in the summary). The Mac run (no `PW_CHROMIUM`) keeps real WebKit.
- **Optional sibling clones** (`../council`, `../<tenant repos>`) feed tenants-check T4/T8; absent ones SKIP, never fail.
  `CODE_ROOT` / `COUNCIL_DIR` override.

```sh
EVIDENCE=<arc>-slice-<N>-<name> bash scripts/gauntlet.sh; echo "exit=$?"
```
Specs rewrite tracked evidence PNGs as a side effect; the script restores them unless `KEEP_EVIDENCE=1`.

## What it runs (expected values as of 2026-10-11, cloud clone)
1. `npm test` (node --test) — pass 91 / fail 0 · 2. `inline:check` — index.html + src/gate.js in sync with src/vault.js
3. `tenants-check` — 50 pass, 0 fail (skips depend on sibling clones) · 4. Playwright — 80 passed, 1 skipped (WebKit IDB, cloud only)

Counts grow with the suites; a drop or any `fail` is the signal.

## Verdict
- `GAUNTLET GREEN — exit 0` → 🟢. `GAUNTLET RED` / any `✗ FAILED: <stage>` → 🔴 name the stage and its first error line.

## Not in the gauntlet (run on demand)
- `node tools/tenants-check.mjs --rebuild` (T5 rebuild-vs-live; needs built tenant clones) · `node tools/page-diff.mjs` (train only)
- Live checks: served page `curl -sI https://schnubsy.github.io/press/<page>` = 200 and `git hash-object <page>` == the
  GitHub blob (publish ship proof) · T6 family grants via the Supabase connector (SQL emitted by tenants-check).
