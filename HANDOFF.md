# press — HANDOFF

_Last updated: 2026-10-21. arc/publish-thrift-shop-iphone-compact — Thrift Shop iPhone-compact publish (cloud Builder)._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: Merged: PR #54 aa28393 on 2026-10-21; main checkout on main @ aa28393
- Home: `github:schnubsy/press`. Work happens in a cloud clone. The repo is PUBLIC and stays public.
- Agent alerting rule (Mark, 2026-10-13): nothing running is SLA-critical — one push + email only when an item has been
  down (late/failed) for 24h+, one quiet "working again" after. Contract: `docs/spec.md` → Agent Monitor · Alerting.
- Live: Edge Function `agent-watch` (quiet nights deployed after this merge — see the PR close-out for the ezbr proof);
  migration `agent_monitor_quiet_alerts` applied; GH `agent-health-notifier` every 6 h.
- Quiet nights (Mark 2026-10-19): any agent-watch push 22:00–07:00 America/Chicago goes out at Pushover priority −1
  (delivered, no sound); email unchanged. `nightPriority` stays byte-identical with council `tools/quiet-night.mjs`.
- Ship gate: `bash scripts/gauntlet.sh` (verify skill) — 0 webkit · 1 unit · 2 inline · 3 tenants-check · 4 Playwright · 5 ui-audit.

## Shipped this arc
- **S1**: `thrift-shop.html` rebuilt by thrift-shop `tools/release.js` (`--check` clean, no SKIPPED) from thrift-shop main
  9fec8b0 (⊇ PR #33 95c72e1, iphone-compact). Only that file changed: blob d8818498 → **2403c3bb** == `git hash-object` at
  thrift-shop main; stub, pages.json, favicons.md unchanged. One-row header tabs Feed · Sales · Gift cards · Sources · Settings.
- Gauntlet: webkit 26.6 · unit 152/0 · inline ✓ · Playwright 150 · ui-audit GREEN (200 surfaces) · **tenants-check 55/21/24
  RED — BLOCKED (scope)**: the 21 FAILs are T2/T3/T4 for 7 tenant repos not in this session's scope (retirement,
  giving-tracker, fsa-claims, remit, optimo, cardsharp, vantage); identical on origin/main; all thrift-shop rows PASS.
  Sentry: 0 hits. Evidence `docs/evidence/publish-thrift-shop-iphone-compact-*`. Live only once the PR merges (Pages serves main).
- Earlier (chrome-route-press, 2026-10-20): agent-watch quiet nights + Chrome route expect rows (PR #53).

## Open / blockers
- **snag-train `kind` is still `mac-task`** while its `what` now says "Cloud scheduled task" (from council's patch) — confirm
  where it runs and fix `kind` in a follow-up if it moved to the cloud (D1 🟡).
- **FSA receipt inlet** is off on the monitor until it actually reports in; switch `press_agent_expect.enabled` back on then.
- **The shared gates still carry sub-44px controls.** `src/gate.js` (`.pg-back`, `.pg-btn`) and `src/family-gate.js`
  (`.fg-back`, `.fg-link`) are fixed on press pages by page-level overrides only; editing the modules drifts 7 tenants (T3).
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. Steward no longer depends on them.
- **Cloud gauntlet stage 3**: tenants-check defaults to sibling clones; with all 8 tenants + council attached it is GREEN
  (76/0/24, this arc). A tenant repo left out still FAILs T2 (by design) — dispatch press arcs with the tenant repos in scope. council-guide's `repoPath`
  (`~/Documents/Claude/council-hub/council`, tenants.json) SKIPs T2 in the cloud.
- Carried: on-demand AI functions record no runs ("No data") · optimo's cloud Playwright baseline RED (env) · flow
  `kayley.html` compare BLOCKED (flow out of scope) · Issues #28–#32 · remote branch `claude/perth-phase-2-security-c7a88b`
  safe to delete.

## Exact next steps
0. **Chat verify of this PR:** re-run press tenants-check with the 7 tenant repos attached (expect 76/0/24), review the diff,
   merge, then reconcile + post-merge stamp, and confirm live `thrift-shop.html` (cache-bypassed) shows the one-row header and
   the press blob == 2403c3bb.
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
