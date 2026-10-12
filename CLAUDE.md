Global rules: council arc instrument

# press — Claude instructions

## Purpose

press is the marquee **publishing target** for the council. It hosts single-file pages
served via GitHub Pages. `index.html` is the portal (KICKERS / ICONS driven by `pages.json`);
`pages.json` maps `filename → title`, `spaces.json` the tier split, `tenants.json` the tenant registry.

Served pages by tier (contract: `docs/spec.md` → Tenants):
- **Public:** `kayley.html`, `council-guide.html`, `eagle-path.html`, `halvsies.html`, `agent-health.html`
- **Private wing** (WebAuthn passkey + vault): `fsa.html`, `giving.html`, `retirement.html`, `card-scout.html`, `cardsharp.html`, `access.html` (family admin), `steward.html` (Steward reports — borrows the Card Scout capability; `supabase/functions/steward-reports/`)
- **Family wing** (email OTP + JWT + per-page grants): `remit.html`, `perth.html`, `optimo.html`
- **optimo** = `optimo.html` (family-wing launcher card) + the `optimo/` app directory (the PWA, served at
  `/press/optimo/`), both mirrored by optimo's own `tools/release.js` (optimo migrate-home, 2026-10-10, from merge `83cdcc1`).
- **retirement** (`retirement.html`) — Home `github:schnubsy/retirement`; live = its `--public` build from merge `a0d0b80`
  (published `b99282b`, 2026-10-10; blob `77506d01` == a fresh rebuild, 2026-10-11).
- Tier truth is `spaces.json`; tenant metadata `tenants.json`; titles `pages.json`.

## Stack & how to run

- **Host**: GitHub Pages at https://schnubsy.github.io/press/
- **No build step** — static HTML files only
- **Ship gate:** `bash scripts/gauntlet.sh` via `.claude/skills/verify/SKILL.md` (node --test · inline:check · tenants-check ·
  Playwright; runs in a cloud clone — Chromium only there, real WebKit on the Mac)
- **Publish**: via the council press instrument (Lane A hash-verify → commit → push)
- `pages.json` must be updated whenever a new page is published
- `agent-health.html` connects to Supabase all-apps views at runtime (client-side JS)

## Current stage

Home: github:schnubsy/press
Merge state: PR pending (branch arc/steward-report)
**arc/steward-report (2026-10-12) — Steward report page; cloud Builder.** New press-native PRIVATE-wing `steward.html`
(latest report + 12-week calendar-week strip, 390-first) over the service-role-only `press_steward_reports` table, read
through the new `steward-reports` Edge Function (v2), which checks the private wing's Card Scout capability against the
server-held `press_deals.sync_id` default via the service-role-only RPC `press_steward_capability_ok`. Gauntlet: unit 101 ·
Playwright 88 + 1 WebKit skip · tenants-check steward rows PASS (21 env-only FAILs: tenant repos outside cloud scope).
Open: fixture row delete + `.claude/settings.json` (classifier) + press_deals anon INSERT — HANDOFF. Narrative: `docs/history.md`.

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
