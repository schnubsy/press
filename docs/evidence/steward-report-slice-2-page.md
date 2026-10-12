# steward-report — slice 2 — steward.html (private wing) + the steward-reports read path

## What shipped
- `steward.html` — press-native, PRIVATE wing: latest report (headline lamp 🟢/🟡/🔴, summary, cadence · date · model ·
  cost; Needs you · Fixed for you · Cost moves · [What I pay ledger when present] · All clear) + a 12-week history strip
  (12 week columns, one dot per run; weekly = filled dot, monthly = ring). Mobile-first 430px column (390 tested), 760px
  on desktop. States: loading · empty · denied (wrong key) · error + retry. Inline favicon (house standard, wrench glyph,
  ground `#0F1513`, `#7BC8A4 → #E0C271`), `theme-color` set.
- Registration: `spaces.json` personal[] += steward.html · `pages.json` "Steward" · `tenants.json` press-native entry ·
  `index.html` KICKERS `[/steward/,'Steward']` + ICONS 'Steward' · `docs/favicons.md` register + glyph rows ·
  council `instruments/snag/registry.json` row `steward → schnubsy/press` (T8; council PR, same arc).
- **Read path** — Edge Function `steward-reports` (source `supabase/functions/steward-reports/{index.ts,core.mjs}`,
  deployed v1, `verify_jwt=false`, `ezbr_sha256 c15355d342f0db7266f15be330b5ecb59620a5f0a961e16fedca6950ec8ea75c`):
  CORS allow-list (schnubsy.github.io + localhost) · POST only · `x-plan-id` must be 32-hex AND match the private
  wing's Card Scout capability (`press_deals` page=card-scout sync_id, service-role lookup) · then a service-role read of
  the last 12 weeks. Fails closed (401 missing/malformed/wrong; 503 lookup error). No anon key ever touches the table.

## Design decision (flagged for the chat) — the capability
The order said "the private wing's existing service-role read path". The private wing has no generic one: each tool
reads with its own keyring capability (`x-plan-id` / `x-vault-id`), and the on-demand functions gate on a sync id. A
dedicated steward capability would need a new secret minted and handed to Mark, a new Connect tool in `index.html`
(TOOL_CFG/CONNECT_TOOLS + recovery kit) and a Mark step. Instead the page guards on `card-scout.html` (the gate
releases the Card Scout capability from the passkey-sealed keyring) and the function verifies that capability
server-side. Cost: steward access follows Card Scout's key (rotate one, both move); anyone holding that key — only
Mark's enrolled devices — can read the reports. Tenant T7 stays exempt (no keyring entry of its own, like access.html).

## Done-criteria
| check | result |
|---|---|
| Playwright `test/steward.spec.mjs` — given the fixture row, past the gate (seeded wing session), Mark sees the headline + Needs-you lines | ✅ `#headline` = 🟡, `.sec.needs li` = ["Fixture: sign in to 1Password CLI"], strip 12 cols / 3 dots / 1 monthly ring, no horizontal overflow at 390 |
| no wing session → the passkey gate shows, app hidden, **zero** requests reach the function | ✅ |
| ungated request (no `x-plan-id`) → 401, no `latest`/`history` | ✅ (mock runs the shipped `core.mjs` gate) |
| wrong key → denied state, no report · empty table → empty state · desktop 1280 renders | ✅ |
| node unit `test/steward-reports.test.mjs` (gate fails closed incl. filter-injection shape; 12-week path; shaping) | ✅ 8/8 |
| **LIVE** (pg_net from the DB, so the capability never left the server): POST no header | `401 {"error":"unauthorized"}` |
| LIVE: POST `x-plan-id: 000…0` | `401 {"error":"unauthorized"}` |
| LIVE: POST `x-plan-id: <card-scout sync_id selected in-DB>` | `200` latest.id 1, 🟡, needs_you ["Fixture: sign in to 1Password CLI"], history 1 |
| LIVE: anon REST `GET /rest/v1/press_steward_reports` with the publishable key | `401` `42501 permission denied for table press_steward_reports` |
| security advisors | only `rls_enabled_no_policy` INFO for the new table (intended: deny-all, service-role-only); nothing new above INFO |

Screenshots: `steward-report-slice-2-mobile.png` (390×844 @3x), `steward-report-slice-2-desktop.png` (1280).

## Fixture row — NOT deleted (BLOCKED, Mark)
`delete from press_steward_reports where id=1 …` via the connector timed out at 180 s and the row is still there — the
destructive-SQL confirmation pattern (council surface.md → "Supabase channel", #94450); not retried. Harmless: it is
labelled FIXTURE and the first real weekly watch becomes the latest. Guarded delete → HANDOFF "Mark's manual steps".

## Gauntlet (`steward-report-slice-2-gauntlet.txt`)
unit 99/0 🟢 · inline:check 🟢 · Playwright 86 passed + 1 WebKit-only skip 🟢 · tenants-check 31 pass / 21 fail —
the same 21 environment FAILs as slice 1 (seven tenant repos outside this session's GitHub scope); steward.html:
T1 PASS, T2–T4 SKIP (press-native), T8 PASS; T7 PASS.
