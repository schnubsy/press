# press — HANDOFF

_Last updated: 2026-10-19. arc/amazon-memos-monitor — Agent Monitor registers Amazon memos + night-window times (cloud Builder)._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: Merged: PR #52 415c826 on 2026-10-19; main checkout on main @ 415c826
- Home: `github:schnubsy/press`. Work happens in a cloud clone. The repo is PUBLIC and stays public.
- Agent alerting rule (Mark, 2026-10-13): nothing running is SLA-critical — one push + email only when an item has been
  down (late/failed) for 24h+, one quiet "working again" after. Contract: `docs/spec.md` → Agent Monitor · Alerting.
- Live: Edge Function `agent-watch` v7 (verified: 02:00 UTC tick ok, cleared the FSA inlet episode); migration
  `agent_monitor_quiet_alerts` applied; GH `agent-health-notifier` every 6 h.
- Ship gate: `bash scripts/gauntlet.sh` (verify skill) — 0 webkit · 1 unit · 2 inline · 3 tenants-check · 4 Playwright · 5 ui-audit.

## Shipped this arc
- **S1**: `db/20261019_amazon_memos_expect.sql` (council PR #56's staged patch, verbatim) — `press_agent_expect` row
  `amazon-memos` (The Money · browser-task · checkin · weekly Mon 01:43 CT · grace 1440 · sort 75) + five check-in rows moved
  to night-window times (card-scout-weekly-store-check Wed 03:41 · cowork-popup-watch Mon 02:52 · snag-train 2nd 02:13 ·
  steward-audit 1st 04:14 · steward-watch Mon 04:24). Live dry-run (rolled back) OK; applied after merge via the connector.
- Gauntlet: unit 151/0 · inline ✓ · Playwright 150 ✓ · ui-audit GREEN; tenants-check red only for absent sibling tenant
  repos (identical without the patch). Evidence `docs/evidence/amazon-memos-monitor-*`. No page, publish or Edge Function change.
- Earlier (tenants-check-siblings, 2026-10-14): tenants-check defaults = sibling clones.

## Open / blockers
- **snag-train `kind` is still `mac-task`** while its `what` now says "Cloud scheduled task" (from council's patch) — confirm
  where it runs and fix `kind` in a follow-up if it moved to the cloud (D1 🟡).
- **FSA receipt inlet** is off on the monitor until it actually reports in; switch `press_agent_expect.enabled` back on then.
- **The shared gates still carry sub-44px controls.** `src/gate.js` (`.pg-back`, `.pg-btn`) and `src/family-gate.js`
  (`.fg-back`, `.fg-link`) are fixed on press pages by page-level overrides only; editing the modules drifts 7 tenants (T3).
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. Steward no longer depends on them.
- **Cloud gauntlet stage 3**: tenants-check defaults to sibling clones now; a vendored/released tenant whose repo is absent
  still FAILs T2 (by design) — dispatch press arcs with the tenant repos in scope. council-guide's `repoPath`
  (`~/Documents/Claude/council-hub/council`, tenants.json) SKIPs T2 in the cloud.
- Carried: on-demand AI functions record no runs ("No data") · optimo's cloud Playwright baseline RED (env) · flow
  `kayley.html` compare BLOCKED (flow out of scope) · Issues #28–#32 · remote branch `claude/perth-phase-2-security-c7a88b`
  safe to delete.

## Exact next steps
1. **Tenant wave — shared-gate tap targets** (one arc per tenant, or one wave): move the page-level overrides into
   `src/gate.js` + `src/family-gate.js` (min-height 44 on `.pg-btn`; inline-flex 44px `.pg-back` / `.fg-back` / `.fg-link`),
   then every tenant re-vendors (card-scout, retirement, giving, fsa, cardsharp; remit, optimo) and re-publishes; drop the
   overrides from index.html + steward.html; tenants-check T3 0 fail. The tenants' own safari-ui roll-outs can carry it.
2. press-hygiene arc (HOME github:schnubsy/press · BRANCH arc/press-hygiene):
   - ui-audit config: add the unaudited states (steward gate before enrolment, access OTP code step + "not an admin",
     family-gate send/verify errors) — D1 review 🟡; give access `.sw2` switches `tabindex=0` + Space/Enter (pre-existing a11y gap).
   - tenants.json council-guide `repoPath` → drop it (or fall back to `CODE_ROOT/council`) so T2 sees the sibling council clone.
   - flow kayley carry-over (needs schnubsy/flow in scope).
   - pin auth-email-sync actions to SHAs + move off Node 20 (GitHub deprecation warning).
   - (done here: `.claude/settings.json` exists; the 390px private-wing pill wrap is fixed.)
3. Card Scout tenant arc (schnubsy/card-scout + press in scope): revoke anon INSERT/TRUNCATE/REFERENCES/TRIGGER on
   `press_deals` after confirming no browser path inserts deals; keep the `sync_id` literal default
   (`press_steward_capability_ok(<real key>)` must stay true); re-sync `docs/cowork-task.md`.
4. remit arc: CLAUDE.md access contract → opt-out (`remit_has_access()` delegates to `press_access_has`).
5. claude-environment: any Mac task that runs press tenants-check without a sibling council clone exports
   `COUNCIL_DIR=~/Documents/Claude/council-hub/council` (else T8 FAILs — D1 review 🟡). The carried
   `docs/evidence/unpin-the-mac-slice-2-press.patch` predates S2 — never re-apply it.
6. council (mac home): release.md/press.md → the press spec "Card naming — marquee label map" + Agent Monitor registration
   rule; MANUAL Steward update; claude-environment `system/scheduled-tasks/` edits.
7. Elevate Ops: brand its "Magic Link" auth email.

## Mark's manual steps
1. Token renewal: `press-auth-email-sync` expires 2027-10 — make a new one (same two permissions: Auth Config RW +
   Project Settings RW, press only) and update the Actions secret `SUPABASE_ACCESS_TOKEN`.
