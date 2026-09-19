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

Live; **arc/align-retirement COMPLETE (2026-09-19, pushed `9ae3424`).** The passkey-only Slice 1
(`kind:'local'` + "Protect your local tools" + per-tool `data_key`) is REVERTED — `index.html` is
byte-identical to `f054714` (retirement is a normal cloud Connect tool again), `test/protect.spec.mjs`
removed, `test/marquee.spec.mjs` reverted; only `src/gate.testkit.mjs`'s standard-ArrayBuffer-PRF-at-
create shim is KEPT (a real, design-independent gap fix). **`retirement.html` republished** with the
gated build — fsa's `PressGate` page lock over retirement's existing cloud sync, built + gated by
`retirement/tools/release.js`. Prior arc/private-wing-spare-keys-collapse (drawer collapse + Card
Scout) stays closed; passkey enrol + `press_deals` gate intact. Gauntlet: 31/31 unit, `inline:check`
clean, 25/25 smoke. **Follow-ups (2026-09-19):** retirement's keyring residue pruned → all app entries
are now shape-identical (`fsa`/`giving`/`retirement` → `{ pass, sync_id }`, `card-scout` → `{ sync_id }`);
the public standalone `retirement-projection` Pages site was retired (unpublished, 404), so
`press/retirement.html` is retirement's ONLY deployment. No open arc items.

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
