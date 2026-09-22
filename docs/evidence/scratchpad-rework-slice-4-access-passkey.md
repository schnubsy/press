# Slice 4 — access.html passkey overlay (arc/scratchpad-rework)

_Press-side. Verbatim from `arc/gate-hardening-and-fx` slice 5. Date: 2026-09-22._

## Finding: the overlay already exists — this slice verifies it and locks it with a test

The remit arc copied gate-hardening slices 2–5 as slices 1–4 **verbatim**, before knowing that the
gate-hardening slice-5 overlay had already been implemented on the press side in commit
**`b1a91a9`** ("feat(access): passkey belt on access.html — gate a direct GET on an enrolled
browser"). So `access.html` already matches its own contract; no source change was needed.

## The contract (access-framework §6)

> "Passkey to see it; signed-in admin to change it."

## What access.html actually does (verified by reading the source + the spec below)

`access.html` has **no keyring credential of its own** (it stores no vault data), so it cannot use
`PressGate.guard()` / `credsFor('access.html')` — that would stick on "No credentials stored for this
tool yet". Instead it gates on **wing-session presence**:

- `wingLocked()` → true only when `PressVault.everEnrolled()` **and** there is no live
  `PressVault.loadSession()`. On an **enrolled** browser with no live session, `enter()` renders the
  passkey gate (`renderWingGate`) before the admin sign-in is ever shown.
- A `storage` listener re-locks if the wing session is lost in another tab / on expiry.
- A **never-enrolled / public** browser has no passkey belt — it goes straight to the admin OTP
  sign-in, where the **`is_admin` RLS remains the real lock** (§2, "the gate is UX; RLS is the
  protection"). This is the correct, defence-in-depth shape: the passkey belt adds protection on
  Mark's own device; it never *replaces* RLS, which independently enforces admin on every write.

## Done-proof — `press/test/access.spec.mjs` (new, 3/3 green)

Serves the **real** `access.html` + `src/family-gate.js` from disk and stubs `src/gate.js`
(`PressVault`) via a route to make each case hermetic:

1. **enrolled, no session** → the passkey gate is shown (`#pk` "Unlock with your passkey",
   heading "Private wing"); the admin email field is **not** present.
2. **enrolled, live session** → the belt passes; the admin OTP sign-in (`#em`) is reached.
3. **never-enrolled** → no passkey belt; the admin OTP sign-in shows (RLS still enforces admin).

Full press suite after the change: **40/40 Playwright + all node gate tests green** — the slice-2 gate
edit regressed nothing.

## Not published

`access.html` source is unchanged; only a test was added. Publishing `access.html` (and remit.html) is
slice 12, which is **BLOCKED** on the scratchpad migration being applied. The live `access.html` is
untouched.
