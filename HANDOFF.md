# press — HANDOFF

_Last updated: 2026-09-24 — arc/wings-polish **CODE-COMPLETE + GREEN, held as a DRAFT PR** (2 tenant re-vendors pending)._

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state — arc/wings-polish

All five slices are done and committed on `claude/arc-wings-polish-0e3d69`; the migration is applied and
live-verified. The press arc is **held as a DRAFT PR** because `tenants-check` is RED **only** on the two
tenant repos that were correctly SKIPPED by the re-vendor guard (Mark's rule: RED-only-from-skips ⇒ DRAFT,
do not force). The press PR does NOT merge — and so the slices are NOT yet published — until those two are
re-vendored.

- **Slice 1** — private-wing TTL **8h→7 days, fixed from unlock** (press-owned copies; `src/vault.js`→inline).
- **Slice 2** — lobby wing cards: one word per line ≤480px; plain-count locklines.
- **Slice 3** — perth title → "The Runway — Perth".
- **Slice 4** — Family Access **opt-out grants**; `access.html` redesigned; sign-in loop bug fixed;
  `db/20260924_press_access_optout.sql` applied + live-verified.
- **Slice 5** — private-wing **printable recovery kit**; no email reset by design.

Gauntlet: **65 node + 56 Playwright, 0 skipped; inline:check green.** `tenants-check`: **26 pass / 2 fail**
(giving.html, card-scout.html — the two skips).

## Close-out manifest

| Step | Status |
|---|---|
| push (arc branch) | DONE — `claude/arc-wings-polish-0e3d69` pushed. |
| PR | **DRAFT** — press PR opened `--base main` as a draft (link in the arc report). |
| merge | **HELD** — not merged; tenants-check RED from the 2 skipped tenant re-vendors (Mark: do not force). |
| reconcile main | N/A while unmerged. |
| migrations | DONE — `db/20260924_press_access_optout.sql` applied by Cowork + live-verified (evidence: `wings-polish-slice-4-live-verify.txt`). |
| tenant gate re-vendor | DONE for **fsa-claims #14** + **retirement #3** (merged, main reconciled, vendored == `9e11ce15`); SKIPPED for giving-tracker + card-scout (follow-ups below). |
| deploy | N/A (no build step / no edge fn this arc). |
| publish | **PENDING the press merge** — perth.html + access.html are press-native (served from main); index.html carries slices 1/2/5. Nothing is live until the DRAFT PR flips to ready and merges. |
| inbox cleanup | N/A (ARC.md committed in-branch). |
| handoff | DONE — CLAUDE.md Current stage, docs/history.md, docs/lessons.md, this file, ARC.md all updated. |

## Numbered follow-ups — clear these two, then flip the PR to ready and merge

1. **giving-tracker gate re-vendor.** It was behind origin/main (clean tree). `git -C ~/Documents/VSCode/giving-tracker pull --ff-only`, then the guarded flow: branch `chore/revendor-gate-7d`, `cp press/src/gate.js src/vendor/press-gate.js`, assert `git hash-object` == canonical, one-file commit, push, PR, merge, reconcile. No rebuild/release. Its published `giving.html` stays 8h until giving-tracker's own next release.
2. **card-scout gate re-vendor.** Its tree had 1 dirty file (in-progress work — untouched). Once clean, same guarded flow into `src/vendor/press-gate.js`. `card-scout.html` (root IS the artifact) stays 8h until card-scout's own next release.

After both: `npm run tenants:check` exits 0 → mark the press PR ready → merge → reconcile the MAIN CHECKOUT
(`~/Documents/VSCode/press`) to the merge SHA → publish-verify (perth.html + access.html live 200 and
`git hash-object` == GitHub blob) → ship proof → final /council:handoff.

Separately (any time, each in its OWN arc/release): the 4 published tenant pages still inline 8h; each carries
the 7-day TTL onto its page only when that app next builds + releases (fsa/giving/retirement/card-scout).

## Mark's manual steps
1. **Review + decide on the DRAFT press PR.** Either let Code clear follow-ups 1–2 then merge, or merge the
   press arc now knowing tenants-check will read 2 T3 skips on main until the two re-vendors land (your call —
   the current default is DRAFT-until-green).
2. **Reload the council bundle** if council files changed (they did not this arc).
3. Optional: Auth → Sessions dashboard glance (no time-box) — does not affect the private wing (client-side
   localStorage TTL); recorded in `docs/evidence/wings-polish-slice-1-ttl.txt`.

MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this HANDOFF.
