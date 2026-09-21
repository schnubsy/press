# press — HANDOFF

_Last updated: 2026-09-21 — arc/perth-runway CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge
approval from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which is what
GitHub Pages serves) as part of closing out — do not stop to ask. Set by Mark 2026-09-18.
(Auto-merge is still never enabled pre-emptively; this is only about merging a finished, green change.)

## Current state

**arc/perth-runway is COMPLETE and pushed (`99a7c87` on `main`).** `perth.html` — "The Runway", a public
family board for Brandon's move to Perth (arriving 14 Jan 2027), backed by `press_tasks` (`page='perth'`).
Live at `https://schnubsy.github.io/press/perth.html`; listed on the Marquee portal. Prior
arc/align-retirement stays closed.

_HEAD lineage reconciled: the previous HANDOFF recorded `9ae3424` as HEAD, but HEAD at this arc's open
was `0dd30ca` (giving.html passkey gate; `9ae3424` was superseded by later publishes). This arc built on
`0dd30ca` → publish `99a7c87` → this close._

## Shipped this arc
- **Seed (`page='perth'`):** 99 tasks + one `__meta__` (10 categories, 2 people, `depart=2027-01-14`)
  upserted to PostgREST (`on_conflict=page,item_id`, batches of 25) after deleting existing perth rows;
  round-trip verified 100 rows with a field-for-field sample match (order-insensitive on `extras`).
- **Publish (`99a7c87`, Lane A):** `perth.html` (input blob `379e3d19…`, hash-verified), plus
  `pages.json` (`"perth.html": {"title":"Perth · The Runway"}`), `docs/favicons.md` (pin-on-a-horizon
  glyph), `ARC.md`, and the four `docs/evidence/perth-*` files. Pushed to `main`.
- **Verified live:** raw blob SHA matched; both axes render (Runway 24 week columns incl. "Departure
  week" 11–17 Jan; Categories 10 lanes); 99 cards load from Supabase; people strip renders; sync pill
  "synced"; portal shows the NEW card; no mobile h-scroll.

## Open / blockers
- **Open RLS on medical/school content (🔴, Ear).** Mitigated by keeping the page public with NO personal
  identifiers in task titles + the JSON export button — NOT by a gate. Revisit at family-wing migration,
  when `perth.html` moves into `spaces.json` (personal split).
- Standing (from prior arc): `inline:check` guards only press's own `vault.js`; each sibling app owns its
  vendored-gate byte-check. fsa's vendored `press-gate.js` has drifted from `src/gate.js` — an fsa arc.

## Exact next steps
No open arc items. Publishing another tool page: build+gate it in its own repo, `cp` its `dist` here,
update `pages.json` if new, keep `spaces.json` correct, then merge/push to `main` (per the standing rule).
When perth migrates to the family wing, add `perth.html` to `spaces.json` and re-verify the personal split.

## Mark's manual steps
None on press.
