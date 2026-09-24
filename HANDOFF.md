# press — HANDOFF

_Last updated: 2026-09-24 — arc/wings-polish **COMPLETE** (merged + published)._

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state — arc/wings-polish COMPLETE

Five slices, all shipped from `main`:
- **Slice 1** — private-wing TTL **8h→7 days, fixed from unlock** (press-owned copies; `src/vault.js`→inline).
- **Slice 2** — lobby wing cards: one word per line ≤480px; plain-count locklines.
- **Slice 3** — perth title → "The Runway — Perth".
- **Slice 4** — Family Access **opt-out grants**; `access.html` redesigned; sign-in loop bug fixed;
  `db/20260924_press_access_optout.sql` applied + live-verified.
- **Slice 5** — private-wing **printable recovery kit**; no email reset by design.

Gauntlet: **65 node + 56 Playwright, 0 skipped; inline:check green; tenants-check 28 pass / 0 fail.**

## Close-out manifest

| Step | Status |
|---|---|
| push | DONE — `claude/arc-wings-polish-0e3d69`. |
| PR | DONE — press #16 (`--base main`), flipped ready. |
| merge | DONE — #16 merged (merge SHA in the arc report). |
| reconcile main | DONE — `~/Documents/VSCode/press` main HEAD == merge SHA. |
| migrations | DONE — `press_access_optout` applied by Cowork + live-verified (`wings-polish-slice-4-live-verify.txt`). |
| tenant gate re-vendor | DONE — fsa-claims #14, retirement #3, giving-tracker #10, card-scout #15 (all merged; vendored == `9e11ce15`). |
| deploy | N/A (no build step / no edge fn). |
| publish | DONE — index.html + perth.html + access.html live 200 and `git hash-object` == GitHub blob (proof in arc report). |
| inbox cleanup | N/A (ARC.md committed in-branch). |
| handoff | DONE — CLAUDE stage, history, lessons, this file, ARC all updated. |

## Standing follow-ups (each in that app's OWN arc/release — not this arc)
The four PUBLISHED tenant pages still inline the 8h TTL constant; each carries the 7-day TTL onto its page
only when that app next builds + releases (fsa-claims, giving-tracker, retirement, card-scout). Their
vendored `press-gate.js` is already the 7d canonical, so `node build.js` / release will pick it up. Each
tenant page already HONOURS a portal-minted 7-day session today (proven in `test/ttl-honored.spec.mjs`).

Note: **card-scout has an uncommitted seeded `ARC.md`** (its own next "fixes arc"; hash `e00a419`) —
untouched by this arc; card-scout's own session commits it as that arc's first action.

## Mark's manual steps
1. **Reload the council bundle** if council files changed (they did not this arc).
2. Optional: Auth → Sessions dashboard glance (no time-box) — does not affect the private wing (client-side
   localStorage TTL); recorded in `docs/evidence/wings-polish-slice-1-ttl.txt`.

MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this HANDOFF.
