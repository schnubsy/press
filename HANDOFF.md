# press — HANDOFF

_Last updated: 2026-09-19 — arc/two-space-marquee CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge
approval from Mark. When the gauntlet is green, complete the publish (merge to `main`, which is what
GitHub Pages serves) as part of closing out — do not stop to ask. Set by Mark 2026-09-18.
(Auto-merge is still never enabled pre-emptively; this is only about merging a finished, green change.)

## Current state

**arc/two-space-marquee is COMPLETE.** The marquee is live with a public space + a personal wing
gated by a WebAuthn-PRF passkey (`press_vault`), `spaces.json` driving the split, and a fail-closed
publish gate in each personal app's `tools/release.js`. Passkey enrolment works, and `press_deals`
is fully locked down (header-gated only). No open arc items.

## Shipped this arc (close)

- **Passkey enrol — hotfix 1:** 1Password returns the PRF as a base64url STRING; `asBytes` now
  decodes base64url. PR #4 → `main` (`b359581`), live-verified.
- **Passkey enrol — hotfix 2 (regression):** `prfResult` is now TOTAL — an unusable/enabled-only PRF
  at create returns null instead of throwing, so enrol falls through to the assertion `get()` (the
  real 1Password path). `asBytes` also recovers `.buffer`/numeric-keyed shim objects. PR #6 → `main`
  (`9f3f792`), live-verified. 24 unit + 5 smoke + `inline:check` green.
- **`press_deals` cleanup (Amendment B, was deferred):** migration
  `20260918_press_deals_gate_cleanup` (Supabase version `20260919043403`) — dropped open
  `_anon_all`/`_auth_all`, revoked anon+authenticated DELETE, `sync_id SET NOT NULL` (DEFAULT kept).
  Only `press_deals_sel/_ins/_upd` (`x-plan-id` = `sync_id`) remain. 🔴 open-policy finding CLOSED.
  `db/20260918_press_deals_gate_cleanup.sql`; probes in `docs/evidence/two-space-slice-4-deals-rls.txt`.

## Open / blockers

None. Non-arc, pre-existing security-advisor lints remain on **unrelated** objects (not press_deals):
`rls_enabled_no_policy` on `press_capture_seen`/`press_capture_state`, and `security_definer_view` on
the four public `press_agent_*` dashboard views. Address under agent-health work if ever wanted.

## Exact next steps

No arc in flight. Next work starts a fresh arc via `/council:kickoff`.

## Mark's manual steps

- Optional: enrol a **second passkey** (Private Wing → Devices → Add this device) so one lost device
  isn't one lost wing.
- Revoke a device: Private Wing → Devices → Remove (deletes that passkey's `press_vault` row; the
  DELETE policy is gated on `x-vault-id` = the row id). Out of band:
  `delete from public.press_vault where id = '<sha256-hex of the device credential id>';`.
