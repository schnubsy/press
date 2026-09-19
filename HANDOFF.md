# press — HANDOFF

_Last updated: 2026-09-18 — hotfix/1password-passkey-crash (on arc/two-space-marquee)_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate
merge approval from Mark. When the gauntlet is green, complete the publish (merge to `main`,
which is what GitHub Pages serves) as part of closing out — do not stop to ask. Set by Mark
2026-09-18. (Auto-merge is still never enabled pre-emptively; this is about merging a
finished, green change.)

## Hotfix 2026-09-18 — 1Password passkey enrol crash — LIVE & verified

Enrolment threw `expected bytes` (`vault.js` `asBytes`) AFTER `credentials.create` when the
passkey came from the **1Password** extension: its `navigator.credentials` shim returns the
WebAuthn PRF output as a **base64url STRING**, not an `ArrayBuffer`. The CDP virtual
authenticator returns real `ArrayBuffer`s, which is why the Playwright smoke passed.

- `src/vault.js`: `asBytes` decodes a base64url string → bytes (buffer branches first,
  `TypeError` still the final fallback — arbitrary objects still rejected). `prfResult`
  normalises to bytes at the boundary; missing/zero-length ⇒ absent (null); non-32-byte ⇒
  refused with the human message. Private-wing panel logs the real error to `console.error`
  and never surfaces a raw `TypeError`. `index.html` re-inlined byte-identical.
- Tests closed the gap: unit (base64url string ≡ same key; wrong-length rejected; zero-length
  absent; `asBytes` still rejects objects) + a new smoke enrol path that stubs
  `getClientExtensionResults` to return the PRF result as a base64url string.
- Shipped: PR #4 → `main` (merge `b359581`). Live-verified — served `index.html` blob
  `8962b9d…` == GitHub main blob == local main blob; marker present; HTTP 200.
- **Not yet done:** Mark must delete the orphaned 1Password passkey (no `press_vault` row —
  enrol threw before the write) and RE-ENROL, then confirm Card Scout renders through the
  vault. Only then does the deferred `press_deals` cleanup below run.

## Current state

**Two-space marquee built and verified across all five repos** (press + fsa-claims,
giving-tracker, retirement, card-scout). Slices 1–7 committed on their branches. The marquee
now has a public space and a **personal wing** gated by a WebAuthn-PRF passkey.

- `press_vault` table live on `eepjhpyziczrxvirczio` (header-gated RLS on `x-vault-id`, with a
  DELETE policy for device revoke). `db/20260918_press_vault.sql`.
- `press_deals` hardened (additive phase live): `sync_id` column + default + header-gated
  policies added **alongside** the open ones. The destructive cleanup (drop the open policies,
  revoke anon DELETE, `SET NOT NULL`) runs at the arc close, right after card-scout republishes
  with `x-plan-id`. `db/20260918_press_deals_gate.sql`.
- `index.html` splits public/personal via `spaces.json`; pinned "Private Wing" card; zero
  WebAuthn/vault calls on the landing path. `src/vault.js` (HKDF + AES-GCM + WebAuthn PRF),
  inlined via `tools/inline-vault.mjs`.
- Each personal app adopts its creds from the `press:vault:v1` session in memory and no longer
  rests a passphrase on disk; each `tools/release.js` has a fail-closed personal-space gate
  (card-scout's `release.js` was built this arc).

## Published (2026-09-19) — LIVE

The two-space marquee is live. All five publishes done + hash-verified (local `git hash-object` ==
GitHub blob SHA) and serving HTTP 200: fsa/giving/card-scout (merged PRs, republished via
`tools/release.js`), retirement (local-only repo — merged `--no-ff`, built `--public`, copied in),
and `index.html` + `spaces.json` flipped LAST. The live marquee shows the Private Wing card; the
landing makes zero WebAuthn / `press_vault` calls and each app's no-vault fallback is test-proven.

## The ONE remaining action (deferred — Amendment B)

The **`press_deals` cleanup migration** is held until Mark confirms he has enrolled the private-wing
passkey AND Card Scout shows deals through the vault. Until then the open policies stay in place so
the live Card Scout page keeps rendering deals through enrolment; the 🔴 open-policy finding stays
OPEN until it runs. Exact SQL + negative-probe checklist are in `ARC.md`. The arc is NOT closed
until it runs.

## Mark's manual steps (cannot be automated)

1. On the iMac, in the browser where the personal apps already work: marquee → the **Private
   Wing** card → **Set up the private wing**. Enrol the 1Password passkey. The setup form pre-fills
   from the sync ids + passphrases already in that browser; **paste the card-scout `sync_id`**
   (generated in SLICE 4, first4/last4 `1722…8e13` — the full value was handed to you out of band;
   it is never committed).
2. Enrol a **second passkey** from the iPhone or iPad (Private Wing → Devices → **Add this
   device**) so one lost device is not one lost wing.
3. Push nothing by hand — the arc close publishes.

## How to revoke a device

- In the browser: **Private Wing → Devices → Remove**. This deletes that passkey's `press_vault`
  row (the `press_vault` DELETE policy is gated on `x-vault-id` = the row id, so a caller can only
  delete the row whose credential it can present). Removing the current device locks the wing here.
- Out of band (belt-and-braces): delete the row directly —
  `delete from public.press_vault where id = '<sha256-hex of the device credential id>';`
  Other enrolled passkeys keep their own sealed copy and are unaffected.
- Losing access entirely (no enrolled passkey left) means the personal wing cannot be opened; the
  underlying app data is still reachable by each app's manual sync-id + passphrase fallback.

## Blockers

None. The destructive `press_deals` cleanup is deferred to the close by design (Amendment A/B),
to avoid breaking the live card-scout page mid-arc.
