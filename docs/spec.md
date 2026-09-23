# press — spec

## Overview

press is a static GitHub Pages site at https://schnubsy.github.io/press/ that serves
as the marquee publishing target for the council system. No build step — what is
committed is what is served.

## Two spaces (public + personal wing)

The marquee is split into two spaces:

- **Public** — open-access cards, plus the Archive card. Anyone can view them; nothing
  is required to see the landing or the public marquee.
- **Personal wing** — sensitive tools (`fsa.html`, `giving.html`, `retirement.html`,
  `card-scout.html`), reached through a **personal/secure card pinned to the top of the
  stack**. One WebAuthn passkey (1Password, PRF) unlocks the wing; once in, every personal
  app is usable without a further prompt.

**Boundary:** page shells stay public on GitHub Pages. Protection lives where the data
is — AES-256-GCM ciphertext in Supabase behind header-gated RLS. The arc gates the
**keys**, not the files. Two invariants that must never be relaxed:

1. The landing and public marquee make **zero** WebAuthn and **zero** `press_vault` calls
   (card state is read from the local `press:vault:v1` session only).
2. No sync id or passphrase is ever committed to `schnubsy/press`.

### spaces.json (repo-owned)

`spaces.json` in the press root decides the split. It is **repo-owned and NEVER written
by a release script**:

```json
{ "v": 1, "personal": ["fsa.html", "giving.html", "retirement.html", "card-scout.html"] }
```

A page in neither list is treated as **public** (matches historical behaviour). Fail-closed
is enforced at publish time (see Publish flow): each app's `tools/release.js` aborts unless
its own page is listed in `personal[]`. The split must NOT depend on `press_portal` (that
table is anon read/write, so an anonymous write must never move a card between spaces).

## Portal contract

`index.html` is the entry portal. It reads `pages.json` and `spaces.json` from the repo
root (via the GitHub raw URL, with a `press:marquee:v3` cache/offline fallback).

### pages.json shape

`pages.json` is an **object keyed by filename**, each value `{ "title": ... }` only:

```json
{
  "fsa.html": { "title": "FSA Claims" },
  "giving.html": { "title": "Giving Tracker" }
}
```

The **kicker** and **icon** are NOT stored in `pages.json` — `index.html` derives them
from the filename via its `KICKERS` regex list and `ICONS` registry. Adding a new page
type means adding a `KICKERS` rule + a matching `ICONS` (Feather-grade, 24 viewBox,
stroke 2) path in `index.html`. `pages.json` is the release scripts' business; `spaces.json`
is not.

## The vault model (personal wing)

- **`public.press_vault`** — one AES-256-GCM-encrypted keyring row per enrolled passkey.
  `id` = SHA-256 (hex) of the passkey's raw credential id (never the raw id). Ciphertext
  only. RLS gates every row on the `x-vault-id` request header = `id` (mirrors the
  `press_fsa` / `press_retirement` `x-plan-id` pattern) — with one deliberate difference:
  **DELETE is granted to anon, gated the same way**, so a device can be revoked from the
  browser.
- **Key derivation** — the AES key is derived in the browser from the 32-byte WebAuthn PRF
  output via **HKDF-SHA-256** (correct for high-entropy PRF output; the apps' own document
  crypto uses PBKDF2 because their input is a low-entropy passphrase). The key never reaches
  the server; there is no readable data in `press_vault`.
- **Keyring** (v1): `{ v, apps: { "fsa.html": {sync_id, pass}, … , "card-scout.html": {sync_id} } }`.
- **Enrolment** creates a discoverable credential (`residentKey`+`userVerification` required,
  `rp.id` = the site's hostname). PRF absent ⇒ abort with a plain message; **there is no
  passphrase fallback**. `addPasskey` seals the SAME keyring under a new key as a NEW row.

### Session contract

- `press:vault:v1` in **localStorage**: `{ keyring, unlockedAt, expiresAt, vaultId }`, TTL
  **8 hours**. `lock()` clears it and fires a storage event so other tabs drop it too.
- Each personal app reads this session (read-only; the marquee owns the crypto) and adopts
  its credentials **in memory** — no passphrase prompt. The apps **never re-persist a
  passphrase to disk**: fsa/giving/retirement keep the passphrase only in tab-scoped
  `sessionStorage` (cleared on tab close) for the manual fallback; card-scout sources its
  `sync_id` from the vault (cached to localStorage for direct visits — a capability, not a
  passphrase). Log out / log back in applies to the **secure section only**.
- The vault module lives at `src/vault.js` (unit-tested in Node) and is inlined verbatim
  into `index.html` via `tools/inline-vault.mjs` (`--check` guards drift). The site keeps no
  build step.

## Page contract

Each published page is a **single self-contained HTML file**:

- All assets inlined or referenced from a sibling assets directory (e.g. `council-assets/`)
- No server-side dependencies except where the page explicitly declares them
  (e.g. `agent-health.html` and the personal apps call Supabase at runtime)
- Renders correctly at https://schnubsy.github.io/press/<filename>
- No build step — what is committed is what is served

## Publish flow

1. A page is authored/updated in its source project.
2. That project's `tools/release.js` **stages** into press: builds (if any), runs its secrets
   gate, runs the **personal-space gate** (abort unless the page is in `press/spaces.json`
   `personal[]` — absent/unparseable `spaces.json` is also a failure), copies the page, and
   registers the `pages.json` object entry. It **never pushes on its own**.
3. The arc **close** commits and pushes the marquee, then hash-verifies:
   `git hash-object <file>` == the GitHub blob SHA, and the live URL returns 200.
4. Lane B (emergency): a hot-patch committed directly; must be documented in `docs/evidence/`.

## Assets directories

Sibling asset directories (e.g. `giving-assets/`, `fsa-assets/`, `council-assets/`) are
referenced by their paired page and committed together.

## Tenants

The marquee is a **platform with tenants**, not an instrument. A tenant is a page whose
source lives in another repo (`~/Documents/VSCode/<repo>`) and ships here via that repo's
release script; a **press-native** page (`repo: null`) is authored directly in press. The
registry is **`tenants.json`** (repo-owned like `spaces.json`), keyed by page filename with
`repo · tier · gate · vendored · release · build · output · deterministic · note`. This
section is the **canonical** tenancy contract; the council reference and the MANUAL point here.

**Two RULEs (the invariant this arc protects):**
- **`press/src` is the ONLY source for shared modules — apps pull, never push.** A published
  page in press is NEVER hand-edited; a hotfix lands in the source repo and ships via that
  app's release. `src/gate.js` (private wing) and `src/family-gate.js` (family wing) are the
  canonical gates; every vendored copy is byte-identical to its canonical.
- **A marquee change rides INSIDE the tenant app's arc, never as a parallel press arc** — one
  writer on press at a time (fixed order: council `arc.md` → Tenant-change arcs).

**What a tenant OWES the marquee:** a `pages.json` entry (`{title}` only); a `tenants.json`
entry; its tier in `spaces.json` (repo-owned; release scripts READ, never write); a `KICKERS`
+ `ICONS` rule in `index.html` for a new page type (never an icon field in `pages.json`); for
a **family** page, a `press_access_apps` row + ≥1 active `press_access_grants` row seeded
BEFORE the gate ships (a gated page with no grant locks everyone out).

**What the marquee OWES a tenant:** the canonical gate modules in `press/src`; the shell; and
the shared DB shapes (`press_<shape>`, every row keyed by a `page` column = filename stem):
- `press_state` — simple checkboxes. Cols `page`, `item_id`, `checked` bool, `updated_at`;
  PK `(page,item_id)`. Lane 1. Reference `kayley.html`.
- `press_tasks` — rich task rows. Cols `page`, `item_id`, `title`, `status`, `category`,
  `week`, `position`, `extras` jsonb, `created_at`, `updated_at`; PK `(page,item_id)`. Lane 2.
  Reference `eagle-path.html`.
- RLS posture: **header-gated / allow-listed, NOT open** — policies gate on a request header
  (`x-vault-id`, `x-plan-id`, `x-app`) so a URL holder cannot read another page's private
  rows. (`press_portal` sort/archive state stays anon r/w by design.) Identifiers: MANUAL §12.2.

**Release-script contract** (each tenant's `tools/release.js`):
- READS `spaces.json` and **fails closed** if its page is in the wrong list (absent/unparseable
  `spaces.json` is also a failure); honours `PRESS_DIR` (default `../press`).
- **Byte-compares its vendored gate against `press/src/<gate>` BEFORE building** and fails
  closed — a SKIP (press repo absent) is NOT a pass.
- Writes its `pages.json` entry in the SAME commit as the page.
- **Never writes `spaces.json` or `tenants.json`**; never pushes on its own (the arc close does).

**Hotfix rule:** source repo first, then release — never patch `press/<page>.html` by hand.
