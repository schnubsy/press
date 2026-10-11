# migrate-home — slice 2 — press-specific

## flow decommission — kayley.html compare: **BLOCKED**
- Order: compare flow's `kayley.html` (schnubsy/flow) with press `kayley.html`; carry newer content into press.
- This cloud session cannot read schnubsy/flow: it is not in the session's repo scope, `add_repo` is not in the
  session toolset (delegating it was refused by the permission classifier), and
  `git clone https://github.com/schnubsy/flow` → `fatal: could not read Username for 'https://github.com': terminal prompts disabled`.
  Reading it any other way would be routing around the scope — not done.
- press side, for the next run: `git hash-object kayley.html` = `347e24830ed6e8a1a96ef2247e4c51c7a1fffe91` (unchanged;
  matches migrate.md §2's `347e248`); flow's blob per migrate.md = `779b1c4`.
- **Next:** a press arc (or a session with flow in scope) diffs the two and carries newer content into press **before**
  `gh repo archive schnubsy/flow` (migrate.md §2). Archive stays blocked until then.

## Served pages (CLAUDE.md)
- Private wing now lists `cardsharp.html` (was missing; it is in `spaces.json` personal[] since cardsharp Arc 1).
- Family wing adds `optimo.html` + the `optimo/` app directory (`/press/optimo/`, mirrored by optimo's `tools/release.js`).
- retirement current state: Home github; live blob `77506d017276ea294760b2336fde28ae6d1eaa45` == a fresh
  `node build.js --public` in a clone of retirement main `7143ca3` (2026-10-11) → `tenants.json` retirement note refreshed (note field only).
- Verified against `spaces.json` v2: personal = fsa, giving, retirement, card-scout, access, cardsharp; family = remit, perth, optimo.

## Backlog → Issues (§0 gate)
`BACKLOG.md` Eye LITE items filed as press Issues #28–#32 (`type:enhancement`, `snag`, `page:index`); the one by-design
note stays in `BACKLOG.md`, which now points at Issues.

## Untouched (shared main, publishing target)
No served page, `pages.json`, `spaces.json` or `.github/` changed in this slice.

## T6 family grants (live, Supabase connector, read-only, 2026-10-11)
optimo.html 1 · perth.html 1 · remit.html 2 active grants (≥1 per family page ✔).

## Gauntlet
`docs/evidence/migrate-home-slice-2-gauntlet.txt` — GREEN (unit 91/0 · inline in sync · tenants-check 50/0 · Playwright 80 passed, 1 skipped WebKit-only).
