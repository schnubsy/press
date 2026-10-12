# press — HANDOFF

_Last updated: 2026-10-12. arc/steward-report (the Steward report page), run by a cloud Builder._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: PR pending (branch arc/steward-report)
- Home: `github:schnubsy/press`. Work happens in a cloud clone. The repo is PUBLIC and stays public.
- Ship gate: `bash scripts/gauntlet.sh` via `.claude/skills/verify/SKILL.md`.
  - Cloud run 2026-10-12: unit 101/0 · inline in sync · Playwright 88 + 1 WebKit-only skip.
  - tenants-check: 31 pass / 21 fail. All 21 FAILs are T2–T4 "repo MISSING". The seven tenant repos were outside this session's GitHub scope.
- New: `steward.html` (private wing) · Edge Function `steward-reports` v2 (ezbr `6d542a81…`) · table `press_steward_reports` · RPC `press_steward_capability_ok`.

## Shipped this arc
- **S1 `155c873`**: `press_steward_reports` applied. Service-role-only: RLS on, 0 policies, no anon or authenticated grant.
- **S2 `910da08`**: `steward.html` with the latest report and a 12-week strip, 390-first.
  - Registered in spaces, pages and tenants JSON, KICKERS/ICONS, the favicon register and the council snag-registry row.
  - Reads go through `steward-reports` on the private wing's Card Scout capability.
- **S3 `02fff38`**: review 🔴 fixed. The first gate trusted press_deals rows, which anon can forge. It now uses the server-held-default RPC.
  - Also: calendar-week strip, XSS and lock specs, and `docs/spec.md` → Tenants "Borrowed capability".
- Evidence: `docs/evidence/steward-report-slice-{1,2,3}-*`, `steward-report-merge-review.md`.

## Open / blockers
- **Fixture row** `press_steward_reports.id=1` still exists. The connector DELETE timed out on its confirmation step (#94450).
  - Its `run_at` was moved outside the 84-day window, so the page does not show it.
  - Deletion is Mark's step 1.
- **`.claude/settings.json`** (`Bash(gh pr merge:*)`, arc.md D1) is missing. Writing it was refused by the auto-mode classifier
  `[Self-Modification]`. Code change → next arc, slice 1.
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. steward no longer depends on them.
  - Anyone can still insert junk deals rows that carry their own sync_id. Card Scout tenant arc → next steps.
- **Cloud gauntlet stage 3** is red only because tenant repos are not in session scope. Dispatch press arcs with
  card-scout, cardsharp, fsa, giving, optimo, remit and retirement in scope (or make tenants-check SKIP absent clones in cloud mode).
- Carried: flow `kayley.html` compare, BLOCKED (flow out of scope) · NAS zip (Mark) · Actions secrets confirm (Mark) ·
  remote branch `claude/perth-phase-2-security-c7a88b` is safe to delete · Issues #28–#32.

## Exact next steps
1. Chat: run verify on this arc's PR. The close-out report is its final comment.
   - Live `https://schnubsy.github.io/press/steward.html` → 200 was BLOCKED here (egress), so verify checks it in Chrome.
   - Unlock with the passkey → expect the empty state ("No reports yet") until the first watch row lands.
2. Next press arc: **press-hygiene**. HOME: github:schnubsy/press · BRANCH: arc/press-hygiene
   - S1: add `.claude/settings.json` = `{"permissions": {"allow": ["Bash(gh pr merge:*)"]}}`.
   - S2: tenants-check cloud mode, so absent sibling clones SKIP when `PW_CHROMIUM`/cloud is detected (or dispatch with the tenant repos in scope).
   - S3: flow kayley carry-over. Needs schnubsy/flow in scope; see the prior HANDOFF steps in git history (`76c7b0c`).
3. Card Scout tenant arc (schnubsy/card-scout + press in scope): revoke anon INSERT/TRUNCATE/REFERENCES/TRIGGER on `press_deals`.
   - First confirm that no browser path inserts deals; the agent writes with the service role.
4. Snag train / polish for Issues #28–#32 when Mark wants it.

## Mark's manual steps
1. Delete the fixture row in the Supabase SQL editor (project `eepjhpyziczrxvirczio`). Run as ONE statement:
   `with d as (delete from public.press_steward_reports where id = 1 and summary like 'FIXTURE — arc/steward-report%' returning id) select (select count(*) from d) as deleted, (select count(*) from public.press_steward_reports where summary like 'FIXTURE%') - (select count(*) from d) as fixtures_left;`
   - Expected: `deleted = 1, fixtures_left = 0`. If `deleted = 0`, the row is already gone; nothing to do.
2. NAS zip of the Mac press folder (migrate.md step 7):
   `test -d ~/Documents/code/press && ditto -c -k --keepParent ~/Documents/code/press "<NAS>/archive/code/press-2026-10-11.zip" && unzip -l "<NAS>/archive/code/press-2026-10-11.zip" | tail -1`
   - Expected: a file count > 0 on the last line. Only then delete the Mac folder (Finder).
3. Check GitHub → schnubsy/press → Settings → Secrets → Actions.
   - Expected: `SUPABASE_PRESS_ANON_KEY` is listed (optionally `AGENT_HEALTH_HEARTBEAT_URL`) and the daily Agent health notifier runs green.
