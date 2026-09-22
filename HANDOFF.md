# press — HANDOFF

_Last updated: 2026-09-22 — arc/marquee Phases 3–5 (UI batch) CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which is what GitHub
Pages serves) as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state

**arc/marquee Phases 3–5 (the UI batch) is COMPLETE.** The marquee got a visual/UX pass across five slices:
wings-as-squares + Feather page icons, a card↔wing-view copy swap + absolute clock, collapsible Connect +
persistent back-to-wing links, Eye P0 fixes, and a Lighthouse pass (89 perf / 96 a11y on the landing).
`src/gate.js` untouched (`6080e25d…`); the vendored gates keep their own inline copy by design. Gauntlet
green: **43 node + 35 Playwright, 0 skipped** (the +1 Playwright is the new all-connected collapse test).
Closed via ONE PR→merge per touched repo (press, fsa-claims, giving-tracker, retirement); the family
back-links (remit, perth) were edited directly in press. See the close-out manifest / arc report for the
per-page live-200 + `git hash-object` proofs.

## Shipped this arc
- **Slice 1 — layout+icons:** `.tw-wings` grid → two big side-by-side squares, FAMILY left / PRIVATE right
  (private-card full-width fallback when no family space). Feather glyphs via KICKERS+ICONS (fsa/giving/
  retirement/card-scout/family=people/perth=Australia). NOT in `pages.json` (untested there).
- **Slice 2 — copy:** private card "Behind the passkey." ↔ wing title "The Private Wing" (all 3 tw-title
  states); family card "A safer space for the fam" + "The Family Wing" kicker; absolute clock via `clockUntil()`.
  Removed a stale "Signed in with a code." still present in the family wing view at the arc base.
- **Slice 3 — nav+connect:** "← Private/Family Wing" chip in each tool's app chrome (fsa/giving/retirement
  from source; remit/perth direct in press); "Connect your tools" collapses once every tool is connected.
- **Slice 4 — Eye:** 3 P0s actioned (title dedup, mobile kicker gutter, Australia legibility). Rest → BACKLOG.md.
- **Slice 5 — perf:** Lighthouse landing 89/96/96 (budget perf≥85, a11y≥90). `docs/evidence/marquee-lighthouse.json`.

## Open / blockers
- **remit's SOURCE repo carries a stale (pre-`requireSession`) family-gate.** The remit family back-link was
  applied DIRECTLY to `press/remit.html` (gate preserved, requireSession=4); remit's source branch
  `claude/marquee-wing-backlink` holds the same edit but was NOT merged/published (rebuilding would regress
  Phase 1). FOLLOW-UP arc: re-vendor the current family-gate into remit's source, then it can rebuild cleanly.
- **perth's Australia glyph** is soft at 26px (Eye P0 #2, partially fixed). Device-check decision (accept vs
  Feather map-pin) logged in `BACKLOG.md`.
- Non-P0 Eye findings (kicker taxonomy, mobile crowding, FSA glyph semantics, card-scout asymmetry, collapsed
  void) parked in `BACKLOG.md`.

## Exact next steps
Next arc (no inbox pending): work `BACKLOG.md` — decide the perth glyph, then the P1 polish (kicker taxonomy,
mobile card breathing room). Separately: re-vendor the family-gate into remit's source (removes the "edit
remit directly in press" hazard). MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this HANDOFF + `BACKLOG.md`.

## Mark's manual steps (device check — Claude cannot do these; the final gate)
1. **Verify the marquee landing live** (after Pages propagates):
   `git -C ~/Documents/VSCode/press pull && grep -c 'tw-wings' index.html` (expect ≥1) `&&`
   `open 'https://schnubsy.github.io/press/'` — expect the two wings as side-by-side SQUARES (family left,
   private right), the people + shield glyphs, and the four page-icon rows in the wings.
2. **Verify the copy + back-links behind the gates:** sign in to each wing and confirm the private wing view
   titles read "The Private Wing" (big) over "Behind the passkey." (eyebrow), the family view reads "A safer
   space for the fam", the session line shows "Unlocked · N tools · until H:MM", each tool shows a "← Private/
   Family Wing" chip in its chrome, and "Connect your tools" is collapsed to "Manage" when everything is connected.
3. **perth's Australia glyph:** open `?view=family` → perth and judge the icon at row size — accept it or reply
   "swap perth to a map-pin" (BACKLOG.md).
