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

Live; **arc/wings-polish CODE-COMPLETE + GREEN, held as a DRAFT PR (2026-09-24)** pending two tenant
re-vendors. Five slices, all done: private-wing TTL **8h→7 days fixed from unlock** (press-owned copies —
`src/vault.js`→inline into `index.html`+`src/gate.js`); lobby wing cards render **one word per line ≤480px**
with plain-count locklines; perth title **"The Runway — Perth"**; a **printable private-wing recovery kit**
(paper kit is the recovery path, no email reset); and **Family Access opt-out grants** — `access.html`
redesigned to per-person cards with a switch per family tool (ON by default) + Deactivate, and
`press_access_has` redefined to opt-out (active person AND gated family app AND no active=false grant).
Migration `db/20260924_press_access_optout.sql` **applied + live-verified** by Cowork (Mark remit/perth true,
fsa false, unknown false; revoked→false; deactivated→false; T6 remit/perth=1; `press_access_has` authenticated-
only, not anon). Gauntlet green: **65 node + 56 Playwright, 0 skipped; inline:check green.** tenants-check
**26 pass / 2 fail** — the 2 fails are the SKIPPED gate re-vendors (giving-tracker behind origin; card-scout
dirty tree). Gate file re-vendored (7d) into **fsa-claims #14** + **retirement #3** (merged). Per Mark, a
tenants-check RED caused only by skipped repos closes as a **DRAFT PR** — the press PR does NOT merge (so the
slices are not yet published) until giving-tracker + card-scout are re-vendored (see HANDOFF follow-ups). The
four published tenant pages keep 8h until each app's own next release.

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
