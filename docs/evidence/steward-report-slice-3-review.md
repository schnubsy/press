# steward-report — slice 3 — adversarial review (/code-review slice) + fixes

There is no built-in `/code-review` skill in this cloud session. In its place a fresh-context general-purpose sub-agent
reviewed `origin/main...HEAD` (press) plus the council registry row. It ran read-only, its tests passed and it made no
writes. Its findings and how each was resolved:

| # | sev | finding | disposition |
|---|---|---|---|
| 1 | 🔴 | **Auth bypass.** `authorize` accepted any x-plan-id for which a `press_deals` page=card-scout row existed. Anon can INSERT press_deals rows with any sync_id (the `press_deals_ins` policy only checks sync_id = header), so an attacker could mint their own key. | **FIXED.** New service-role-only RPC `press_steward_capability_ok` (`db/20261012_press_steward_capability.sql`, applied live) compares p against the **server-held `press_deals.sync_id` column default**; a client cannot write that. `core.mjs` now calls only this RPC, POST with the id in the body, and accepts only a literal `true`. New unit tests: a forged row does not open the reports, the gate never reads press_deals, and truthy look-alikes fail closed. Function redeployed as v2. |
| 2 | 🟡 | Live fixture row would show as Mark's latest report | **FIXED (non-destructive).** The DELETE timed out on the connector's confirmation step (#94450 pattern) and was not retried. The fixture's `run_at` was instead UPDATEd to now − 91 days, outside the 84-day window; the live gated call now returns `{"latest":null,"history":[]}`, so the page shows the empty state. Row deletion → HANDOFF "Mark's manual steps". |
| 3 | 🟡 | Valid key refused when Card Scout has no deals | **FIXED by #1.** The check no longer depends on any deals row existing. |
| 4 | 🟡 | History strip used rolling 7-day windows | **FIXED.** Runs are now bucketed by local Monday-start calendar week; `Math.round` absorbs DST. The spec builds history relative to this Monday and asserts columns 11/10/9. |
| 5 | 🟡 | `r.json()` unguarded in index.ts → 500 without CORS | **FIXED.** try/catch returns 503 with CORS headers. |
| 6 | 🟡 | Test gaps: XSS, lock-after-unlock | **FIXED.** Added an XSS spec (img/onerror/quotes in summary, needs_you objects, ledger and headline; no `<img>`, no `__pwn`) and a lock-after-unlock spec (gate returns, report blanked, app hidden). The live negative checks are recorded below. |
| 7 | 🟡 | Contract docs missing steward | **FIXED.** `docs/spec.md` Tenants now has a "Borrowed capability — steward.html" paragraph. The CLAUDE.md served-pages list is updated at the full close. |
| 8 | 🟢 | localhost origins in prod CORS | **Kept.** Identical to the council `_shared/cors.mjs` policy every on-demand function uses, and the capability is still required. |
| 9 | 🟢 | Screenshots written straight into docs/evidence | **Kept.** This is the repo convention (marquee/polish specs do the same) and the gauntlet restores tracked PNGs unless `KEEP_EVIDENCE`. |
| 10 | 🟢 | Axis label "12 wk ago" overstated the range | **FIXED.** The label now reads "11 wk ago". |
| — | pre-existing | anon/authenticated hold INSERT (and TRUNCATE/REFERENCES/TRIGGER) on `press_deals` | **Out of this arc's scope.** It belongs to Card Scout's tenant contract. Recorded for a follow-up arc in HANDOFF. It no longer affects steward (#1). |

## Live proof after the fix (pg_net from the DB; the capability never left the server)
| request | status / body |
|---|---|
| POST, no x-plan-id | 401 `{"error":"unauthorized"}` |
| POST, `000…0` | 401 |
| POST, an id that is not the default (no other id exists in press_deals today → `fff…f`) | 401 |
| POST, the server-held default (selected in-DB) | 200. Before the fixture move: latest.id 1 🟡, history 1. After: `{"latest":null,"history":[]}` |
| anon `GET /rest/v1/rpc/press_steward_capability_ok` with the publishable key | 401 `42501 permission denied for function press_steward_capability_ok` |
| RPC direct: real default / zeros / null / `x'::text or true --` | true / false / false / false |
| execute privilege anon / authenticated / service_role | false / false / true |

Edge Function `steward-reports` v2 `ezbr_sha256 6d542a81f77699fce2a4ba43994d0fb6a29a64350466776094ba2ef61dedfa49`
(v1 was `c15355d3…`; the fingerprint CHANGED and was deployed from `supabase/functions/steward-reports/` at this commit).

## Sentry
- Secrets: the capability was never printed, logged or committed. Every live check selected it inside SQL. The only
  key in the diff is the publishable key, which already sits public in src/gate.js and is not a secret.
- `git diff origin/main...HEAD` adds no `sb_secret`/service-role/JWT strings (grep below).
- Gauntlet (`steward-report-slice-3-gauntlet.txt`): unit 101/0 🟢 · inline 🟢 · Playwright 88 + 1 WebKit-only skip 🟢 ·
  tenants-check: the same 21 environment-only FAILs (seven tenant repos outside this session's scope; 0 others).
