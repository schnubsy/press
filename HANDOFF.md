# press — HANDOFF

_Last updated: 2026-10-12. arc/steward-report (the Steward report page), run by a cloud Builder. PR #35
(marquee-wings-monitor) landed on main the same day; its open items are carried below._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: PR pending (branch arc/steward-report)
- Home: `github:schnubsy/press`. Work happens in a cloud clone. The repo is PUBLIC and stays public.
- Ship gate: `bash scripts/gauntlet.sh` via `.claude/skills/verify/SKILL.md`. The close-gauntlet numbers are in `docs/evidence/steward-report-close-gauntlet.txt`.
- New: `steward.html` (private wing; LABELS "Environment Reports / Steward", glyph `tool`).
- New: Edge Function `steward-reports` v2 (ezbr `6d542a81…`) · table `press_steward_reports` · RPC `press_steward_capability_ok`.
- From PR #35, live: press_access_requests + RPC/triggers · remit_has_access opt-out · agent monitor tables/views ·
  cron `agent-watch` (15 min) · Edge access-notify v2, agent-watch v1, agent-fix v1.

## Shipped this arc
- **S1 `155c873`**: `press_steward_reports` applied. Service-role-only: RLS on, 0 policies, no anon or authenticated grant.
- **S2 `910da08`**: `steward.html` with the latest report and a 12-week strip, 390-first.
  - Registered in spaces, pages and tenants JSON, the marquee label/icon, the favicon register and the council snag-registry row.
  - Council PR #28 merged as `3b707b5`.
- **S3 `02fff38`**: review 🔴 fixed. The first gate trusted press_deals rows, which anon can forge. It now uses the server-held-default RPC.
  - Also: calendar-week strip, XSS and lock specs, and `docs/spec.md` → Tenants "Borrowed capability".
- Evidence: `docs/evidence/steward-report-slice-{1,2,3}-*`, `steward-report-merge-review.md`.

## Open / blockers
- **Fixture row** `press_steward_reports.id=1` still exists. The connector DELETE timed out on its confirmation step (#94450).
  - Its `run_at` was moved outside the 84-day window, so the page does not show it.
  - Deletion is Mark's step 1.
- **`.claude/settings.json`** (`Bash(gh pr merge:*)`, arc.md D1) is missing. Writing it was refused by the auto-mode classifier
  `[Self-Modification]`. Code change → next press arc.
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. Steward no longer depends on them.
- **Cloud gauntlet stage 3**: tenants-check FAILs T2–T4 when tenant repos are not in session scope. Dispatch press arcs with the tenant repos.
- From PR #35:
  - The sign-in email still says "remit" until Mark's step 2.
  - On-demand AI functions record no runs ("No data").
  - optimo's cloud Playwright baseline is RED (env).
- Carried:
  - flow `kayley.html` compare, BLOCKED (flow out of scope).
  - NAS zip (Mark).
  - Issues #28–#32.
  - Remote branch `claude/perth-phase-2-security-c7a88b` is safe to delete.

## Exact next steps
1. Chat: run verify on PR #36. The close-out report is its final comment.
   - Live `https://schnubsy.github.io/press/steward.html` → 200 was BLOCKED here (egress), so verify checks it in Chrome.
   - Unlock with the passkey → expect "No reports yet" until the first watch row lands.
2. Next press arc: **press-hygiene**. HOME: github:schnubsy/press · BRANCH: arc/press-hygiene
   - S1: add `.claude/settings.json` = `{"permissions": {"allow": ["Bash(gh pr merge:*)"]}}`.
   - S2: tenants-check cloud mode, so absent sibling clones SKIP (or always dispatch with the tenant repos in scope).
   - S3: flow kayley carry-over. Needs schnubsy/flow in scope.
   - S4: private-wing pill wrap at 390px, and wing-card title wrap under 400px (from PR #35).
3. Card Scout tenant arc (schnubsy/card-scout + press in scope):
   - Revoke anon INSERT/TRUNCATE/REFERENCES/TRIGGER on `press_deals`. First confirm that no browser path inserts deals.
   - Re-sync `docs/cowork-task.md` to the live weekly task prompt.
   - Done-criterion: keep the `press_deals.sync_id` literal default; `press_steward_capability_ok(<real key>)` must still return true (the Steward gate).
4. remit arc: change the CLAUDE.md access contract to opt-out (`remit_has_access()` delegates to `press_access_has`).
5. council arc (mac home):
   - Point release.md/press.md at the press spec "Card naming — marquee label map" + the Agent Monitor registration rule.
   - MANUAL Steward update.
   - The watch/audit now write `press_steward_reports` rows (the table is live).

## Mark's manual steps
1. Delete the fixture row in the Supabase SQL editor (project `eepjhpyziczrxvirczio`). Run as ONE statement:
   `with d as (delete from public.press_steward_reports where id = 1 and summary like 'FIXTURE — arc/steward-report%' returning id) select (select count(*) from d) as deleted, (select count(*) from public.press_steward_reports where summary like 'FIXTURE%') - (select count(*) from d) as fixtures_left;`
   - Expected: `deleted = 1, fixtures_left = 0`. If `deleted = 0`, the row is already gone.
2. Create a Supabase personal access token (supabase.com → Account → Access Tokens).
   - Add it in GitHub → schnubsy/press → Settings → Secrets → Actions as `SUPABASE_ACCESS_TOKEN`.
   - Then Actions → "Auth email sync" → Run workflow.
   - Expected: the run is green and prints "SHIP PROOF — Supabase Auth serves the repo's Family Wing email".
3. NAS zip of the Mac press folder (migrate.md step 7):
   `test -d ~/Documents/code/press && ditto -c -k --keepParent ~/Documents/code/press "<NAS>/archive/code/press-2026-10-11.zip" && unzip -l "<NAS>/archive/code/press-2026-10-11.zip" | tail -1`
   - Expected: a file count > 0 on the last line. Only then delete the Mac folder.
