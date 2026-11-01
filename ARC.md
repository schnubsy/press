## 2026-11-01 — Family Wing invites

Work order — Family Wing invites (Invite button + sign-in account creation)

Repo: schnubsy/press
HOME: github:schnubsy/press
DEPLOYS: access-invite Edge Function (verify_jwt false, like agent-fix) + one additive migration on project eepjhpyziczrxvirczio (Mark approved 2026-11-01)
LANE: Full (extras: db, auth, screens)
BRANCH: arc/family-wing-invites
PUBLISH TARGETS: schnubsy/council (deploy/targets.json row for access-invite; catalog entry) — STAGED
DATA: none (no learning path)
SLICES: 3 · SINGLE-SLICE JUSTIFICATION: none

WHY (verified live 2026-11-01, not from notes)
Barb was added to `press_access_people` on 10/31 15:24 UTC but has NO `auth.users` row. The wing's code request
sends `create_user:false` (src/family-gate.js sendCode, index.html), so GoTrue answers 422 "Signups not allowed for
otp" and she can never receive a code (auth log 15:25:56). Kayley only works because her account was made by hand
on 9/28. docs/access-framework.md §5 ("Inviting is: add the row, then send the link") is wrong for a first-time person.
The Access Manager also has no "send invite" — it only adds the row and offers a link to copy.

MARK'S DECISIONS (2026-11-01)
- Invite = ONE tap in the Access Manager: creates their sign-in account, turns every family tool ON (opt-out default,
  no grant rows), and emails them the wing sign-in link from Winston. Mark is CC'd by the mailer.
- Brandon is NOT part of this arc (added later by Mark from the manager). No stopgap for Barb — she waits for the button.
- Family Wing rule stands: no extra passwords; sign-in stays "type your email, get a 6-digit code".

=== SLICE 1 — Migration: invited_at ===
Scope: one additive column.
Files in play: db/20261101_press_access_invited_at.sql (mirrors the applied migration byte-for-byte).
Implementation: `alter table public.press_access_people add column if not exists invited_at timestamptz;` Nothing else —
existing RLS (admin write, own-row read) already covers it; no new table, so no new grants. Apply via the Supabase
connector (additive, not destructive); read back the column.
Done-criteria: column exists live; an admin can write it, a non-admin cannot (read-back test, like the other db/ tests);
anon still has no access to press_access_people.

=== SLICE 2 — Edge Function access-invite ===
Scope: the only server path that creates a family sign-in account.
Files in play: supabase/functions/access-invite/index.ts · pure helpers shared with a Node test (e.g.
supabase/functions/_shared/invite.mjs) · test/access-invite.test.mjs.
Implementation (follow supabase/functions/agent-fix/index.ts exactly for CORS + the admin lock):
  1. Caller's JWT verified by GoTrue (/auth/v1/user), then `press_access_is_admin()` called AS THAT USER. No token → 401,
     expired → 401, not an active admin → 403.
  2. Body {email, name?}: lower-case + validate the address (400 otherwise).
  3. Upsert the `press_access_people` row FIRST (service role; active=true; set name only if given; NEVER touch is_admin;
     never create grant rows) — the Before-User-Created hook requires the row.
  4. Ensure the sign-in account: POST /auth/v1/admin/users {email, email_confirm:true}; "already exists" (422
     email_exists) = fine, report created:false.
  5. Rate limit: no second invite EMAIL to the same address within 10 minutes (use invited_at) → 429 with a plain message.
  6. Email via the Winston mailer exactly as supabase/functions/winston-mail does (MAILER_ENDPOINT / MAILER_KEY; `to`
     = the invitee, so Mark is CC'd and Reply-To is Mark). Subject "You're invited to the Family Wing". Plain, friendly text:
     who invited them, the sign-in link (https://schnubsy.github.io/press/index.html?view=family), and "type this email
     address, we'll send a 6-digit code". Wing-level wording — names NO single app.
  7. Stamp `invited_at`; return {ok:true, created:bool, emailed:bool}. If the mailer fails: the account and row still stand,
     return emailed:false so the page offers the copy-link fallback. Never return a key, URL secret or mailer body.
Done-criteria: unit tests with a stubbed fetch for 401 / 403 / 400 / 429 / happy path (created:true) / existing account
(created:false) / mailer failure (emailed:false); proves a non-admin NEVER reaches the admin-users call; sentry secrets
scan clean (public repo — no keys, no real addresses beyond Mark's already-public ones). Function is STAGED for deploy
(Slice 3 close) — ship proof at verify.

=== SLICE 3 — Access Manager UI + docs + close ===
Scope: access.html and the docs.
Files in play: access.html · test/ (Playwright spec with the function route-mocked; access-admin + access-names specs
updated) · test/ui-audit.config.mjs (new states) · docs/access-framework.md (§5 corrected; §6/§8a updated) · docs/spec.md ·
CLAUDE.md · HANDOFF.md · docs/history.md · docs/lessons.md · docs/evidence/.
Implementation:
  - "Add someone" becomes **Invite**: name + email → POST the function with the admin session token. Result messages:
    success "Invited — we emailed <email> (you're copied)"; account ready but mail failed → "Account ready, but the email
    didn't send — copy the link below" (copy-link row stays); 401 → "Sign in again"; 403 → not an admin; 429 → "Already
    invited a moment ago".
  - Each person card shows "Invited <date>" and, while `last_seen_at` is empty, a **Resend invite** button (same call).
  - Keep every existing behaviour: switches, Deactivate/Reactivate, Requests strip, copy link. Tap targets ≥44px, switches
    keep keyboard support, iPhone WebKit layout clean (ui-audit gated).
  - Docs: access-framework §5 states the truth (account is created by access-invite; the row alone is not enough) and drops
    the "no Edge Function" claim; lesson: `create_user:false` + no auth account ⇒ 422 "Signups not allowed for otp".
  - STAGED (council, patch in docs/evidence/family-wing-invites-staged-council.patch): `deploy/targets.json` →
    schnubsy/press.functions.access-invite {project_ref eepjhpyziczrxvirczio, verify_jwt false}; catalog upkeep if the
    manager's capability list changes. STAGED deploy request docs/evidence/family-wing-invites-staged-deploy.md.
Done-criteria: gauntlet green on the final head (unit · inline · tenants-check · Playwright chromium + iphone-webkit ·
ui-audit on WebKit); axe clean on access.html; PR open with a no-🔴 verdict; close-out manifest emitted.

VERIFY (chat, after Mark's merge button) — ship proof, not exit codes
  1. Apply the migration via the connector; read the column back.
  2. Deploy access-invite via the connector (small) and the council targets row; receipt/read-back shows verify_jwt false.
  3. Mark taps **Invite** (or Resend) for Barb in the LIVE manager → `auth.users` has her row (SQL read-back), the email
     arrives (Mark is CC'd), and she signs in with a code → her `last_seen_at` is set.
  Rollback: redeploy the previous function set (access-invite is new — delete is a Mark-tapped step); the column is
  harmless to leave; revert the access.html commit to restore the old Add button.
