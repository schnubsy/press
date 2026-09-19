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

Live; arc/private-wing-spare-keys-collapse **COMPLETE** (2026-09-19). The private wing's
"Connect your tools" drawer now collapses CONNECTED apps to a quiet line + a real Reconnect
button (fields absent from the DOM until expanded, cleared on collapse); NOT-connected apps
keep the full form. **Card Scout** joined the drawer as sync-id-ONLY (no passphrase, no `pass`
key), verified by probing `press_deals` (`x-plan-id`) — a 200 with ZERO rows is a WRONG key,
never success (the silent-empty RLS trap that emptied its feed). Verdict logic lives in
`src/vault.js` (unit-tested) and is re-inlined via `tools/inline-vault.mjs`. Prior
arc/two-space-marquee stays closed; passkey enrol + `press_deals` gate intact. No open arc items.

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
