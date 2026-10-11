#!/usr/bin/env bash
# press ship gate (migrate-home, 2026-10-11). press has no build step; the gauntlet proves the shared modules,
# the inlined vault, the tenant contract and the served pages' behaviour.
#
#   bash scripts/gauntlet.sh                      # from the repo root (Mac or a cloud clone)
#   EVIDENCE=<arc>-slice-<N>-<name> bash scripts/gauntlet.sh
#   KEEP_EVIDENCE=1 …                             # keep the evidence PNGs the Playwright specs rewrite
#
# Stages: 1 node --test (npm test) · 2 inline:check (index.html + src/gate.js == src/vault.js) ·
#         3 tenants-check (contract T1–T8; sibling clones of the tenant repos + council are used when present) ·
#         4 Playwright smoke (all test/*.spec.mjs).
# Cloud mode: when /opt/pw-browsers/chromium exists and PW_CHROMIUM is unset, PW_CHROMIUM is set to it —
# Chromium only (the WebKit iPhone spec runs as Chromium iPhone-15 emulation; the one real-WebKit IDB test
# self-skips). Real-Safari checks stay on the Mac run / Mark's phone.
# Exit 0 = GAUNTLET GREEN; 1 = a stage failed.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOG="docs/evidence/${EVIDENCE:-gauntlet}-gauntlet.txt"
mkdir -p docs/evidence
: > "$LOG"
summary=()
fail=0
say() { echo "$*" | tee -a "$LOG"; }

if [ -z "${PW_CHROMIUM:-}" ] && [ -x /opt/pw-browsers/chromium ]; then export PW_CHROMIUM=/opt/pw-browsers/chromium; fi
[ -n "${PW_CHROMIUM:-}" ] && summary+=("ℹ️ cloud mode: Chromium only ($("$PW_CHROMIUM" --version 2>/dev/null | head -1)); WebKit iPhone spec = Chromium emulation")

# Sibling clones (cloud: /home/claude/<repo>; Mac: ~/Documents/code/<repo>) feed tenants-check's T4/T8.
PARENT="$(dirname "$ROOT")"
export CODE_ROOT="${CODE_ROOT:-$PARENT}"
[ -z "${COUNCIL_DIR:-}" ] && [ -d "$PARENT/council" ] && export COUNCIL_DIR="$PARENT/council"

say "press gauntlet — $(date -u +%FT%TZ) — HEAD $(git rev-parse --short HEAD) — node $(node -v)"
dirty_before="$(git diff --name-only -- docs/evidence | grep -v "^$LOG$" || true)"

[ -d node_modules ] || { say "npm ci"; npm ci >>"$LOG" 2>&1 || { say "✗ FAILED: npm ci"; exit 1; }; }

# 1 — unit
say "== 1 node --test"
if npm test >>"$LOG" 2>&1; then
  summary+=("🟢 1 unit: $(grep -E '^# pass ' "$LOG" | tail -1 | sed 's/# //') / $(grep -E '^# fail ' "$LOG" | tail -1 | sed 's/# //')")
else summary+=("🔴 1 unit — ✗ FAILED: node --test"); fail=1; fi

# 2 — inline vault drift
say "== 2 inline:check"
if node tools/inline-vault.mjs --check >>"$LOG" 2>&1; then summary+=("🟢 2 inline:check in sync")
else summary+=("🔴 2 inline:check — ✗ FAILED: inline drift"); fail=1; fi

# 3 — tenant contract
say "== 3 tenants-check (CODE_ROOT=$CODE_ROOT${COUNCIL_DIR:+ COUNCIL_DIR=$COUNCIL_DIR})"
if node tools/tenants-check.mjs >>"$LOG" 2>&1; then summary+=("🟢 3 $(grep -E '^tenants-check:' "$LOG" | tail -1)")
else summary+=("🔴 3 $(grep -E '^tenants-check:' "$LOG" | tail -1) — ✗ FAILED: tenants-check"); fail=1; fi

# 4 — Playwright smoke
say "== 4 playwright"
if npx playwright test >>"$LOG" 2>&1; then pw=ok; else pw=fail; fi
pwline="$(grep -E '^\s+[0-9]+ (passed|failed|skipped|flaky)' "$LOG" | tr -s ' ' | tr '\n' ' ')"
skipped="$(grep -E '^\s+-\s+[0-9]+ ' "$LOG" | sed 's/^ *//' | head -5)"
if [ "$pw" = ok ]; then summary+=("🟢 4 playwright:${pwline}")
else summary+=("🔴 4 playwright:${pwline}— ✗ FAILED: playwright"); fail=1; fi
[ -n "$skipped" ] && while IFS= read -r l; do summary+=("   skip: $l"); done <<< "$skipped"

# Specs rewrite tracked evidence PNGs as a side effect — restore what this run touched, unless asked to keep.
if [ -z "${KEEP_EVIDENCE:-}" ]; then
  for f in $(git diff --name-only -- docs/evidence | grep -v "^$LOG$"); do
    case $'\n'"$dirty_before"$'\n' in *$'\n'"$f"$'\n'*) ;; *) git checkout -- "$f" ;; esac
  done
fi
[ -d test-results ] && rm -r test-results

say ""
say "── summary ──"
for l in "${summary[@]}"; do say "$l"; done
if [ $fail -eq 0 ]; then say "GAUNTLET GREEN — exit 0 — log $LOG"; exit 0
else say "GAUNTLET RED — exit 1 — log $LOG"; exit 1; fi
