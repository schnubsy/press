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

## ⚠️ Decision needed before the close — tenants-check is RED (4 × T3)

Slice 1 bumped `press/src/gate.js` to 7d (`9e11ce15`); the four tenant SOURCE repos still vendor the 8h
gate (`73889011`), so `npm run tenants:check` now reports **4 T3 gate-drift fails** (card-scout, retirement,
giving, fsa). This is the direct, expected consequence of Option 2 (press-owned copies only). The ARC rule
is "tenants-check exits 0", and the auto-close treats a RED gate as a DRAFT PR. **Pick one at resume:**
  (a) re-vendor ONLY the gate file (`cp press/src/gate.js → <repo>/src/vendor/press-gate.js`) in the 4
      source repos so tenants-check → 0 fail, WITHOUT rebuilding/republishing their pages (published pages
      stay 8h until their own release) — restores the invariant, touches 4 external repos minimally; or
  (b) keep press-only and close this arc as a **DRAFT PR** with the 4 T3 fails documented as the follow-ups
      below (no external repos touched); or
  (c) full per-tenant re-vendor + release now (original Option 1).

## Numbered follow-ups — the 4 tenant re-vendors (deferred by Option 2)

Each: `cp press/src/gate.js <repo>/src/vendor/press-gate.js`, then that repo's own release into press
(honours `PRESS_DIR`), with ship proof, to carry the 7-day TTL onto the published page:
1. **fsa-claims** → `fsa.html` (build embeds a non-deterministic build-id; dist != served is expected).
2. **giving-tracker** → `giving.html` (release rewrites PWA asset paths on stage).
3. **retirement** → `retirement.html` (deterministic public build; auto-copies into press sha256-verified).
4. **card-scout** → `card-scout.html` (root file IS the artifact; `inline-gate --check` then blob-compare).
Until done, `grep '8 * 60 * 60'` still hits those four published pages (by design).

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
