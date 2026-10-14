#!/usr/bin/env bash
# press ship gate (migrate-home, 2026-10-11). press has no build step; the gauntlet proves the shared modules,
# the inlined vault, the tenant contract and the served pages' behaviour.
#
#   bash scripts/gauntlet.sh                      # from the repo root (Mac or a cloud clone)
#   EVIDENCE=<arc>-slice-<N>-<name> bash scripts/gauntlet.sh
#   KEEP_EVIDENCE=1 …                             # keep the evidence PNGs the Playwright specs rewrite
#
# Stages: 1 node --test (npm test) · 2 inline:check (index.html + src/gate.js == src/vault.js) ·
#         3 tenants-check (contract T1–T9; sibling clones of the tenant repos + council are used when present) ·
#         4 Playwright smoke (all test/*.spec.mjs: `chromium` project + the `iphone-webkit` project on REAL WebKit) ·
#         5 ui-audit — the iPhone UI audit (council instruments/ui-audit, vendored in test/ui-audit/): every press-native
#           state × 320/375/390/393/430 × dark+light on WebKit; summary + JSON in docs/evidence/<stem>-ui-audit.*
# WebKit (arc/safari-ui, 2026-10-12): `npx playwright install webkit` runs first (idempotent; needs cdn.playwright.dev +
# playwright.download.prss.microsoft.com — docs/secrets-map.md "Egress"). If it cannot install, the Playwright stage
# runs the chromium project alone, the ui-audit falls back to labelled Chromium (exit 2) and the gauntlet reports
# GAUNTLET PARTIAL (egress) — a Chromium run is never Safari-green.
# Cloud mode: when /opt/pw-browsers/chromium exists and PW_CHROMIUM is unset, PW_CHROMIUM is set to it (the chromium
# project launches it).
# Exit 0 = GAUNTLET GREEN; 1 = a stage failed (RED); 2 = every stage passed but WebKit was unavailable (PARTIAL).
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOG="docs/evidence/${EVIDENCE:-gauntlet}-gauntlet.txt"
UISTEM="docs/evidence/${EVIDENCE:-gauntlet}-ui-audit"   # stage 5 writes $UISTEM.{txt,json} — the gauntlet's own output, never restored
KEEP_RE="^($LOG|$UISTEM\\.(txt|json))$"
mkdir -p docs/evidence
: > "$LOG"
summary=()
fail=0
say() { echo "$*" | tee -a "$LOG"; }

if [ -z "${PW_CHROMIUM:-}" ] && [ -x /opt/pw-browsers/chromium ]; then export PW_CHROMIUM=/opt/pw-browsers/chromium; fi
[ -n "${PW_CHROMIUM:-}" ] && summary+=("ℹ️ cloud mode: chromium project = $("$PW_CHROMIUM" --version 2>/dev/null | head -1)")
partial=0

# Sibling clones of this press clone (the tools' own defaults too) feed tenants-check's T4/T8.
PARENT="$(dirname "$ROOT")"
export CODE_ROOT="${CODE_ROOT:-$PARENT}"
[ -z "${COUNCIL_DIR:-}" ] && [ -d "$PARENT/council" ] && export COUNCIL_DIR="$PARENT/council"

say "press gauntlet — $(date -u +%FT%TZ) — HEAD $(git rev-parse --short HEAD) — node $(node -v)"
dirty_before="$(git diff --name-only -- docs/evidence | grep -vE "$KEEP_RE" || true)"

[ -d node_modules ] || { say "npm ci"; npm ci >>"$LOG" 2>&1 || { say "✗ FAILED: npm ci"; exit 1; }; }

# 0 — WebKit (the iPhone engine of record) — idempotent install; failure ⇒ PARTIAL (egress), never a silent skip
say "== 0 playwright install webkit"
if npx playwright install webkit >>"$LOG" 2>&1 && node -e "require('playwright').webkit.launch().then(b=>b.close())" >>"$LOG" 2>&1; then
  summary+=("🟢 0 webkit: installed ($(node -e "require('playwright').webkit.launch().then(async b=>{console.log(b.version());await b.close()})" 2>/dev/null))")
else
  export PW_NO_WEBKIT=1; partial=1
  summary+=("🟡 0 webkit: UNAVAILABLE — install failed (egress: cdn.playwright.dev + playwright.download.prss.microsoft.com) → PARTIAL")
fi

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
if [ -n "${PW_NO_WEBKIT:-}" ]; then PWARGS=(--project chromium); else PWARGS=(); fi
# ${A[@]+"${A[@]}"}: an empty array under set -u is "unbound" on bash < 4.4 (macOS /bin/bash 3.2)
if npx playwright test ${PWARGS[@]+"${PWARGS[@]}"} >>"$LOG" 2>&1; then pw=ok; else pw=fail; fi
pwline="$(grep -E '^[[:space:]]+[0-9]+ (passed|failed|skipped|flaky)' "$LOG" | tr -s ' ' | tr '\n' ' ')"
skipped="$(grep -E '^[[:space:]]+-[[:space:]]+[0-9]+ ' "$LOG" | sed 's/^ *//' | head -5)"
if [ "$pw" = ok ]; then summary+=("🟢 4 playwright:${pwline}")
else summary+=("🔴 4 playwright:${pwline}— ✗ FAILED: playwright"); fail=1; fi
[ -n "$skipped" ] && while IFS= read -r l; do summary+=("   skip: $l"); done <<< "$skipped"
# WebKit is installed (stage 0) — a self-skipped test is a missing engine, not a pass.
if [ -z "${PW_NO_WEBKIT:-}" ] && [ -n "$skipped" ]; then summary+=("🔴 4 playwright — ✗ FAILED: skips with WebKit installed"); fail=1; fi

# 5 — the iPhone UI audit (WebKit; exit 0 GREEN · 1 RED · 2 PARTIAL = not on WebKit)
say "== 5 ui-audit → $UISTEM.{txt,json}"
rm -f "$UISTEM.txt" "$UISTEM.json"   # a crashed run must never report the previous run's matrix
node test/ui-audit/run.mjs test/ui-audit.config.mjs --evidence "$UISTEM" >>"$LOG" 2>&1; ua=$?
ualine="$(grep -E '^matrix:' "$UISTEM.txt" 2>/dev/null | head -1)"
case $ua in
  0) summary+=("🟢 5 ui-audit: GREEN on WebKit — $ualine") ;;
  2) summary+=("🟡 5 ui-audit: PARTIAL (not WebKit) — $ualine"); partial=1 ;;
  *) summary+=("🔴 5 ui-audit: RED — $ualine — ✗ FAILED: ui-audit (defects in $UISTEM.txt)"); fail=1
     while IFS= read -r l; do summary+=("   $l"); done <<< "$(grep -E '^(✗)' "$UISTEM.txt" 2>/dev/null | head -8)" ;;
esac

# Specs rewrite tracked evidence PNGs as a side effect — restore what this run touched, unless asked to keep.
if [ -z "${KEEP_EVIDENCE:-}" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case $'\n'"$dirty_before"$'\n' in *$'\n'"$f"$'\n'*) summary+=("⚠️ $f was dirty before the run and may have been rewritten by a spec") ;; *) git checkout -- "$f" ;; esac
  done <<< "$(git diff --name-only -- docs/evidence | grep -vE "$KEEP_RE")"
fi
[ -d test-results ] && rm -r test-results

say ""
say "── summary ──"
for l in "${summary[@]}"; do say "$l"; done
if [ $fail -ne 0 ]; then say "GAUNTLET RED — exit 1 — log $LOG"; exit 1
elif [ $partial -ne 0 ]; then say "GAUNTLET PARTIAL (egress) — exit 2 — WebKit unavailable; log $LOG"; exit 2
else say "GAUNTLET GREEN — exit 0 — log $LOG"; exit 0; fi
