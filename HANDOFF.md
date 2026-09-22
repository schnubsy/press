# press — HANDOFF

_Last updated: 2026-09-22 — arc/family-wing-gate Phase 1 CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge
approval from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which is what
GitHub Pages serves) as part of closing out — do not stop to ask. Set by Mark 2026-09-18.
(Auto-merge is still never enabled pre-emptively; this is only about merging a finished, green change.)

## Current state

**arc/family-wing-gate Phase 1 is COMPLETE and pushed to `main` (`cba9682`).** The Family Wing DOOR
(`index.html?view=family`) is GATED on a live family session; `perth.html` is now a gated family tool
alongside `remit.html`. Live at `https://schnubsy.github.io/press/?view=family`. Prior arc/perth-runway
stays closed. Base at arc open was `b1a91a9`; published in three live-verified pushes.

## Shipped this arc
- **Entrance gate (`dbfc97a`, src+index):** new `FamilyGate.requireSession()` in `src/family-gate.js`
  (session-only sign-in — email OTP, no page grant; `renderSignIn` gained `opts.sessionOnly`). `renderFamily()`
  now awaits it and paints nothing behind the gate; added a **Log out** control; removed the untrue
  "open a tool — it asks for a code" landing copy. Deep-link smoke tests in `marquee.spec.mjs` +
  `family-lobby.spec.mjs` (old open-directory test rewritten to the gated contract).
- **Re-vendor (`84a4965`, remit):** `remit.html` inlined gate re-vendored byte-identical to src; its own
  `require('remit.html')` unchanged — it already trusts the door session (no second prompt).
- **perth joins (`cba9682`, spaces+perth):** `perth.html` added to `spaces.json` family[] and gated with
  `FamilyGate.require('perth.html')` before boot; `press_tasks` read/write UNCHANGED. `press_access` already
  had the `perth.html` app row + an active grant for Mark (Cowork-seeded, verified live).
- **Proofs:** each page pushed then confirmed live-200 + `git hash-object` match (index `89de962b`, gate
  `528e1c13`, remit `97e7fd2f`, perth `f62c96e4`, spaces `bc7d67134`). Vendored gate sha1 `b5ff2b65…`
  identical across index/remit/perth. `src/gate.js` untouched (`6080e25d…`, before & after). Gauntlet:
  34 Playwright + 43 node, **0 skipped**. Live door shows the gate with **zero auth/REST calls, no tool leak**.

## Open / blockers
- **perth RLS is still OPEN (🔴 → Phase 2).** perth's data (`press_tasks`, `page='perth'`) is still anon
  read/write — the gate is courtesy only for perth until its tables move behind `press_access_has('perth.html')`.
  The gate does NOT protect the data yet; RLS is the real lock (framework §2). This is Phase 2's job.
- Copy (Phase 4) and the admin-grid polish (later) are untouched by design — only the one untrue landing
  line was removed this phase.
- Standing (prior arc): each sibling app owns its vendored-gate byte-check; press's `inline:check` guards
  only its own `vault.js`, not `family-gate.js` — the family-gate byte-identity was proven by hand this arc.

## Exact next steps
**Phase 2 — put perth's data behind RLS.** MAIN CHECKOUT: `~/Documents/VSCode/press`. INBOX FILES: this
HANDOFF + `docs/access-framework.md` §4 + `docs/lessons.md`. Move `press_tasks` (`page='perth'`) reads/writes
onto `FamilyGate.authHeaders()` and gate the rows on `press_access_has('perth.html')`, additive-then-cleanup
so the live page never breaks; keep the `perth.html` grant intact; re-run the gauntlet + a perth round-trip.

## Mark's manual steps
1. **Verify the live OTP sign-in (device check — Claude cannot do this).**
   `open 'https://schnubsy.github.io/press/?view=family'` → sign in with your email code once, then
   confirm BOTH `remit` and `perth` open with **no second prompt**, and that **Log out** returns you to
   the gate. Expected: one code, two tools open, log-out re-shows the sign-in. If perth shows "signed in,
   but no access to this page", the `press_access_grants` row for `markgubb@gmail.com → perth.html` is
   missing/inactive — re-add it in `access.html` before relying on the gate.
