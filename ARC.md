# press — Arc inbox

_Items land here when flagged for arc review. Resolved items move to docs/history.md._

## 2026-09-18 — arc/two-space-marquee

**Decree (Mark, verbatim decisions).** Split the Marquee into two spaces: a public open-access space
and a personal space for sensitive tools. One passkey unlocks the personal space; once in, every
personal app is usable without a further prompt. The landing marquee keeps the public cards and the
Archive card, and gains a **personal/secure card pinned to the TOP of the stack**. Nothing at all is
required to view the landing or public marquee — the passkey is demanded only on entering the secure
section. Passkey lives in 1Password (WebAuthn PRF), several passkeys may be enrolled, there is **no
passphrase fallback**, and log out / log back in applies to the **secure section only**.

**Boundary decision (Mark).** Page shells stay public on GitHub Pages. The protection stays where the
data is: AES-256-GCM ciphertext in Supabase behind header-gated RLS. This arc gates the **keys**, not
the files.

**Space assignment.**
- Personal: `fsa.html`, `giving.html`, `retirement.html`, `card-scout.html`
- Public: `council-guide.html`, `kayley.html`, `eagle-path.html`, `halvsies.html`, `agent-health.html`

**RULE:** the space assignment lives in a NEW repo-owned `spaces.json` in the press root. `pages.json`
keeps its current object shape (`filename → {title}`) and stays the release scripts' business.
`spaces.json` is NEVER written by a release script. A page in neither list is treated as PUBLIC by the
marquee (matches today's behaviour) — fail-closed is enforced at publish time instead, by SLICE 6.

**RULE:** the personal/public split must NOT depend on `press_portal` — that table is anon read/write,
so an anonymous write must never be able to move a card between spaces.

**RULE:** no secret, sync id or passphrase may be written into any file committed to `schnubsy/press`.
Enrolment reads them from the operator's browser at runtime.

**Findings from the read-only survey (verified 2026-09-18):**
- 🔴 `public.press_deals` (card-scout's data) has policies `press_deals_anon_all` / `press_deals_auth_all`
  with `qual=true, with_check=true` — anon can read AND write every row. Fixed in SLICE 4.
- 🟡 `public.press_portal` is anon read/write (`portal anon read/insert/update`, all `true`). Left as is;
  SLICE 3's RULE above keeps the split off it.
- 🟡 `docs/spec.md` documents `pages.json` as an ARRAY of `{filename,title,kicker,icon}`. The live file is
  an OBJECT keyed by filename with `{title}` only, and `index.html` derives kicker + icon from the
  filename via `KICKERS` / `ICONS`. Drift — corrected in SLICE 7.

**Current credential storage per app (verified by grep of the published pages):**
| Page | localStorage keys holding sync credentials |
|---|---|
| `fsa.html` | `fsa:sync_id`, `fsa:pass` |
| `giving.html` | `giving_sync_v1` (packed config) |
| `retirement.html` | `retirement_sync_v1` (packed config, `SYNC.packConfig` / `SYNC.readConfig`) |
| `card-scout.html` | `press:card-scout` (UI state only — no credential; reads `press_deals?page=eq.card-scout`) |

**AMENDMENTS (arc/two-space-marquee execution, 2026-09-19):**
- **card-scout `tools/release.js` was BUILT this arc** (it did not exist — publishing was a manual
  Lane-B copy). SLICES 4/5/6 and the close reference it: it secrets-gates `card-scout.html`, runs the
  personal-space `spaces.json` gate, copies + registers pages.json/favicons.md, and never pushes.
- **SLICE 4 is additive-then-cleanup.** The additive phase (sync_id column + default + backfill +
  header-gated policies alongside the open ones) is applied live now. The **destructive cleanup**
  (drop `press_deals_anon_all`/`_auth_all`, revoke anon DELETE, `SET NOT NULL`) + the negative anon
  probes are **sequenced to the arc close**, right after card-scout republishes with `x-plan-id`, so
  the live page never breaks. The card-scout sync_id is generated IN-DB and never committed.
- **App passphrases** now live in tab-scoped `sessionStorage` (never on disk) for the manual
  fallback; the vault path is fully in-memory. card-scout caches its `sync_id` (a capability) only.

---

=== SLICE 1 — the vault table ===

Scope: a new Supabase table holding the encrypted keyring, one row per enrolled passkey.

Files in play: `db/20260918_press_vault.sql` (new, in the press repo — mirrors the convention used by
`retirement/db/` and `fsa-claims/supabase/migrations/`).

Implementation — apply to project `eepjhpyziczrxvirczio` via the Supabase MCP `apply_migration`, name
`20260918_press_vault`, and keep the SQL in the repo:

- Table `public.press_vault`:
  - `id text primary key` — **SHA-256 (hex) of the passkey's raw credential ID**. Never the raw id.
  - `ciphertext text not null`, `iv text not null`, `salt text not null`, `kdf` text not null default
    `'hkdf-sha256'`, `version int not null default 1`, `label text`, `created_at timestamptz default now()`,
    `updated_at timestamptz default now()`.
- `alter table public.press_vault enable row level security;`
- Every policy gated on the request header `x-vault-id` matching `id`, exactly mirroring the
  `press_fsa` / `press_retirement` pattern (read the existing policy SQL in
  `fsa-claims/supabase/migrations/20260917_press_fsa.sql` and follow it byte-for-byte in shape):
  `current_setting('request.headers', true)::json->>'x-vault-id' = id`.
  - SELECT, INSERT, UPDATE gated as above. **DELETE is GRANTED to anon but gated the same way** — this is
    the deliberate difference from `press_fsa`: revoking a device must be possible from the browser, and a
    caller can only delete the row whose credential id it can present.
- `updated_at` maintained by a BEFORE UPDATE trigger (server-authoritative), same as `press_retirement`.
- Table COMMENT, in the house style: ciphertext only; one row per enrolled passkey; the key is derived in
  the browser from the WebAuthn PRF output and never reaches the server; no readable data exists here; the
  anon-write exception is justified by that and is NOT a precedent.

Done-criteria:
- Migration recorded in the project's migration history AND committed at `db/20260918_press_vault.sql`.
- Proven with live anon-key requests, captured into `docs/evidence/two-space-slice-1-vault-rls.txt`:
  (a) no `x-vault-id` header ⇒ zero rows; (b) a mismatched header ⇒ zero rows and a rejected insert;
  (c) a matching header can read/update/delete only its own row; (d) the table cannot be listed.
- `get_advisors(security)` on the project returns no new lints.

=== SLICE 2 — the vault module (crypto + WebAuthn PRF) ===

Scope: the unlock/enrol/lock logic, written as a pure module, unit-tested in Node, then inlined into
`index.html` in SLICE 3.

Files in play: `src/vault.js` (new), `test/vault.test.mjs` (new), `package.json` (new — dev-only, test
runner `node --test`; the site itself keeps NO build step).

Implementation:
- `deriveKey(prfOutput, salt)` — HKDF-SHA-256 over the 32-byte PRF output with the per-row `salt` and
  info string `"press-vault-v1"`, producing a 256-bit AES-GCM key. `globalThis.crypto.subtle` only.
- `sealKeyring(keyring, key)` / `openKeyring(record, key)` — AES-256-GCM, fresh 12-byte IV per write.
  **Fail closed**: a wrong key, a tampered blob or a malformed record returns `null`, never a partial or
  a thrown plaintext.
- `vaultIdFor(rawCredentialId)` — SHA-256 hex of the raw credential id.
- Keyring plaintext shape (v1):
  ```json
  { "v": 1, "apps": {
      "fsa.html":        { "sync_id": "", "pass": "" },
      "giving.html":     { "sync_id": "", "pass": "" },
      "retirement.html": { "sync_id": "", "pass": "" },
      "card-scout.html": { "sync_id": "" } } }
  ```
- `enrol({label})` — `navigator.credentials.create` with `rp.id = 'schnubsy.github.io'`,
  `extensions: { prf: { eval: { first: <fixed 32-byte salt constant PRF_SALT> } } }`,
  `authenticatorSelection: { residentKey: 'required', userVerification: 'required' }`,
  `pubKeyCredParams` ES256 + RS256. Read the PRF result from
  `cred.getClientExtensionResults().prf.results.first`.
  **If PRF is absent from the results, ABORT with a plain-language message** ("this browser or
  authenticator can't hold the key for the personal space") and write nothing — there is no passphrase
  fallback by decision.
- `unlock()` — `navigator.credentials.get` with **empty `allowCredentials`** (discoverable credential, so
  1Password offers any enrolled passkey), same `prf.eval.first`, `userVerification: 'required'`.
  Then `vaultIdFor(assertion.rawId)` → fetch the row with the `x-vault-id` header → derive → open.
- `addPasskey()` — requires an already-open keyring in memory; enrols a second credential and writes the
  SAME keyring sealed under the new key as a NEW row. Never re-keys or touches existing rows.
- `revoke(vaultId)` — DELETE that row. Refuse to delete the last remaining row without an explicit
  confirm, and say plainly that doing so loses access to the personal space.
- Session handling — `press:vault:v1` in **localStorage**: `{ keyring, unlockedAt, expiresAt, vaultId }`.
  TTL **8 hours**. `lock()` removes the key and dispatches a `storage`-visible change so other open tabs
  drop it too. Rationale to record in the file header: today each app persists its own passphrase in
  localStorage indefinitely (`fsa:pass`), so one expiring, revocable place is strictly stronger than the
  status quo, and it is what makes "open any personal app in a new tab" work.

Done-criteria:
- `node --test` green, ≥ 14 assertions, covering: round-trip seal/open; wrong key ⇒ `null`; flipped
  ciphertext byte ⇒ `null`; truncated record ⇒ `null`; two different PRF outputs ⇒ two different keys;
  the same PRF output + salt ⇒ the identical key (the property the whole design rests on); TTL expiry;
  `lock()` clears.
- **Guard on the guard:** a test asserts the sealed record scanned for every keyring value contains
  ZERO hits, while the plaintext contains all of them.
- Evidence: `docs/evidence/two-space-slice-2-vault-tests.txt`.

=== SLICE 3 — the marquee: two spaces ===

Scope: `index.html` gains the space split, the pinned personal card and the personal view. This is the
user-visible slice.

Files in play: `index.html`, `spaces.json` (new).

Implementation:
- `spaces.json`:
  ```json
  { "v": 1, "personal": ["fsa.html", "giving.html", "retirement.html", "card-scout.html"] }
  ```
  Fetched from `RAW` alongside `pages.json`, with the same cache/offline fallback as `CACHE_KEY`
  (extend `press:marquee:v2` → `press:marquee:v3`, storing `{files, man, spaces}`).
- Landing marquee (`paintMarquee`): personal files are removed from `ordered` BEFORE `applyState`, so they
  can never be sorted or dragged into the public archive, and never appear in the public count. The header
  count reads only the public cards.
- **The personal card is rendered FIRST, above every other card, always** — it is not part of the
  draggable set and cannot be reordered or archived. Style it as a sibling of `.tw-arch` (new `.tw-secure`
  block) so it reads as a place, not a page: kicker `⬤ Personal`, title `The Private Wing`, a locked/
  unlocked line, and a new `'Secure'` entry in `ICONS` — a Feather-grade shield-with-keyhole path,
  24 viewBox, stroke 2, round joins, matching the existing set.
- Card states, all resolved WITHOUT any network or WebAuthn call on the landing page:
  - **Locked** (no live session): `Locked · 4 tools` + `tap to unlock`.
  - **Unlocked** (live `press:vault:v1`): `Unlocked · 4 tools` + the time left.
  - **Not set up** (no session and no local record of ever enrolling — `press:vault:enrolled` flag):
    `Set up the private wing`.
- `?view=personal` → `renderPersonal(root)`:
  - Locked ⇒ a single centred unlock panel and a `Use your passkey` button. **WebAuthn is called only on
    that click** — never on page load, so an idle tab never prompts.
  - Unlocked ⇒ back link, the four personal cards (same `cardHTML`), a `Lock now` control, and a
    `Devices` control listing enrolled passkeys by `label` + `created_at` with `Add this device` and
    `Remove` per row.
  - A failed unlock says plainly what happened (cancelled / no passkey on this device / this browser can't
    hold the key) and offers retry. No stack traces, no jargon.
- Hard requirement to assert in the tests: **`index.html` performs zero WebAuthn calls, zero
  `press_vault` requests and zero vault reads on the landing path and on `?view=archive`.**
- The `KICKERS` regex list gains nothing; `spaces.json` alone decides the space.

Done-criteria:
- Playwright smoke (`test/marquee.spec.mjs`, new) using a **CDP virtual authenticator**
  (`WebAuthn.addVirtualAuthenticator`, `hasPrf: true`, `hasResidentKey: true`, `isUserVerified: true`)
  covering: enrol → lock → unlock → the four cards render → `Lock now` → locked again; and a network
  assertion that the landing page issues no `press_vault` request.
- Screenshots `docs/evidence/marquee-desktop.png` and `marquee-mobile.png` REPLACED with the two-space
  landing, plus new `two-space-personal-locked.png` / `two-space-personal-unlocked.png`.
- Personal pages appear in NEITHER the public marquee nor `?view=archive`.

=== SLICE 4 — press_deals hardening + card-scout ===

Scope: close the 🔴 finding and give card-scout a credential worth holding in the vault.

Files in play: `db/20260918_press_deals_gate.sql` (new, press repo),
`~/Documents/VSCode/card-scout/**` (its page source + `tools/release.js`), `card-scout.html` (republished).

Implementation:
- Migration `20260918_press_deals_gate`: DROP `press_deals_anon_all` and `press_deals_auth_all`; add
  header-gated policies on `x-plan-id` matching a new `sync_id text` column, mirroring `press_fsa`.
  Backfill the existing 14 rows with a freshly generated 128-bit `sync_id`, then `set not null`.
  Revoke anon DELETE.
- card-scout's page sends `x-plan-id: <sync_id>` on every `press_deals` request, taking the value from the
  vault session (SLICE 5's shared reader). Its agent/Edge-Function writer keeps using the service role and
  stamps the same `sync_id`.
- The generated `sync_id` is given to Mark to paste into enrolment. **It is never committed.**

Done-criteria:
- Live anon probe with no header ⇒ zero rows; with the header ⇒ only its own rows; anon DELETE rejected.
  Captured to `docs/evidence/two-space-slice-4-deals-rls.txt`.
- card-scout's own gauntlet green; the deals list still renders against the live table.
- `get_advisors(security)` clean.

=== SLICE 5 — the app hooks ===

Scope: each personal app adopts its credentials from the vault session instead of prompting, and stops
persisting its passphrase.

Files in play: the page sources in `~/Documents/VSCode/fsa-claims`, `~/Documents/VSCode/giving-tracker`,
`~/Documents/VSCode/retirement`, `~/Documents/VSCode/card-scout` — **edit each project's SOURCE, then
republish through its own `tools/release.js`. Never hand-edit the built page in the press repo.**

Implementation — one shared ~25-line snippet, added to each app's source (it carries NO crypto; it only
reads the already-decrypted session):
```js
/* press vault session reader — same origin as the marquee */
function pressVault(page){
  try{
    var s = JSON.parse(localStorage.getItem('press:vault:v1')||'null');
    if(!s || !s.expiresAt || Date.now() > s.expiresAt) return null;
    return (s.keyring && s.keyring.apps && s.keyring.apps[page]) || null;
  }catch(e){ return null; }
}
```
- `fsa.html` — on boot, if `pressVault('fsa.html')` returns credentials, use them **in memory** and skip
  the passphrase prompt. MIGRATION: `localStorage.removeItem('fsa:pass')` and `removeItem('fsa:sync_id')`
  once the vault path is live, so the passphrase stops resting on disk.
- `giving.html` — same, feeding the existing `giving_sync_v1` config path in memory; stop writing the
  passphrase into `giving_sync_v1` (keep the non-secret parts of that config).
- `retirement.html` — same, via `SYNC.readConfig` from the vault value rather than
  `localStorage.getItem(SYNC.SYNC_KEY)`; stop persisting the passphrase into `retirement_sync_v1`.
- `card-scout.html` — send `x-plan-id` from `pressVault('card-scout.html').sync_id`.
- Every app keeps its existing manual path as the fallback for a direct visit with no vault session
  (deep links must not break), but must NEVER re-persist a passphrase.
- Each app's own release secrets gate must still pass unchanged.

Done-criteria:
- Each of the four projects' gauntlets green in its own repo.
- A Playwright assertion per app: with a seeded `press:vault:v1`, the app loads its data with **no
  passphrase prompt**; with the key removed, it prompts as before; and after either path,
  `localStorage` contains no passphrase value. Evidence per app under its own `docs/evidence/`.
- All four republished to press via their own `tools/release.js`, hash-verified.

=== SLICE 6 — fail-closed at publish time ===

Scope: a new personal app must never land on the public marquee by omission.

Files in play: `tools/release.js` in fsa-claims, giving-tracker, retirement, card-scout;
`docs/spec.md` (the contract).

Implementation: each `release.js`, right after it locates `PRESS_DIR`, reads `PRESS_DIR/spaces.json` and
**fails the release** unless its own page is listed in `personal[]` (for these four) — message:
`release: <page> is a personal-space page but press/spaces.json does not list it; add it before publishing.`
Absent or unparseable `spaces.json` is also a failure, not a pass.

Done-criteria: a planted failure — temporarily remove the page's entry from a copy of `spaces.json` and
confirm each of the four releases ABORTS before writing anything. Captured to
`docs/evidence/two-space-slice-6-publish-gate.txt` in each repo.

=== SLICE 7 — docs, drift and close ===

Files in play: `docs/spec.md`, `docs/lessons.md`, `CLAUDE.md`, `HANDOFF.md`.

- `docs/spec.md`: document the two spaces, `spaces.json`, the vault model, the publish gate, and the
  session contract. **Correct the stale `pages.json` section** — it is an object keyed by filename with
  `{title}` only; kicker and icon are derived in `index.html` from `KICKERS` / `ICONS`.
- `CLAUDE.md`: "Current stage" updated; the "do not modify `*.html` / `pages.json`" project rule extended
  to name `spaces.json` as repo-owned and off-limits to release scripts.
- `docs/lessons.md`: record the finding that a value's *size* standing in for "is this sensitive" has a
  sibling here — a table's *obscurity* standing in for access control (`press_deals`).
- `HANDOFF.md`: current state, Mark's manual steps, and how to revoke a device.

=== STANDARD UI-ARC SLICES (appended per the arc contract) ===
- **Design review** — the Eye runs a LITE critique on the SLICE 3 screenshots; only 🔴 P0 findings are
  actioned, as a fix slice.
- **Performance** — Lighthouse against the built `index.html`; the landing page must not regress from its
  current score, and the personal view must add no render-blocking work.

---

**MARK'S MANUAL STEPS (call these out at close — they cannot be automated):**
1. On the iMac, in the browser where the personal apps already work, open the marquee → the personal card →
   **Set up the private wing**. Enrol the 1Password passkey. The setup form pre-fills from the sync ids and
   passphrases already in that browser; paste the card-scout `sync_id` from SLICE 4.
2. Enrol a second passkey from the iPhone or iPad (`Devices → Add this device`) so one lost device is not
   one lost wing.
3. Push nothing by hand — the arc close publishes.
