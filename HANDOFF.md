# press — HANDOFF

_Last updated: 2026-09-24 — arc/wings-polish **PAUSED at the declared DDL stop** (slice 4)._

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state — arc/wings-polish, paused

Branch `claude/arc-wings-polish-0e3d69` (worktree `perth-phase-2-security-c7a88b`). Five slices; slices
1·2·3·5 are DONE and committed; **slice 4 is authored (code + migration) and the arc has STOPPED at its
one declared stop** so Cowork can apply the DDL (Code's Supabase MCP is read-only for DDL).

- **Slice 1 — private-wing weekly re-lock.** TTL 8h → **7 days, fixed from unlock**, in the PRESS-OWNED
  copies only (Mark's Option 2): `src/vault.js` → inlined into `index.html` + `src/gate.js`. loadSession
  keeps `expiresAt` fixed (no slide-on-use). Unit + Playwright proof that the 4 published tenant pages
  honour a portal-minted 7-day session (`test/ttl-honored.spec.mjs`).
- **Slice 2 — mobile wing cards.** Wing headings render one word per line at ≤480px (explicit per-word
  `<span>` blocks; desktop inline). Both locklines are plain tool counts; first-run "Set up the private
  wing" kept. h3-name contracts unchanged.
- **Slice 3 — perth title.** "Perth · The Runway" → **"The Runway — Perth"** (perth.html + pages.json).
- **Slice 5 — private-wing recovery kit.** Unlocked wing gains **Print recovery kit** — a print-styled
  sheet of every keyring entry (app, sync ID, passphrase) + restore steps; hidden when locked; card-scout
  shows "no passphrase" and never prints its sentinel. spec.md: paper kit is the recovery path, no email reset.
- **Slice 4 — Family Access redesign + opt-out grants.** `access.html` rewritten (per-person cards, a
  switch per family tool ON by default, Deactivate; the "which tools are gated" section removed; sign-in
  loop bug fixed; 6–10 digit codes). Migration authored. **⟵ STOP HERE.**

Gauntlet at the stop: **node 65/0/0 · Playwright 56/0** (was 40) · `inline:check` green.

## 🔴 Mark / Cowork — the DDL stop (do this to resume)

**Apply `db/20260924_press_access_optout.sql`** via the Supabase connector (press project
`eepjhpyziczrxvirczio`). It redefines `press_access_has(page)` to opt-out semantics and ensures
`remit.html` + `perth.html` are `press_access_apps.gated=true`. Then tell Code to resume.

## ✅ RATIFIED (Mark 2026-09-24) — tenants-check green via gate-file re-vendor (Option 1, guarded)

Slice 1 bumped `press/src/gate.js` to 7d (`9e11ce15`); the four tenant SOURCE repos still vendor the 8h
gate (`73889011`), so `npm run tenants:check` reports **4 T3 gate-drift fails**. Fix AT THE CLOSE by
re-vendoring the gate FILE ONLY into each eligible tenant repo (no rebuild, no release):

**Per tenant repo — guard, then act:**
- **Precondition:** working tree CLEAN **and** on `main` **synced with origin**. If not → **SKIP** that
  repo, add it as a numbered follow-up below; DO NOT stash or touch in-progress work.
- **Otherwise:** branch `chore/revendor-gate-7d` → `cp press/src/gate.js src/vendor/press-gate.js` →
  assert `git hash-object src/vendor/press-gate.js` == canonical (`9e11ce15…`, re-read from press main at
  execution) → commit THAT ONE FILE by name → push → `gh pr create --fill` → `gh pr merge --merge
  --delete-branch` → reconcile that repo's main. **No rebuild, no release.**
- After all eligible repos: `npm run tenants:check` must exit 0.
- Each tenant's PUBLISHED page stays 8h until its own next release (that carries the 7d TTL onto the page).

**Eligibility pre-check (2026-09-24, read-only; RE-VERIFY at execution — states drift):**
- **fsa-claims** — main · clean · synced (0/0) → **ELIGIBLE**.
- **retirement** — main · clean · synced (0/0) → **ELIGIBLE**.
- **giving-tracker** — main · clean · **behind origin/main by 2** → **SKIP** (needs `git pull --ff-only`
  first, then it becomes eligible) → follow-up 1.
- **card-scout** — main · **1 dirty file** → **SKIP** (in-progress work; do not touch) → follow-up 2.

## Numbered follow-ups (deferred)
1. **giving-tracker** → re-vendor gate once its main is synced (`git pull --ff-only`), then the guarded
   flow above. Its published `giving.html` also stays 8h until its own next release.
2. **card-scout** → re-vendor gate once its working tree is clean, then the guarded flow. `card-scout.html`
   (root IS the artifact) stays 8h until its own next release.
Until every tenant is re-vendored AND has re-released, `grep '8 * 60 * 60'` still hits the published
tenant pages (by design — Option 2).

## Resume checklist (Code, after the DDL is applied)
1. Verify the live opt-out function via read-only MCP: no-grant person → `press_access_has` true for
   remit+perth; an `active=false` grant → false; a deactivated person → false. Advisor must NOT list
   `press_access_has` under `anon_security_definer_function_executable`. T6 ≥ 1 active grant per family page.
2. Resolve the tenants-check decision above.
3. Close: push · `gh pr create --fill --base main` · (auto-merge only if BOTH gates green, else DRAFT) ·
   reconcile the MAIN CHECKOUT (`~/Documents/VSCode/press`) to the merge SHA · PUBLISH (perth.html +
   access.html are press-native → served from main; verify live 200 + `git hash-object` == GitHub blob) ·
   ship proof · final /council:handoff · close-out manifest.

## Mark's manual steps
1. **Apply the migration** (above).
2. **Reload the council bundle** if council files changed (they did not this arc).
3. Optional dashboard glance: Auth → Sessions has no time-box (does not affect the private wing, which is
   a client-side localStorage TTL — recorded in `docs/evidence/wings-polish-slice-1-ttl.txt`).

MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this HANDOFF.
