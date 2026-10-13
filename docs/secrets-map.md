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

## Agent Monitor (marquee-wings-monitor slice 4, 2026-10-12) — names + homes only
| Name | Sensitive | Home | Used by |
|---|---|---|---|
| `agent-watch_secret` | yes | **Supabase Vault** (project `press`), generated in-database by `db/20261012_agent_monitor_watch_cron.sql` — no human copy, no 1Password entry needed | pg_cron job `agent-watch` sends it as header `x-agent-watch-secret`; the Edge Function checks it via `press_agent_watch_secret_ok()` (service_role only) — it is never a function env var |
| `PUSHOVER_APP_TOKEN` · `PUSHOVER_USER_KEY` | yes | Supabase Edge Function secrets (project-wide; already set for card-scout) | `agent-watch` push alerts |
| `MAILER_ENDPOINT` · `MAILER_KEY` | yes | Supabase Edge Function secrets (project-wide; already set) | `agent-watch` Gmail alerts |
| `SUPABASE_SERVICE_ROLE_KEY` · `SUPABASE_URL` · `SUPABASE_ANON_KEY` | service key yes | injected by Supabase into every Edge Function | `agent-watch`, `agent-fix` |
| `SUPABASE_PRESS_ANON_KEY` | no | GitHub Actions secret (unchanged) | the watcher-of-the-watcher workflow, now reading `press_agent_monitor_public` |
- `agent-fix` holds no secret of its own: the caller's Supabase JWT (the Family Wing admin session) is the credential,
  verified by GoTrue + `press_access_is_admin()`.

## Egress (cloud environment allowlist)
- The gauntlet needs exactly these external hosts: the **npm registry** (install) and, for the WebKit download
  (stage 0 — `npx playwright install webkit`; arc/safari-ui 2026-10-12): **`cdn.playwright.dev`** +
  **`playwright.download.prss.microsoft.com`**. Without the two WebKit hosts the gauntlet reports
  `GAUNTLET PARTIAL (egress)` (exit 2) — the iPhone smoke and the ui-audit need real WebKit. Every spec and the
  ui-audit serve the repo locally and fake Supabase / GitHub / Google Fonts. Live probes (Pages 200, Supabase grant SQL) run via the chat / the Supabase connector, not the gauntlet.
