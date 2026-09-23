# press — HANDOFF

_Last updated: 2026-09-22 — arc/marquee-tenancy CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state

**arc/marquee-tenancy is COMPLETE.** The marquee is a documented **platform with tenants**: `tenants.json`
(repo-owned) is the registry, `docs/spec.md` → Tenants the canonical contract, `tools/tenants-check.mjs` the
audit (T1–T6). remit + retirement `release.js` honour `PRESS_DIR`. Council **4.6.0** (audit DETECT group 7 +
arc tenant-change template). Five repos closed via one PR each; `council-guide.html` republished + live-verified.

Mid-arc, remit's `arc/scratchpad-rework` shipped to press main (magic-link family-gate `9eba177d` now
canonical, `remit.html` `2c4ac65e`); this branch was **rebased** onto it — remit's vendored gate == canonical
(the "drift" tenants-check first flagged was a stale base, now resolved). No tenant is drifted.

## Shipped this arc
- **press #14 (`9cf7e1c`):** `tenants.json`; `docs/spec.md` → Tenants; `tools/tenants-check.mjs` + 15 tests
  (`npm run tenants:check`); CLAUDE.md pages-by-tier; **published** `council-guide.html` v4.2.0→v4.6.0.
- **council #3 (`a67d14f`):** press.md → pointer (31→24 lines, "Open RLS" gone); arc.md tenant-change template;
  audit.md group 7 + group-4 dossiers sweep; five stamps 4.6.0; trigger parity; bundle rebuilt (1,797,620 B).
- **remit #3 (`42c683c`):** release.js + publish-checks.js honour `PRESS_DIR`.
- **retirement #2 (`a47b277`):** release.js auto-copies dist → press/retirement.html (sha256-verified).
- **claude-environment #2 (`661f6ee`):** MANUAL §12.2 + §1.1 pointers/tier-table; §7.1 stamp; CHANGELOG 4.6.0.
- dossiers/dossier-core.md header renamed off the retired name (on disk, no git).

## Verification
- Gauntlet green: **63 node + 40 Playwright, 0 skipped**; `tenants-check --rebuild` 30 pass / 0 fail.
- Ship proof (guide): live 200 · live blob `e9273078` == source · asset `seal_eye.svg` 200 · badge/footer v4.6.0.
- T6 grants read live (Supabase MCP): `remit.html`=1, `perth.html`=1 active grant → 🟢 not gated-but-locked.
- All five main checkouts reconciled: HEAD == each PR's merge SHA.

## Open / blockers
- **No blockers.** All close-out steps DONE (see the arc report's manifest). No tenant was flagged BLOCKED.
- remit's own queued arc **`arc/gate-hardening-and-fx`** (remit/ARC.md) is untouched — still its next arc.
- The press copy of `council-guide.html` is now current (v4.6.0); future council-guide edits still republish
  (audit DETECT-3). `BACKLOG.md` holds prior non-P0 polish.

## Exact next steps
No press inbox pending. Next arc: `BACKLOG.md` polish, or remit's `arc/gate-hardening-and-fx`.
MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this HANDOFF + `BACKLOG.md`.

## Mark's manual steps (the only things Claude cannot do)
1. **Reload the council bundle:** in Claude Desktop, reload `dist/council.plugin`, then a fresh Cowork chat
   canary — "state the council version and list the audit check groups" — **expect v4.6.0 and seven groups**
   (…6. Projects, 7. Marquee tenants). A stale answer = the Desktop reload has not propagated (not a repo bug).
