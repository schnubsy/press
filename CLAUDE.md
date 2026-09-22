Global rules: council arc instrument

# press — Claude instructions

## Purpose

press is the marquee **publishing target** for the council. It hosts single-file pages
served via GitHub Pages. Key pages:

- `index.html` — portal (KICKERS / ICONS driven by `pages.json`)
- `council-guide.html` — council reference guide
- `agent-health.html` — live agent-health dashboard (reads Supabase all-apps views)
- `giving.html`, `halvsies.html`, `retirement.html`, `eagle-path.html`, `kayley.html`

`pages.json` maps `filename → title` for the portal index.

## Stack & how to run

- **Host**: GitHub Pages at https://schnubsy.github.io/press/
- **No build step** — static HTML files only
- **Publish**: via the council press instrument (Lane A hash-verify → commit → push)
- `pages.json` must be updated whenever a new page is published
- `agent-health.html` connects to Supabase all-apps views at runtime (client-side JS)

## Current stage

Live; **arc/marquee Phases 3–5 (UI batch) COMPLETE (2026-09-22).** Landing: the two wings render as big
side-by-side squares (FAMILY left, PRIVATE right) via a new `.tw-wings` grid; Feather-grade page icons via
the KICKERS+ICONS registry (fsa=cross, giving=heart, retirement=trending-up, card-scout=card, family=people,
perth=a small Australia — soft at 26px, device-check decision in `BACKLOG.md`). Copy: a card↔wing-view title
swap (private card "Behind the passkey." / wing title "The Private Wing"; family card "A safer space for the
fam" / kicker "The Family Wing") + an absolute clock "Unlocked · N tools · until 7:41 pm". Nav: a persistent
"← Private/Family Wing" back chip in every tool's app chrome; "Connect your tools" collapses once every tool
is connected. Eye LITE review: 3 P0s, all actioned. `src/gate.js` untouched (`6080e25d…`; vendored gates
carry their own copy by design). Gauntlet green (43 node + 35 Playwright, 0 skipped); Lighthouse 89 perf /
96 a11y on the landing. Family/RLS Phases 1–2 stay closed. Closed via one PR→merge per touched repo with
per-page live verification.

## Project rules

- This is a **publishing target** — pages are authored elsewhere and published here by
  the council press instrument (or an app's own `tools/release.js`), not built in-repo
- Do NOT modify source pages (`*.html`), `pages.json`, or `.github` in this repo
  unless you are the press instrument completing a publish
- **`spaces.json` is repo-owned and OFF-LIMITS to release scripts.** Release scripts only
  READ it (the fail-closed personal-space gate); they must never write it. It decides the
  public/personal split and must never depend on `press_portal` (anon read/write).
- `db/*.sql` mirror the applied Supabase migrations; `src/vault.js` is inlined into
  `index.html` via `tools/inline-vault.mjs` (`--check` guards drift) — the site keeps no build step
- All control-file changes (CLAUDE.md, HANDOFF.md, ARC.md, docs/) are safe to edit
- Lane A publish: hash-verify content before commit; Lane B: any emergency hot-patch
  must be documented in docs/evidence/

## Where things live

| Path | Purpose |
|---|---|
| `index.html` | Portal — reads `pages.json` + `spaces.json`; inlines `src/vault.js` |
| `pages.json` | Page manifest — object keyed by filename `{title}` (release scripts write it) |
| `spaces.json` | Public/personal split `{v,personal[]}` — repo-owned, release scripts only READ it |
| `src/vault.js` · `test/` | Vault module (HKDF + AES-GCM + WebAuthn PRF) + Node/Playwright tests |
| `db/` | Applied Supabase migrations (`press_vault`, `press_deals` gate) |
| `docs/` | Spec, history, lessons, evidence |
| `docs/spec.md` | Portal + page contract |
| `docs/history.md` | Arc history (dated milestones) |
| `docs/lessons.md` | Tag conventions & press lessons |
| `docs/evidence/` | Screenshots, slice receipts |
| `ARC.md` | Arc inbox (pending items) |
| `HANDOFF.md` | Current state & next actions |
