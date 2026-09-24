# press — lessons & tag conventions

## Tag conventions

Tags on press commits follow: `chore(v<N>): <description>` for control-file work,
`feat: <description>` for new pages, `fix: <description>` for hot-patches.

Evidence slice files follow: `v<N>-slice-<seq>-<topic>.txt` (e.g. `v4-slice-9-press.txt`).

## arc/wings-polish (2026-09-24)

- **A shared-module bump desyncs every tenant's vendored copy → T3 RED.** Changing `press/src/gate.js`
  (here the 7-day vault TTL, inlined from `src/vault.js`) makes `tenants-check` T3 fail for every tenant
  whose SOURCE repo still vendors the old byte. The light fix is a **gate-file-only re-vendor** per tenant
  (`cp press/src/gate.js <repo>/src/vendor/press-gate.js`, `hash-object` assert, one-file commit, PR, merge)
  — NO rebuild, NO release; the published page keeps the old value until that app's own next release.
- **Guard every cross-repo re-vendor.** Only act on a tenant repo that is on `main`, clean, AND synced with
  origin; SKIP (don't stash/pull/touch) any dirty or behind repo and list it as a follow-up. If tenants-check
  stays RED only because of skipped repos, close the arc as a **DRAFT PR** — do not force the merge.
- **`press_access_has` opt-out shape.** A grant row now records only a REVOCATION: TRUE = active person AND
  `press_access_apps.gated` for the page AND **no** `active=false` grant. No row at all = granted. Deactivating
  a person (`people.active=false`) denies everything (the function requires `p.active`). T6's "≥1 active grant
  per family page" still holds via existing active=true rows; new people simply have no rows.
- **access.html sign-in loop:** `FamilyGate.verifyCode()` returns `{session,status,code}` — persist
  `.session`, never the wrapper, or the reload re-reads a bad record and loops. OTP codes are 6–10 digits.
- **Guard nuance — an unrelated dirty path is not a blocker.** card-scout's only dirty path was its own seeded
  `ARC.md` (a future arc's inbox). Re-vendor around it: record its `hash-object`, branch, `git add` the vendor
  file by name only, merge, assert the hash is UNCHANGED. Never commit/stash/discard another arc's inbox to
  satisfy a clean-tree guard.
- **RULE [press] (T7 `tool-cfg`):** every personal page with a vault keyring entry (`src/vault.js` →
  `emptyKeyring`) MUST have a `TOOL_CFG` entry in `index.html`, or it drops out of Connect your tools AND the
  recovery kit. Known gap: an app missing from BOTH passes — add both when adding a private tool.
- **RULE [press]:** the recovery kit prints from the live keyring, but paper doesn't update — reprint after adding
  a private tool or changing a passphrase. Never add an email reset for the private wing.
- **[cowork]** Cloud Cowork sessions linked to the Mac can't write via the Filesystem connector (outputSchema
  draft-07 rejected). Edits go through a folder connected to the session (device shell) — request
  `~/Documents` once per chat; the connector's own folder settings don't grant it.
- **Playwright gotcha:** `route.request().url` is a METHOD — `new URL(req.url())`. `new URL(req.url)` throws
  a bare "TypeError: Invalid URL" and the unfulfilled route hangs the page.

---

## Known lessons

### A gate on a per-page grant that does not exist locks everyone out (arc/family-wing-gate, 2026-09-22) [press][security]

Phase 1 gated `perth.html` "exactly like remit" — `FamilyGate.require('perth.html')`, which checks
`press_access_has('perth.html')`. But perth was a PUBLIC, open page: `press_access_grants` held ONE row
(`markgubb → remit.html`) and no perth grant. Shipping the gate as-is would have blocked EVERY signed-in
family member (Mark included) at "signed in, but no access to this page" — a page that was openable by
anyone is suddenly openable by no one. The two-tier model is the fix: the **entrance** (`requireSession`)
gates on a live SESSION (any family member), and each **tenant page** gates on a per-page GRANT — so a new
family page needs its `press_access_apps` row + a grant seeded (framework §8 step 4) BEFORE the gate ships,
or it is gated-but-locked. **RULE:** before gating a page on `require(page)`, verify a grant exists for the
intended users (query `press_access_grants`); a gate without a matching grant is a regression, not a lock.
Corollary: read the access DB (grants/apps/people) at the START of an access arc — the count of real users
changes what "lock everyone out" means (here: one admin user, so the blast radius was Mark himself).

### Re-vendor EVERY inlined copy of a shared module; the test harness dictates inline vs script-src (arc/family-wing-gate, 2026-09-22) [press][test]

Adding `requireSession()` to `src/family-gate.js` changed its bytes, so every INLINED consumer drifted.
`remit.html`/`perth.html`/`index.html` inline the gate (byte-proven `sha1 b5ff2b65…` == src); `access.html`
uses `<script src="src/family-gate.js">` and tracks src automatically — the two vendoring styles need
different proofs (a byte-compare vs a live 200 of the referenced file). **The press test harnesses serve
ONLY `index.html` and 404 everything else**, so `index.html` MUST inline the gate (a `<script src>` would
404 under test and leave `window.FamilyGate` undefined) — the harness, not taste, forces the choice.
**RULE:** when a shared vendored module changes, re-vendor and sha1-prove every inlined copy in the SAME
commit set, and pick inline over script-src for any file a hermetic spec loads whole.

### A test encodes a CONTRACT; when the contract inverts, rewrite the test — don't route around it (arc/family-wing-gate, 2026-09-22) [press][test]

`family-lobby.spec.mjs` asserted the family wing was "a directory that links straight to the page, zero
auth calls" — the pre-gate contract. Phase 1 INVERTED that contract (the door is now gated), so the assertion
"the remit card is visible on `?view=family`" was no longer a truth to preserve but a spec of the old
behaviour. It was rewritten to the new contract (gate overlay up, no tool card leaks, still zero auth until
the user acts), and the deep-link smoke test added to `marquee.spec.mjs` too. **RULE:** a failing test after
a deliberate behaviour change is a signal to update the CONTRACT the test encodes, not to weaken the
assertion; keep the pinned selectors/tokens other tests depend on (`.tw-secure`, `.tw-family`, the counts)
untouched while you do.

### A JSONB round-trip check must compare keys order-insensitively (arc/perth-runway, 2026-09-21) [supabase]

Verifying a PostgREST seed by re-GETting the rows and comparing `extras` field-for-field, the perth seed
"failed" on `t029.extras` — every value (`due`/`flag`/`note`/`link`/`assignees`/`log`) matched; only the
**key order** differed (`{due,flag,note,…}` in vs `{due,log,flag,…}` out). Postgres `jsonb` stores keys
in its own order and does NOT preserve insertion order, so a naive `JSON.stringify(a)===JSON.stringify(b)`
reports a false mismatch on data that survived intact. **RULE:** compare JSONB round-trips with a
canonical, order-insensitive deep-equal (recursively sort object keys before serializing); reserve
order-sensitive compares for arrays, where order IS the data. Corollary: a UTF-8 "check a row with an en
dash" spot-check only bites if the payload actually contains non-ASCII — the perth seed was pure ASCII,
so that probe was a no-op; scan for the char class you mean to test before asserting it survived.

### Reverting code does not revert the data it already wrote (arc/align-retirement follow-up, 2026-09-19) [press]

The passkey-only `protectTool()` sealed a per-tool `data_key` + version marker `v` into the vault
keyring's `retirement.html` entry. STEP 1 removed the Protect source, but the sealed fields stayed
live (`{ sync_id, pass, data_key, v }`) — nothing read them, so hygiene not a fault, but exactly the
variance the align arc existed to remove. **RULE:** when abandoning a design, enumerate what it
PERSISTED (keyring entries here, plus any localStorage/DB rows) and clean it up too — a green revert
of the source is not a complete revert. The prune is surgical + re-sealed under the user's active
credential via `PressVault.updateKeyring`, proven by a before/after of FIELD NAMES only (never the
values). Runs on an unlocked tool page (the wing does not expose `PressVault`). **Constraint:** re-sealing calls `updateKeyring` → `navigator.credentials.get({userVerification:'required'})` unless the in-memory `_live` key was warmed by a passkey unlock this page-load (a restored 8h session does NOT warm it — see gate.js:369). WebAuthn `get()` needs transient user activation, so a bare console paste hangs (`Promise {<pending>}`); the re-seal must be triggered from a CLICK. Note too that the wing's Reconnect MERGES (`Object.assign({}, apps[f], {sync_id,pass})`, index.html:1319), so it re-verifies + preserves extra fields — it does NOT prune residue, and there is no built-in "disconnect" that clears an entry.

### Revert a wrong design but keep its incidental real fixes; verify a premise against the code (arc/align-retirement, 2026-09-19) [press]

The passkey-only arc built a bespoke local-`data_key` design on the premise that retirement was
architecturally different from the other cloud tools. It never was — its `vaultCreds()`/`loadSyncCfg()`
already adopted `{sync_id,pass}` from the private-wing vault session exactly as giving does; retirement
was simply never connected. align-retirement reverted `index.html` to `f054714` verbatim but KEPT
`src/gate.testkit.mjs`'s standard-ArrayBuffer-PRF-at-create shim — a real create-time PRF gap (YubiKey /
iCloud Keychain) that neither the 1Password shim nor the CDP virtual authenticator exercised, and which
is independent of the abandoned design. **RULE:** when reverting a design, separate the wrong premise
from any incidental fix that stands on its own merit, and keep the latter. **Also:** the work order's
"extend press's `inline:check` to guard the vendored copy, as it does fsa's" was false twice over —
`tools/inline-vault.mjs` only syncs `vault.js` into press's own `index.html` + `src/gate.js`; it never
reached fsa (or any sibling) and there was no path list to extend, and fsa's vendored `press-gate.js`
had already DRIFTED from `src/gate.js`. The real per-app enforcement is each app's own `tools/publish-
checks` (gate-present + a byte-compare of its vendored gate vs this repo's `src/gate.js`). Grep the
mechanism a work order cites before extending it.

### Client-side key material is the user's data too (arc/passkey-only, 2026-09-19)

Never delete the only copy of a key before its replacement has been proven to decrypt. The
passkey-only arc guarded the SERVER-SIDE ciphertext (byte-identical before/after) but not the
CLIENT-SIDE key material: it made `migrateCredsOffDisk()` unconditional on boot, so opening the app
deleted the on-disk `sync_id`/passphrase before the vault keyring held them — and the wing's enrol
had only ever sealed an EMPTY keyring, so there was nothing to fall back to. A key is as much the
user's data as the ciphertext is. The purge now lives INSIDE the decrypt success path (proven
replacement) and never runs on boot.

Corollaries surfaced the same day:
- A misdiagnosis multiplier: the gate reused ONE error string ("Could not open the personal space")
  for two different states — a failed decrypt (bad key) and a decrypted-but-EMPTY keyring (no creds
  for this tool). Conflating them sent two diagnoses toward crypto/header "drift" that did not exist.
  Distinct states get distinct messages; add a test for each.
- The vault keyring is populated by an explicit, VERIFIED "Connect your tools" step in the wing
  (fetch+decrypt the app's real row before sealing), not silently at enrol. Enrol/add-device carry
  the populated keyring and re-seal; they never regenerate an empty one.
- A sync_id is a SECRET capability (it gates the row via `x-plan-id`), so it is never baked into the
  public marquee source — it is pasted by the user, kept in their password manager.

### Lane A / B hash-verify rule

All publish operations through the press instrument must verify the content hash of
the page file before committing. Lane A is the normal path: hash the source file,
copy to press repo, verify hash matches, then commit. Lane B (emergency hot-patch)
bypasses the source project but must document the patch in `docs/evidence/` with
a brief description of why Lane A was bypassed.

Reason: a mismatch between the authored version and what gets published is invisible
once GitHub Pages deploys. The hash step is the only safety net.

### pages.json must stay in sync

The portal (`index.html`) renders entirely from `pages.json`. If a page is published
without updating `pages.json`, it will not appear on the portal. Always update
`pages.json` as part of the publish commit — never in a separate commit.

### Single-file page constraint

Pages must be self-contained. External CDN dependencies that break due to CORS or
CSP will silently degrade the published page. Prefer inlining or use well-known
CDNs (cdnjs.cloudflare.com, cdn.jsdelivr.net/npm).

### [supabase] Obscurity is not access control — the sibling of size-as-sensitivity

A value's *size* standing in for "is this sensitive?" has a sibling: a table's *obscurity*
standing in for access control. `press_deals` shipped with `press_deals_anon_all` /
`press_deals_auth_all` (`qual=true, with_check=true`) — anon could read AND write every row —
on the tacit assumption that nobody would find the table. The two-space arc closed it by moving
`press_deals` onto the same header-gated RLS as `press_fsa` (`x-plan-id = sync_id`), additive-then-
cleanup so the live page never broke. Rule: every table anon can reach needs an explicit gate; "no
one knows the name" is not one.

### [press] spaces.json is repo-owned; the split never rides on press_portal

The public/personal split lives in a repo-owned `spaces.json` (`{v, personal[]}`), NEVER written by
a release script (they only read it, as the fail-closed publish gate). It must not depend on
`press_portal` — that table is anon read/write, so an anonymous write must never be able to move a
card between spaces. A page in neither list is treated as public (fail-open for visibility, fail-
closed for publishing).

### [crypto] HKDF for PRF output, PBKDF2 for passphrases

The vault derives its AES-256-GCM key from the 32-byte WebAuthn PRF output via HKDF-SHA-256 — NOT the
PBKDF2 the apps use for their document crypto. HKDF is correct for high-entropy input (the PRF output);
PBKDF2's work factor only matters for low-entropy passphrases. Using the wrong one is either insecure
(PBKDF2-less on a passphrase) or pointless overhead (PBKDF2 on high-entropy bytes).

### [robustness] (2026-09-19) A probe must return null, not throw — or it kills the caller's fallback

This arc's passkey-enrol crash bit TWICE, same shape both times. `enrol()` is written to recover:
`var prf = prfResult(cred); if (!prf) prf = await prfViaGet(cred.rawId);` — if the PRF is not readable
at credential-creation time, fall through to the assertion path (which is exactly how 1Password
delivers it). But `prfResult()` called the normaliser `asBytes()` **unguarded**, and `asBytes` THROWS
on an unrecognised shape. So when 1Password returned the PRF as a base64url string (hotfix 1), then as
an unreadable object (hotfix 2), the throw escaped `prfResult` and **the `if (!prf)` fallback never
ran** — the very recovery path the code already had was skipped by an exception thrown one call deeper.

Rule: a **probe/normalisation helper that a fallback depends on must be TOTAL** — return `null`/absent
for anything it can't read, never throw. Reserve throwing for a genuinely exceptional, actionable
condition (here: a value that converted cleanly but is the wrong length — a real authenticator fault),
and even then only from a shape you *know* is a real container, not from a speculative recovery. A unit
test must assert the probe **does not throw** for every junk input, and an integration test must prove
the fallback path actually executes. The CDP virtual authenticator returned tidy `ArrayBuffer`s, so the
smoke was green while production threw — test the messy shapes the real shim produces, not the clean one.

### [press][supabase] (2026-09-19) A header-gated RLS 200 with ZERO rows means WRONG KEY, not success

`press_deals` is gated on `x-plan-id = sync_id`. A wrong key does **not** error — PostgREST returns
HTTP 200 with an empty array (RLS filtered every row). Reading that empty-200 as "connected / OK" is
exactly what let Card Scout's feed go silently empty when it lost its sync key: the app kept a stored,
wrong key and showed nothing rather than failing loudly.

Rule: any verify-before-store probe against a **header-gated** table must treat **≥1 row as the ONLY
success**; a 200 with zero rows is a FAILURE (wrong key), surfaced in plain language ("that sync id
doesn't open …"), never a raw status code, and the key is sealed only after it verifies. Keep the
verdict as a pure function (`PressVault.dealsVerdict(ok, rows)`) so the 200-with-zero-rows = FAILURE
case is unit-tested without a network. Card Scout also proved the keyring shape can be app-specific: a
sync-id-only app carries `{ sync_id }` with **no** `pass` key — never write an empty passphrase.

### [supabase][security] Revoking a role never removes Postgres's default PUBLIC EXECUTE grant (arc/family-wing, 2026-09-21)

`20260921_press_access.sql` ended with `revoke all on function public.press_access_before_user_created(jsonb)
from anon, authenticated;` and considered the hook locked down. It was not. Postgres grants **EXECUTE to
PUBLIC by default** on every function, and both `anon` and `authenticated` inherit PUBLIC — so revoking
the two roles individually left the function callable. The post-apply advisor caught it:
`anon_security_definer_function_executable (WARN) ×4`. The hook is `SECURITY DEFINER`, takes arbitrary
`jsonb`, and returns `{}` for an address on the family list but a 403 object for one that is not — reachable
anonymously at `/rest/v1/rpc/press_access_before_user_created`, that is an **enumeration oracle**: anyone
holding the publishable key could test whether a given email is on the family list, one address at a time.
Cowork's fix migration `press_access_revoke_public_execute` (`db/20260921180000_…`) revokes from
`public, anon, authenticated` on every security-definer helper (`press_access_*` and `remit_private.
remit_has_access()`), then grants EXECUTE back **explicitly** — to `supabase_auth_admin` for the GoTrue
hook, to `authenticated` for the ones the RLS policies and the gate call.

**RULE:** revoking EXECUTE from `anon, authenticated` never removes the default PUBLIC grant. Always
`revoke execute … from public` first, then grant it back explicitly to exactly the roles that need it
(`supabase_auth_admin` for a Before-User-Created hook; `authenticated` for policy/gate helpers). Applies
to **every** security-definer helper in the press project — audit the older `press_*` helpers for the
same hole. Corollary: read the post-apply advisor after every DDL slice; this class of leak is silent
(a 200, not an error) and only the advisor or an explicit `\df+` of the ACLs shows it.

---

## 2026-09-22 — arc/marquee UI batch

**RULE [press]:** page-type icons live in `index.html`'s KICKERS + ICONS registry, NOT in `pages.json`.
`pages.json` is fetched at runtime and stubbed by both smoke fixtures (marquee + connect), so an `icon`
field there would be untested and silently fall back to the generic glyph. New page type → add a KICKERS
regex + a matching Feather-grade ICONS path (24 viewBox, stroke 2, round joins).

**RULE [press]:** a hand-drawn country silhouette (e.g. Australia for perth) does NOT survive row size
(~26px) as a stroked glyph — it reads as a blob or, with a top notch, as "ears". If a place needs an icon
at nav size, prefer a generic Feather glyph (map-pin) and reserve the silhouette for hero sizes, or accept
that it reads as "a landmass". Logged as a device-check decision, not a silent choice.

**RULE [press]:** remit's SOURCE repo (`remit/src`) still vendors the PRE-`requireSession` family-gate;
Phase 1 re-vendored the current gate into `press/remit.html` directly, not into remit's source. Therefore
`remit/tools/release.js` (build → publish) REGRESSES the Phase-1 entrance gate. Until remit's source gate is
re-vendored, any remit change (e.g. the family back-link) must be applied DIRECTLY to `press/remit.html`,
preserving `requireSession` (grep-verify the count before/after). FOLLOW-UP: re-vendor family-gate.js into
remit's source so it can rebuild cleanly.

**RULE [press]:** to publish a source-app page into a press WORKTREE (not the main checkout), set
`PRESS_DIR=<worktree>` — honored by fsa-claims, giving-tracker, and retirement's release. EXCEPTIONS: remit
hardcodes `../press` (copy the built page in by hand); retirement stages the built page into a dest dir
(`argv[2]`) and never auto-copies to press (copy `<dest>/index.html` → `press/retirement.html` yourself).

**RULE [test]:** the wing-view titles/eyebrows are NOT test-pinned, but the marquee CARD h3s ARE
(`marquee.spec.mjs:109` = private card, `family-lobby.spec.mjs:72` = family door). A copy change that
touches a card hero must update those assertions in the same slice.

---

## 2026-09-22 — arc/marquee-polish

**RULE [css]:** `aspect-ratio:1/1` + a `max-height` on a grid `1fr` item makes the item derive its WIDTH
from the capped height and left-align in its track — so it stops filling the column and insets from
siblings. If a square must stay flush with full-width siblings, let width = the track (drop max-height) and
let aspect-ratio set the height; don't cap the height.

**RULE [css]:** a fixed-aspect-ratio card with `overflow:hidden` will CLIP its own content when the content
(e.g. a kicker that wraps to an extra line) is taller than the ratio allows — and it reads as a bug, not a
crop. On narrow breakpoints drop the aspect-ratio (`aspect-ratio:auto`) so the card grows to content; grid
`align-items:stretch` keeps paired cards equal height. Verify the LONGEST-copy card at the smallest width.

**RULE [press]:** a marquee app's SOURCE repo can silently drift from its published `press/<page>.html` when
the page was hand-patched in press (e.g. remit's family-gate was re-vendored into press directly, leaving
remit source on the old gate). Before trusting `tools/release.js` again, rebuild from source and DIFF against
the live page; the diff names exactly what to reconcile. remit's build is deterministic (no stamp), so
byte-identical is the achievable bar. Watch for hand-edit style drift too (CSS shorthand vs longhand, stray
comments, edits made in a dynamic template but not the static shell — or vice-versa).

**RULE [icons]:** don't hand-draw a country/complex silhouette for a row-size (26px) stroke glyph — it won't
read. Use a simple, purpose-true Feather glyph (perth's runway → a paper-plane). Judge glyphs at their ACTUAL
render size, never zoomed.

## 2026-09-22 — arc/marquee-tenancy

**RULE [git][press]:** a vendored-gate "drift" can be a STALE BASE, not real drift. This branch cut from
`f96a247`; mid-arc remit's `arc/scratchpad-rework` merged a new canonical `family-gate.js` to press main.
`tenants-check` T3 then flagged remit's vendored gate as drifted — but it was the WORKTREE's canonical that
was behind. Always `git fetch && rebase origin/main` before trusting a cross-repo byte-compare; verify with
`git hash-object` on BOTH the vendored copy and the CURRENT-main canonical, not a stale checkout. (My first
`git hash-object <abs-path>` run from the wrong repo also misreported MATCH — run it with `git -C <repo>`.)

**RULE [press]:** the marquee is a PLATFORM with TENANTS — the contract lives ONCE in `docs/spec.md` →
Tenants; `tenants.json` is the registry; `tools/tenants-check.mjs` is the audit (run `--rebuild` before any
tenant close). A tenant that FAILs is fixed in its SOURCE repo (re-vendor from `press/src`), NEVER by
editing press; a needed republish is a guarded manual step. apps pull, never push; one writer on press.

**RULE [supabase]:** the family-access tables key on the FULL page filename (`press_access_apps/grants.page`
= `'remit.html'`), NOT the `press_state` stem, and the active flag is on the GRANT
(`press_access_grants.active`), not `press_access_people.active`. A grants audit that stems the page or
filters on people.active returns empty and reads as a false "gated-but-locked". Verify the schema
(`information_schema.columns`) before trusting an audit query.
