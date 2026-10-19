Global rules: council arc instrument

# press — Claude instructions

## Purpose

press is the marquee **publishing target** for the council. It hosts single-file pages
served via GitHub Pages. `index.html` is the portal — card kicker / title / icon come from its ONE `LABELS` label map (+ `ICONS` glyphs; the marquee owns card naming, tenants-check T9 enforces an entry per page);
`pages.json` maps `filename → title`, `spaces.json` the tier split, `tenants.json` the tenant registry.

Served pages by tier (contract: `docs/spec.md` → Tenants):
- **Public:** `kayley.html`, `council-guide.html`, `eagle-path.html`, `halvsies.html`, `agent-health.html`
- **Private wing** (WebAuthn passkey + vault): `fsa.html`, `giving.html`, `retirement.html`, `thrift-shop.html` (Thrift Shop; `card-scout.html` = its redirect stub + keyring id), `cardsharp.html`, `access.html` (family admin), `steward.html` (Steward reports — borrows the Thrift Shop (keyring id `card-scout.html`) capability; `supabase/functions/steward-reports/`)
- **Family wing** (email OTP + JWT + per-page grants): `remit.html`, `perth.html`, `app-lab.html` (App Lab), `optimo.html` (no card — listed in App Lab)
- **optimo** = an **App Lab** prototype (optimo arc app-lab, 2026-10-14): `optimo.html` is its Family Wing sign-in step only
  (pages.json `parent: app-lab.html` ⇒ no wing card; still in spaces.json family, grant key unchanged); the app is served at
  `/press/app-lab/optimo/` and listed in `app-lab/prototypes.json`, all mirrored by optimo's `web/tools/release.js`;
  `/press/optimo/` = redirect tombstone.
- **retirement** (`retirement.html`) — Home `github:schnubsy/retirement`; live = its `--public` build from merge `a0d0b80`
  (published `b99282b`, 2026-10-10; blob `77506d01` == a fresh rebuild, 2026-10-11).
- Tier truth is `spaces.json`; tenant metadata `tenants.json`; titles `pages.json`.

## Stack & how to run

- **Host**: GitHub Pages at https://schnubsy.github.io/press/
- **No build step** — static HTML files only
- **Ship gate:** `bash scripts/gauntlet.sh` via `.claude/skills/verify/SKILL.md` (WebKit install · node --test · inline:check ·
  tenants-check · Playwright chromium + iphone-webkit · ui-audit on WebKit; cloud clone or Mac — exit 2 = PARTIAL (egress))
- **Publish**: via the council press instrument (Lane A hash-verify → commit → push)
- `pages.json` must be updated whenever a new page is published
- `agent-health.html` connects to Supabase all-apps views at runtime (client-side JS)

## Current stage

Home: github:schnubsy/press
Merge state: PR pending (branch arc/amazon-memos-monitor)
**arc/amazon-memos-monitor (2026-10-19) — Agent Monitor registers the weekly Amazon memos task + night-window times.**
`db/20261019_amazon_memos_expect.sql` (staged by council PR #56, applied verbatim): `press_agent_expect` row `amazon-memos`
(The Money · browser-task · checkin · Mon 01:43 CT · grace 1440) + five check-in rows moved to their night-window times
(card-scout Wed 03:41, cowork-popup Mon 02:52, snag-train 2nd 02:13, steward-audit 1st 04:14, steward-watch Mon 04:24).
Applied live after merge. No page or publish change. Before it: tenants-check-siblings. Narrative: `docs/history.md`.

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
| `index.html` | Portal — reads `pages.json` + `spaces.json`; `LABELS` label map owns card kicker/title/icon; inlines `src/vault.js` |
| `pages.json` | Page manifest — object keyed by filename `{title}` = tab title (release scripts write it; card wording lives in index.html `LABELS`) |
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
