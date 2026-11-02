#!/usr/bin/env bash
# press gauntlet — the council testing.md → "Web" seed + press specifics (stage shape, lanes and engines live there).
#
#   LANE=standard PRIMARY=iphone-webkit [VIEWS=<ids>] [EXTRAS=db,tenant] bash scripts/gauntlet.sh
#   (council `node tools/test-plan.mjs --repo-dir .` prints the exact line for the diff)
#   EVIDENCE=<arc>-<name> …   log stem · KEEP_EVIDENCE=1 … keep the evidence PNGs the specs rewrite
#
# press specifics: no build step — "build" = inline:check (index.html + src/gate.js == src/vault.js); the desktop smoke
# = test/marquee.spec.mjs (the portal); EXTRAS=tenant = tenants-check (contract T1–T9; sibling clones of the tenant
# repos + council feed T4/T8 when present); EXTRAS=db = a reminder that the db/*.sql mirrors are read back through
# the Supabase connector (list_migrations vs db/) — PARTIAL until that read-back is cited.
# Cloud: PW_CHROMIUM = /opt/pw-browsers/chromium when present (the desktop project launches it).
# Exit 0 = GREEN · 1 = RED · 2 = PARTIAL (WebKit unavailable, or a step that needs the connector). Never `set -e`.
set -uo pipefail
cd "$(dirname "$0")/.."

LANE="${LANE:-standard}"                      # quick | standard | full
case "$LANE" in quick|standard|full) ;; *) echo "LANE must be quick|standard|full"; exit 64 ;; esac
PRIMARY="${PRIMARY:?set PRIMARY=iphone-webkit (mobile-web) or desktop}"
fail=0; partial=0; partial_reason=""
summary=()
LOG="docs/evidence/${EVIDENCE:-gauntlet}-gauntlet.txt"
UISTEM="docs/evidence/${EVIDENCE:-gauntlet}-ui-audit"
KEEP_RE="^($LOG|$UISTEM\\.(txt|json))$"
mkdir -p docs/evidence; : > "$LOG"
say() { echo "$*" | tee -a "$LOG"; }
stage() { say "== $*"; "$@" >>"$LOG" 2>&1; local c=$?
  case "$c" in 0) summary+=("🟢 $*") ;; 2) partial=1; summary+=("🟡 $* — PARTIAL") ;; *) fail=1; summary+=("🔴 $* — ✗ FAILED (exit $c)") ;; esac
  return 0; }
has() { case ",${EXTRAS:-}," in *",$1,"*) return 0 ;; esac; return 1; }
full() { [ "$LANE" = full ]; }

if [ -z "${PW_CHROMIUM:-}" ] && [ -x /opt/pw-browsers/chromium ]; then export PW_CHROMIUM=/opt/pw-browsers/chromium; fi
PARENT="$(dirname "$(pwd)")"
export CODE_ROOT="${CODE_ROOT:-$PARENT}"
[ -z "${COUNCIL_DIR:-}" ] && [ -d "$PARENT/council" ] && export COUNCIL_DIR="$PARENT/council"

say "press gauntlet — LANE=$LANE PRIMARY=$PRIMARY VIEWS=${VIEWS:-} EXTRAS=${EXTRAS:-} — $(date -u +%FT%TZ) — HEAD $(git rev-parse --short HEAD) — node $(node -v)"
dirty_before="$(git diff --name-only -- docs/evidence | grep -vE "$KEEP_RE" || true)"
[ -d node_modules ] || { say "npm ci"; npm ci >>"$LOG" 2>&1 || { say "✗ FAILED: npm ci"; exit 1; }; }

# WebKit (the iPhone engine): install + launch; failure ⇒ PARTIAL (<reason>) and the iPhone stages run on desktop Chromium.
webkit_ok() {
  local wk; wk="$(mktemp)"
  if npx playwright install --with-deps webkit >"$wk" 2>&1 && node -e "require('playwright').webkit.launch().then(b=>b.close())" >>"$wk" 2>&1; then
    cat "$wk" >>"$LOG"; rm -f "$wk"; return 0; fi
  cat "$wk" >>"$LOG"
  if grep -qiE 'missing dependencies|missing libraries|lib[[:alnum:]._+-]+\.so' "$wk"; then partial_reason=deps
  elif grep -qiE "Executable doesn't exist|connect_rejected|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|HTTP 40[37]|Download failed|failed to download" "$wk"; then partial_reason=egress
  else partial_reason=other; fi
  rm -f "$wk"; return 1
}
ENGINE="$PRIMARY"
if [ "$PRIMARY" != desktop ] || [ -n "${VIEWS:-}" ] || has screens; then
  if ! webkit_ok; then partial=1; ENGINE=desktop; summary+=("🟡 webkit UNAVAILABLE [$partial_reason] → iPhone stages on Chromium, PARTIAL"); fi
fi

run_unit() { npm test; }
run_build() { node tools/inline-vault.mjs --check; }          # press has no build step; inline drift is its build check
run_ui_audit() { rm -f "$UISTEM.txt" "$UISTEM.json"; node test/ui-audit/run.mjs test/ui-audit.config.mjs --evidence "$UISTEM" "$@"; }
run_db_readback() { echo "db: read back db/*.sql against the Supabase connector's list_migrations and cite it (lessons RULE [press] [supabase])"; return 2; }
run_target_gauntlet() { node tools/tenants-check.mjs; }

stage run_unit; stage run_build
stage npx playwright test --project="$ENGINE"                   # every spec on the primary
[ "$PRIMARY" != desktop ] && stage npx playwright test test/marquee.spec.mjs --project=desktop
[ -n "${VIEWS:-}" ] && stage run_ui_audit --views "$VIEWS"
has db && stage run_db_readback
full && has tenant && stage run_target_gauntlet
full && has screens && stage run_ui_audit                       # monthly audit (press carries no Lighthouse)

# Specs rewrite tracked evidence PNGs as a side effect — restore what this run touched, unless asked to keep.
if [ -z "${KEEP_EVIDENCE:-}" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    case $'\n'"$dirty_before"$'\n' in *$'\n'"$f"$'\n'*) summary+=("⚠️ $f was dirty before the run and may have been rewritten by a spec") ;; *) git checkout -- "$f" ;; esac
  done <<< "$(git diff --name-only -- docs/evidence | grep -vE "$KEEP_RE")"
fi
[ -d test-results ] && rm -r test-results

say ""; say "── summary ──"
for l in "${summary[@]}"; do say "$l"; done
if [ "$fail" = 1 ]; then say "GAUNTLET RED — exit 1 — log $LOG"; exit 1
elif [ "$partial" = 1 ]; then say "GAUNTLET PARTIAL (${partial_reason:-other}) — exit 2 — log $LOG"; exit 2
else say "GAUNTLET GREEN — exit 0 — log $LOG"; exit 0; fi
