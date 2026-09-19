# press — lessons & tag conventions

## Tag conventions

Tags on press commits follow: `chore(v<N>): <description>` for control-file work,
`feat: <description>` for new pages, `fix: <description>` for hot-patches.

Evidence slice files follow: `v<N>-slice-<seq>-<topic>.txt` (e.g. `v4-slice-9-press.txt`).

---

## Known lessons

### Reverting code does not revert the data it already wrote (arc/align-retirement follow-up, 2026-09-19) [press]

The passkey-only `protectTool()` sealed a per-tool `data_key` + version marker `v` into the vault
keyring's `retirement.html` entry. STEP 1 removed the Protect source, but the sealed fields stayed
live (`{ sync_id, pass, data_key, v }`) — nothing read them, so hygiene not a fault, but exactly the
variance the align arc existed to remove. **RULE:** when abandoning a design, enumerate what it
PERSISTED (keyring entries here, plus any localStorage/DB rows) and clean it up too — a green revert
of the source is not a complete revert. The prune is surgical + re-sealed under the user's active
credential via `PressVault.updateKeyring`, proven by a before/after of FIELD NAMES only (never the
values). Runs on an unlocked tool page (the wing does not expose `PressVault`).

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
