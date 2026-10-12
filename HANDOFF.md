# press — HANDOFF

_Last updated: 2026-10-12 — arc/marquee-wings-monitor (cloud Builder)._

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state

- Merge state: PR pending (branch arc/marquee-wings-monitor)
- Home: `github:schnubsy/press` (PUBLIC). Tenant PRs: remit #15, optimo #114 (re-vendored family-gate).
- Ship gate GREEN (cloud): unit 123/0 · inline in sync · tenants-check 64/0 (T9 new) · Playwright 102 + 1 WebKit skip.
- Live DB/functions already applied: press_access_requests + RPC + triggers, remit_has_access opt-out, agent monitor
  tables/views/cron `agent-watch` (15 min), review fixes; Edge: access-notify v2, agent-watch v1, agent-fix v1.
- Scheduled tasks check in: Card Scout weekly + Cowork pop-up watch (cloud prompts updated); Mac snag-train /
  fsa-monthly / steward-audit via claude-environment `system/scheduled-tasks/_report.md` step 4 (uncommitted on the Mac).

## Shipped this arc
- S1 marquee `LABELS` (Mark's 10 labels), no filename lines, new icons, T9. S2 Request access flow, Access Manager,
  wing email template + sync workflow. S3 remit/optimo re-vendor PRs. S4 Agent Monitor rebuild. S5 review fixes.
- Evidence: `docs/evidence/marquee-wings-slice-{1..5}-*`.

## Open / blockers
- **Sign-in email still says "remit"** until Mark's step 1 (token) and the Auth email sync workflow runs.
- On-demand AI functions (cardsharp-receipt, cardsharp-ynab, plan-day, propublica) record no runs → "No data".
- plan-day 401 at 11:58 UTC = a GET without a user token (verify_jwt) — probe, not a function bug (optimo).
- optimo cloud Playwright baseline is RED on main (Google Fonts egress, incognito installability) — env, not this arc.
- flow `kayley.html` compare (carried) · NAS zip (Mark, carried) · Issues #28–#32 (Eye polish).

## Exact next steps
1. Chat: run verify on this PR (close-out report is its final comment).
2. card-scout arc: re-sync `docs/cowork-task.md` to the live weekly task prompt (step 6 check-in added 2026-10-12).
3. remit arc: CLAUDE.md access contract → opt-out (`remit_has_access()` now delegates to `press_access_has`).
4. council arc (mac home): release.md/press.md point at press spec "Card naming — marquee label map" + Agent Monitor
   registration rule; MANUAL Steward update (§9.4 check-ins, §12.6 prune is daily/30d, notifier now all apps).
5. Polish: private-wing pill wrap at 390px; wing-card title wrap <400px; on-demand AI run logging.

## Mark's manual steps
1. Create a Supabase personal access token (supabase.com → Account → Access Tokens), add it in GitHub → schnubsy/press →
   Settings → Secrets → Actions as `SUPABASE_ACCESS_TOKEN`, then Actions → "Auth email sync" → Run workflow —
   expected: the run is green and its last step prints "template matches".
