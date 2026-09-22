# press — HANDOFF

_Last updated: 2026-09-22 — arc/marquee-polish CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state

**arc/marquee-polish is COMPLETE** — a corrective UI batch on the marquee plus a remit source-drift repair.
Copy inverted (BIG = wing name, small = tagline) everywhere; perth icon = a plane, remit icon = a banknote;
the two wing squares are flush with the cards below; one Eye P0 (mobile card clip) fixed. `src/gate.js`
untouched (`6080e25d`). Only `index.html` changed as a served page. Gauntlet green: **43 node + 37 Playwright,
0 skipped** (37 = 35 + the 2 new edge-alignment tests). Lighthouse landing 89 perf / 96 a11y / 96 bp. Closed
via one PR per repo (press + remit); see the close-out manifest / report for the index.html live-200 + hash proof.

## Shipped this arc
- **Copy:** inverted labels in family+private card AND wing view (family "a safe space"/"The Family Wing";
  private "behind the passkey"/"The Private Wing"); retired "A safer space for the fam" from live source+tests;
  test pins updated (marquee.spec:109, family-lobby:72 + kicker).
- **Icons:** perth → Feather paper-plane (Australia gone); remit → banknote via a new first-match `[/remit/]`
  KICKERS rule (distinct from halvsies' `$`).
- **Layout:** removed the square `max-height` so each wing square fills its 1fr track — family LEFT/private
  RIGHT edges flush with the cards (dL=dR=0.00); 2 acceptance tests assert ≤1px; `aspect-ratio:auto` ≤480px
  so a long kicker can't clip the lockline.
- **remit source repair:** re-vendored the canonical family-gate (`b5ff2b65`, requireSession) + added the
  dynamic-head back-link + aligned .tw-back CSS → `node build.js` is BYTE-IDENTICAL to the live
  `press/remit.html` (`c866f3f4`). remit rebuildable without regressing the Phase-1 gate; **NOT republished**.
- Landed 3 uncommitted council inbox files (remit ARC.md+HANDOFF.md, giving-tracker ARC.md) rather than discarding.

## Open / blockers
- No blockers. `BACKLOG.md` holds non-P0 polish from the prior Eye pass (kicker taxonomy, mobile card
  breathing room, FSA glyph semantics, card-scout asymmetry, collapsed-Connect void).
- **remit has its own live, unstarted arc order** in `remit/ARC.md` (`arc/gate-hardening-and-fx`, slices 2–6,
  Cowork-authored) — now committed. That is remit's next arc, independent of press.

## Exact next steps
Next arc (no press inbox pending): pick up `BACKLOG.md` polish, or start remit's `arc/gate-hardening-and-fx`
from `remit/ARC.md`. MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this HANDOFF + `BACKLOG.md`.

## Mark's manual steps (device check — Claude cannot do this; the final gate)
1. **Verify the marquee live** (after Pages propagates):
   `git -C ~/Documents/VSCode/press pull && grep -c "a safe space" index.html` (expect ≥1) `&&`
   `open 'https://schnubsy.github.io/press/'` — expect: both wing cards read BIG name / small tagline
   ("The Family Wing" over "a safe space"; "The Private Wing" over "behind the passkey"), the squares' outer
   edges flush with the cards below, and on a phone the private card shows the full "Set up the private wing"
   (no clip). Sign in to the family wing and confirm remit shows a banknote icon and perth a plane.
