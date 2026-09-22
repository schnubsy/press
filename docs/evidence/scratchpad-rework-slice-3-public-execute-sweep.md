# Slice 3 — SECURITY DEFINER PUBLIC-execute sweep (arc/scratchpad-rework)

_Press-side audit. Verbatim from `arc/gate-hardening-and-fx` slice 4. Date: 2026-09-22. Read-only._

## What was audited

Every `SECURITY DEFINER` function in the shared `press` project (`eepjhpyziczrxvirczio`), read-only
over `pg_proc` / `pg_namespace`, excluding Supabase-owned system functions. The bug being hunted:
Postgres grants `EXECUTE` to **PUBLIC by default**, and `revoke execute … from anon, authenticated`
does **not** remove it — so a security-definer helper can stay callable by anon even after an
apparent lock-down (press/docs/lessons.md, the `press_access_before_user_created` enumeration oracle).

"PUBLIC can execute" is true when `proacl IS NULL` (default) **or** `proacl` contains an entry with an
empty grantee (`=X/owner`).

## Finding — every function is already clean

| Schema.function | Current EXECUTE grants (live ACL) | PUBLIC can execute? |
|---|---|---|
| `public.press_access_before_user_created(event jsonb)` | postgres, service_role, **supabase_auth_admin** | **NO** |
| `public.press_access_has(page text)` | postgres, authenticated, service_role | **NO** |
| `public.press_access_is_admin()` | postgres, authenticated, service_role | **NO** |
| `public.press_access_touch()` | postgres, authenticated, service_role | **NO** |
| `remit_private.remit_has_access()` | postgres, authenticated | **NO** |

No function in the project carries the default `NULL` ACL, and none has an explicit empty-grantee
(PUBLIC) entry. The latent bug that motivated this sweep has been fully remediated by earlier work —
there is **no live hole to close**.

## The migration authored

`scratchpad-rework-slice-3-secdef-hardening.sql` (this folder) — **NOT applied** (Cowork applies DDL;
Code's Supabase MCP is read-only). Because there is no live vulnerability, the migration is
**defensive**: for all five functions it `revoke execute … from public` (and `anon`) **first**, then
grants back only the roles that must call each one (the auth admin + service_role for the hook;
`authenticated` for the gate/RLS helpers). It is idempotent and re-runnable.

Its value: a future `drop + create function` **resets the ACL to the default PUBLIC grant** (a plain
`create or replace` keeps grants, but a signature change or a drop does not). Keeping this migration
in the tree means re-locking every helper is one apply, and the pattern ("revoke from PUBLIC first,
grant back explicitly") is captured as the project's standing shape for security-definer helpers.

## Apply + verify (Cowork, on Mark's go)

1. Apply `scratchpad-rework-slice-3-secdef-hardening.sql` via the Supabase connector.
2. Run the read-only post-apply check at the foot of the .sql — every row must report
   `public_can_execute = false` (they already do; this confirms the apply changed nothing it
   shouldn't).
3. Read the Supabase security advisor after the apply — a PUBLIC-execute leak is a silent 200, not an
   error, so the advisor is the backstop.
4. On apply, mirror the file into `press/db/` per the "db/ mirrors applied migrations" convention.
