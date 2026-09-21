# ARC — arc/perth-runway

_Opened 2026-09-21 by the Council (Ear gut-check → Eye lite → Forge). Orchestrated in Cowork;
slices run in Claude Code._

## Decree

Publish `perth.html` to the Marquee — a shared family board tracking everything needed for
Brandon's move to Perth, arriving **14 Jan 2027**. A page, not an app: one self-contained file,
`press_tasks` state lane 2, Lane A publish.

## Decisions taken (do NOT re-litigate)

| # | Decision | Source |
|---|---|---|
| 1 | **Brandon is an Australian citizen living with family in Perth.** No visa branch. The entire visa/OSHC/CoE chain is OUT; the passport + citizenship-by-descent chain is IN and is the critical path. | Mark, 2026-09-21 |
| 2 | **Public page for now.** Not added to `spaces.json`; migrates to the family wing when that lands. Naming discipline applies: task titles carry no personal identifiers. | Mark, 2026-09-21 |
| 3 | **Design = The Runway** (Eye, lite mode). Switchable axis — weeks-to-departure timeline OR category lanes, same cards, same drag gesture. Coastline header warming cool→gold toward January; continent watermark at 7%. | Eye, 2026-09-21 |
| 4 | **Scope = middle path.** Drag-and-drop KEPT (desktop HTML5 drag; tap-to-drawer on touch). Threaded comments CUT → one append-only notes log per card. Added on the Ear's call: a third status `lodged`, a link field, and JSON export. | Ear + Mark, 2026-09-21 |
| 5 | Ear flagged open RLS 🔴 for medical/school content. Mitigated by (2) + the export button, not by a gate. Revisit at family-wing migration. | Ear, 2026-09-21 |

## Data

- Table `public.press_tasks`, `page='perth'`. 99 task rows + one `__meta__` row
  (`categories[]`, `people[]`, `depart`). Row shape per the press instrument; page-specific
  fields ride in `extras` (`due`, `flag`, `note`, `link`, `assignees[]`, `log[]`).
- Seed payload committed at `docs/evidence/perth-seed.json` — source-derived, every item
  carrying its authoritative link. Categories (10): Passport & citizenship · University (TISC) ·
  Schooling (if applicable) · Medical & health · Money & tax · Driving · Shipping & belongings ·
  Phone, mail & US admin · Departure & arrival · Perth week one.

## Slices

- [ ] **S1 — Seed.** POST `docs/evidence/perth-seed.json` to PostgREST (`press_tasks`,
      upsert on `page,item_id`), after deleting any existing `page='perth'` rows. Verify the
      round-trip count is 100 and that `__meta__` holds 10 categories.
- [ ] **S2 — Manifest.** Add `"perth.html": {"title": "Perth · The Runway"}` to root `pages.json`.
      Do NOT touch `spaces.json`.
- [ ] **S3 — Favicon register.** Add the `perth.html` row to `docs/favicons.md`:
      ground `#22312F`, accents `#6B7F6A → #D8C6A3` + `#E08B4E`, glyph "pin on a horizon", lane inline.
- [ ] **S4 — Publish.** Commit `perth.html` + `pages.json` + `docs/favicons.md` + the four
      `docs/evidence/perth-*` files. Hash-verify `git hash-object perth.html` against the GitHub
      blob SHA. Push to `main` (Pages serves `main`; standing auto-close rule applies).
- [ ] **S5 — Verify live.** `raw.githubusercontent.com` hash match; page boots, both axes render,
      99 cards load from Supabase, mobile has no horizontal scroll.
- [ ] **S6 — `/council:handoff`.**

## Gates

Built and verified in Cowork before hand-off: JS syntax clean (`node --check`), headless
Chromium smoke green (99 cards, 24 runway columns, 10 category columns, filters, search,
status cycle, drawer, assignment, notes log, category + people CRUD, add task, JSON export,
no console errors, no mobile h-scroll), favicon decodes to well-formed SVG and was judged at 16×16.
Input blob hash: `379e3d1923ec57100016eae6a0e0f8feea54d47c`.

## Notes for the executor

- **Working tree was already dirty on arrival** — `docs/evidence/marquee-desktop.png`,
  `marquee-mobile.png`, `two-space-personal-unlocked.png` are modified and are NOT part of this
  arc. Do not sweep them into the publish commit.
- **HANDOFF.md is stale**: it records `9ae3424` as HEAD; actual HEAD at arc open was `0dd30ca`
  (giving.html passkey gate). Reconcile during `/council:handoff`.
- The Supabase domain is unreachable from both the Cowork container and the device bridge VM.
  S1 must run natively on the Mac.
