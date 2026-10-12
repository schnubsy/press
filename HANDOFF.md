# press — HANDOFF

_Last updated: 2026-10-12 (evening). arc/steward-report + PR #35 marquee-wings-monitor, then hotfix PR #37 and Winston PR #38._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: Merged: PR #38 a07e2a5 on 2026-10-12; main checkout on main @ a07e2a5
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

- **Hotfix PR #37 `432d40d`**: Agent Monitor 401 (anon EXECUTE on the schedule helpers) · Access Manager switches never saved
  (auth headers replaced) · labels "User Access Management" / "System Health". Live-verified in Chrome.
- **Winston PR #38 `a07e2a5`** — RULE (Mark): every email Claude sends comes from **Winston**
  (winston.marksclaude@gmail.com). Supabase Auth SMTP = Winston on press AND elevate-ops; MAILER_* and COUNCIL_MAILER_* point at the
  Winston mailer; `select public.press_winston_mail(subject, body[, to, cc])` is the one SQL entry point (edge fn `winston-mail`).
  Live proof: Family Wing code, Elevate Ops magic link, alert and press_winston_mail mails all delivered from Winston.
- Auth email sync ran green (Mark's scoped token `press-auth-email-sync`: Auth Config RW + Project Settings RW, press only).

## Open / blockers
- **`.claude/settings.json`** (`Bash(gh pr merge:*)`, arc.md D1) is missing. Writing it was refused by the auto-mode classifier
  `[Self-Modification]`. Code change → next press arc.
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. Steward no longer depends on them.
- **Cloud gauntlet stage 3**: tenants-check FAILs T2–T4 when tenant repos are not in session scope. Dispatch press arcs with the tenant repos.
- From PR #35:
  - On-demand AI functions record no runs ("No data").
  - optimo's cloud Playwright baseline is RED (env).
- Carried:
  - flow `kayley.html` compare, BLOCKED (flow out of scope).
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
   - MANUAL Steward update (scheduled-task check-ins + Winston reports, §12.6 prune daily/30d, notifier all apps).
   - Merge council PR #29 (Winston standard, v4.14.1) on the Mac, rebuild the bundle, Mark reloads.
   - Commit the claude-environment `system/scheduled-tasks/` edits (check-in + Winston report steps) on the Mac.
6. Elevate Ops: brand its "Magic Link" auth email (it now sends from Winston with Supabase's default wording).
7. press-hygiene S5: pin auth-email-sync actions to SHAs + move off Node 20 (GitHub deprecation warning).
   - The watch/audit now write `press_steward_reports` rows (the table is live).

## Mark's manual steps
1. Token renewal: `press-auth-email-sync` expires 2027-10 — make a new one (same two permissions: Auth Config RW +
   Project Settings RW, press only) and update the Actions secret `SUPABASE_ACCESS_TOKEN`.
(NAS zip of the Mac press folder: DONE by Mark 2026-10-12.)
