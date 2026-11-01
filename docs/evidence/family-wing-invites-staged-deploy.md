# family-wing-invites — STAGED deploy request (chat completes at verify)

Nothing below has been applied or deployed by the Builder. Order matters: council row first, then migration, then function.

| # | What | Where | Proof the chat records |
|---|------|-------|------------------------|
| 1 | Council registry row `schnubsy/press.functions.access-invite` `{project_ref eepjhpyziczrxvirczio, verify_jwt false}` + the `deployer-registry` test bump (22→23) | `docs/evidence/family-wing-invites-staged-council.patch` (validated: `git apply --check` + full council `node --test test/*.test.mjs` 404/0 on a fresh clone). A council registry copy is a plugin source ⇒ version bump on the council side. | council merge sha |
| 2 | Migration `db/20261101_press_access_invited_at.sql` (additive, `add column if not exists invited_at timestamptz`) — apply via the Supabase connector | project `eepjhpyziczrxvirczio` | `select column_name,data_type from information_schema.columns where table_name='press_access_people' and column_name='invited_at'` → 1 row; admin write OK, non-admin write refused; anon still has no access |
| 3 | Deploy Edge Function `access-invite` from `supabase/functions/access-invite/index.ts` **plus** `supabase/functions/_shared/invite.mjs` (import `../_shared/invite.mjs`, same pattern as `access-notify` → `_shared/notify.mjs`) | `verify_jwt: false`; needs the existing project secrets `MAILER_ENDPOINT`, `MAILER_KEY` (already set); `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are platform-injected | deploy receipt / `get_edge_function` read-back shows `verify_jwt:false` |

## Ship proof at verify (live)
1. Column read-back (row 2).
2. Function read-back: `verify_jwt` false; unauthenticated POST → 401 `{"error":"Sign in as the admin first."}`.
3. Mark taps **Invite** (or **Resend invite**) for Barb in the live manager → `select email from auth.users where email = '<barb>'` returns her row; the email arrives (Mark CC'd); she signs in with a code → her `last_seen_at` is set.

## Rollback
Redeploy the previous function set (access-invite is new — deleting it is a Mark-tapped step); the column is harmless to leave; revert the `access.html` commit to restore the old Add button.
