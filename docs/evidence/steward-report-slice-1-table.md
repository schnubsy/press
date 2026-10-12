# steward-report — slice 1 — press_steward_reports (applied 2026-10-12, cloud Builder, Supabase connector)

Source: council `instruments/agent/db/20261012_press_steward_reports.sql` → press `db/20261012_press_steward_reports.sql`
byte-identical (`git hash-object` both sides = `37b843fd5e34d72671837d73d67df4b4ab85f348`).
Applied via `apply_migration` name `20261012_press_steward_reports` (statements verbatim, comments stripped) → `{"success":true}`.
Pre-check: `to_regclass('public.press_steward_reports')` = null (new table).

## Done-criteria
| check | result |
|---|---|
| `select relrowsecurity from pg_class where relname='press_steward_reports'` | `t` (force RLS `f`) |
| policies on the table (`pg_policies`) | `0` — RLS on, no policies = deny-all to non-service roles |
| grants (`information_schema.role_table_grants`, audit.md group 8) | `postgres` (owner) + `service_role` only; NO anon, NO authenticated |
| `has_table_privilege(anon / authenticated / service_role, select)` | `false / false / true` |
| fixture insert → id | `1` (weekly 🟡, summary "FIXTURE — …", needs_you 1 line, model sonnet, cost 0.0123) |
| fixture read-back | row 1 returned with every column as inserted |

The fixture row is kept until slice 2's live read-path check, then deleted (recorded in the slice-2 evidence).

## Not done here — BLOCKED (classifier)
press has no `.claude/settings.json` (the `Bash(gh pr merge:*)` allow rule, arc.md → Merge policy D1). Writing it was
refused by the auto-mode classifier as `[Self-Modification]`; not routed around. It goes to the next arc / the chat.

## Gauntlet (`docs/evidence/steward-report-slice-1-gauntlet.txt`)
unit 91/0 🟢 · inline:check 🟢 · Playwright 80 passed + 1 WebKit-only skip 🟢 · tenants-check 29 pass / 21 fail / 21 skip.
All 21 FAILs are T2/T3/T4 "source repo / vendored gate / release script MISSING at /home/claude/<repo>" for the seven
tenant repos (card-scout, cardsharp, fsa, giving, optimo, remit, retirement) — they are NOT in this session's GitHub
scope (only council, claude-environment, press; no add_repo), so the sibling clones the gauntlet relies on cannot exist.
Zero FAILs of any other kind; none touch a file this arc changes. Classified BLOCKED (scope), identical on base.
