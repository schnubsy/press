# press — lessons & tag conventions

## Tag conventions

Tags on press commits follow: `chore(v<N>): <description>` for control-file work,
`feat: <description>` for new pages, `fix: <description>` for hot-patches.

Evidence slice files follow: `v<N>-slice-<seq>-<topic>.txt` (e.g. `v4-slice-9-press.txt`).

---

## Known lessons

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
