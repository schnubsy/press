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

Live; **arc/marquee-polish COMPLETE (2026-09-22).** Corrective UI batch + a cross-repo source-drift repair.
COPY inverted so the BIG text is the wing NAME and the small line the tagline (family "a safe space"/"The
Family Wing"; private "behind the passkey"/"The Private Wing") in both cards and both wing views; the retired
"A safer space for the fam" is gone from live source + tests. ICONS: perth = a plane (Feather paper-plane;
Australia removed), remit = a banknote via a new first-match KICKERS rule (distinct from halvsies' $). LAYOUT:
the two wing squares now fill their grid tracks — family's left edge and private's right edge are flush with
the cards below (a family-lobby edge test asserts ≤1px; aspect-ratio dropped ≤480px so a long kicker can't
clip the lockline). Eye LITE: 1 P0 (mobile clip) fixed. Lighthouse 89/96/96. `src/gate.js` untouched
(`6080e25d…`). REMIT SOURCE repaired: re-vendored the canonical family-gate (`b5ff2b65`, requireSession) +
added the dynamic-head back-link so `node build.js` is BYTE-IDENTICAL to the live `press/remit.html`
(`c866f3f4`) — rebuildable without regressing the Phase-1 gate; NOT republished. Prior marquee UI batch +
Family/RLS phases stay closed. Gauntlet green (43 node + 37 Playwright, 0 skipped). Closed via one PR per
repo (press, remit) + per-page live verification (index.html).

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
