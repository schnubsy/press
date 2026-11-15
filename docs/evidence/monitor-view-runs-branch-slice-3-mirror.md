# monitor-view-runs-branch — slice 3 — db/ mirror drift (done-proof)

File: `db/20261106_press_agent_due_times_multi_dow.sql` (new — header + the one statement). No live apply (already live).

Read-only on project `eepjhpyziczrxvirczio`, 2026-11-15 (`begin read only; … commit;`, plus the connector's
`list_migrations`):
| check | result |
|---|---|
| `list_migrations` has `20261106185336 press_agent_due_times_multi_dow` (the last migration) | yes |
| `md5(pg_get_functiondef('public.press_agent_due_times(jsonb, timestamptz, timestamptz)'))` | `646435c0d3c0bfdcdd166a114c7252b0` |
| the migration's recorded statement (`supabase_migrations.schema_migrations.statements`, that version) | the same text + `;` (one statement) |
| md5 of the mirror's `CREATE OR REPLACE FUNCTION … $function$` + newline (the test recomputes it) | `646435c0d3c0bfdcdd166a114c7252b0` — **equal** |
| function ACL (unchanged by CREATE OR REPLACE; the mirror carries no GRANT) | `postgres, service_role, anon, authenticated = X` |

Scoped test: `node --test test/monitor-view-runs-branch.test.mjs` → tests 10 · pass 10 · fail 0.
