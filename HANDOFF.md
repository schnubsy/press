# press — HANDOFF

_Last updated: 2026-09-19 — arc/two-space-marquee_

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

## Next actions (the arc close — automatic when gauntlet + sentry are green)

1. Publish the **apps first**: merge each app PR, run its `release.js` into press, verify live
   200 + `git hash-object` == GitHub blob SHA.
2. Before pushing press, assert + record: all 4 app pages 200 + hash-verify; each app still loads
   with NO vault session (manual fallback works); `index.html` makes zero WebAuthn / `press_vault`
   calls on the landing path. If any fails → stop before the press push, leave the app publishes
   live, report.
3. Publish **press last** (`index.html` + `spaces.json`).
4. Apply the `press_deals` **cleanup** migration (drop `press_deals_anon_all` / `_auth_all`,
   revoke anon DELETE, `SET NOT NULL sync_id`) after card-scout is live with `x-plan-id`; re-run
   the negative anon probes + `get_advisors(security)`.

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
