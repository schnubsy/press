Global rules: council arc instrument

# press — Claude instructions

## Purpose

press is the marquee **publishing target** for the council. It hosts single-file pages
served via GitHub Pages. `index.html` is the portal (KICKERS / ICONS driven by `pages.json`);
`pages.json` maps `filename → title`, `spaces.json` the tier split, `tenants.json` the tenant registry.

Served pages by tier (contract: `docs/spec.md` → Tenants):
- **Public:** `kayley.html`, `council-guide.html`, `eagle-path.html`, `halvsies.html`, `agent-health.html`
- **Private wing** (WebAuthn passkey + vault): `fsa.html`, `giving.html`, `retirement.html`, `card-scout.html`, `access.html` (family admin)
- **Family wing** (email OTP + JWT + per-page grants): `remit.html`, `perth.html`

## Stack & how to run

- **Host**: GitHub Pages at https://schnubsy.github.io/press/
- **No build step** — static HTML files only
- **Publish**: via the council press instrument (Lane A hash-verify → commit → push)
- `pages.json` must be updated whenever a new page is published
- `agent-health.html` connects to Supabase all-apps views at runtime (client-side JS)

## Current stage

Live; **arc/marquee-tenancy COMPLETE (2026-09-22).** The marquee is a documented PLATFORM with TENANTS:
`tenants.json` (repo-owned) keys every page to repo/tier/gate/vendored/release/deterministic; `docs/spec.md`
→ Tenants is the canonical contract (council press.md + MANUAL §12.2 now point to it). `tools/tenants-check.mjs`
audits every coupling (T1–T6; 15 tests; `npm run tenants:check`); remit + retirement `release.js` honour
`PRESS_DIR`. Council 4.6.0 (audit DETECT group 7 + arc tenant-change template). Mid-arc remit's
`arc/scratchpad-rework` shipped (magic-link family-gate `9eba177d` now canonical, remit.html `2c4ac65e`) — this
branch was rebased onto it, so remit's vendored gate == canonical (no drift). Gauntlet green: 63 node + 40
Playwright, 0 skipped; tenants-check --rebuild 30 pass 0 fail. `council-guide.html` republished v4.2.0→v4.6.0
(live 200, blob `e9273078`). Closed one PR/repo (press#14 council#3 remit#3 retirement#2 env#2); T6 grants
verified remit/perth = 1 active each.

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
