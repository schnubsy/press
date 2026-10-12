# press — secrets map (names only)

_Generated 2026-10-11 by `tools/secrets-map.mjs` (council secrets instrument). **Never a value in this file.**
1Password is the source of truth; every other home is a mirror (D4). Edit the Mirrors column when a key lives
somewhere the heuristic did not guess._

Sources read: (no .env* files) · 0 keys from `.env*` · 2 names read from `.github/workflows/` (added by hand below)

| Name | Sensitive | Source of truth | Mirrors | Found in |
|---|---|---|---|---|
| SUPABASE_PRESS_ANON_KEY | no (publishable by design) | 1Password | GitHub Actions repo secret (`agent-health-notifier.yml`) | `.github/workflows/agent-health-notifier.yml` |
| AGENT_HEALTH_HEARTBEAT_URL | yes (optional ping URL) | 1Password | GitHub Actions repo secret (`agent-health-notifier.yml`) | `.github/workflows/agent-health-notifier.yml` |
| SUPABASE_ACCESS_TOKEN | yes (Supabase personal access token) | 1Password | GitHub Actions repo secret (`auth-email-sync.yml`) — **Mark creates it** | `.github/workflows/auth-email-sync.yml`, `tools/auth-email-sync.mjs` |
| access_notify_secret | yes (trigger → edge-fn header) | Supabase Vault (press project) — generated in-DB, never exported | none (the edge fn verifies via `press_access_notify_secret_ok()`, service_role only) | `db/20261012_press_access_requests.sql` |

## Notes (marquee-wings-monitor slice 2, 2026-10-12)
- `SUPABASE_ACCESS_TOKEN` lets the press workflow PATCH the Auth email template (Management API). Until it is set
  the workflow fails with "Add SUPABASE_ACCESS_TOKEN …".
- `access_notify_secret` has ONE home (Vault). The `access-notify` edge function reuses the existing project function
  secrets `PUSHOVER_APP_TOKEN`, `PUSHOVER_USER_KEY`, `MAILER_ENDPOINT`, `MAILER_KEY` (shared with card-scout) and the
  platform-provided `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — no new function secret.

## Notes (migrate-home, 2026-10-11)
- **0 `.env*` files, 0 sensitive keys in the repo.** The run read a fresh cloud clone; the site has no build step and
  the gauntlet needs no secret.
- **Public-by-design client config (not secrets):** the `press` Supabase project URL + its **publishable** key are
  embedded in the served pages (`index.html`, the tenant pages, `src/gate.js` / `src/family-gate.js`). Publishable
  keys are client-safe — RLS (`db/*.sql`) is the protection. Never a `sb_secret_`, service-role key, JWT or DSN in
  any page (each tenant's `tools/release.js` secrets-gates its build; `service_role` appears in pages only as gate
  comments).
- **GitHub Actions secrets** — the two rows above are the names the workflow reads. Whether they are SET could not be
  read from the cloud (the proxy refuses `actions/secrets`, HTTP 403); Mark/the chat confirms in Settings → Secrets.
  `SUPABASE_PRESS_ANON_KEY` holds the publishable key (kept as a secret for rotation hygiene, per the workflow header).
- **Supabase function secrets / tables** belong to each tenant app (`card-scout`, `cardsharp`, `fsa-claims`, …) and are
  mapped in those repos — press owns only the `press_vault`, `press_access_*` and `press_deals` gate objects (no secrets).

## Egress (cloud environment allowlist)
- The gauntlet needs **no external host**: npm registry (install) only; every spec serves the repo locally and fakes
  Supabase. Live probes (Pages 200, Supabase grant SQL) run via the chat / the Supabase connector, not the gauntlet.
