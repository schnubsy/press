# press — HANDOFF

_Last updated: 2026-11-02. snag-train-2026-11 — six marquee snags on `arc/snag-train-2026-11` (cloud, SHADOW); PR open, not merged._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: PR pending (branch arc/snag-train-2026-11)
- Still open from family-wing-invites (merged PR #59): the council `deploy/targets.json` row (STAGED patch
  `docs/evidence/family-wing-invites-staged-council.patch`) and Barb's live invite proof.
- Home: `github:schnubsy/press`. Work happens in a cloud clone. The repo is PUBLIC and stays public.
- Agent alerting rule (Mark, 2026-10-13): nothing running is SLA-critical — one push + email only when an item has been
  down (late/failed) for 24h+, one quiet "working again" after. Contract: `docs/spec.md` → Agent Monitor · Alerting.
- Live: Edge Function `agent-watch` (quiet nights deployed after this merge — see the PR close-out for the ezbr proof);
  migration `agent_monitor_quiet_alerts` applied; GH `agent-health-notifier` every 6 h.
- Quiet nights (Mark 2026-10-19): any agent-watch push 22:00–07:00 America/Chicago goes out at Pushover priority −1
  (delivered, no sound); email unchanged. `nightPriority` stays byte-identical with council `tools/quiet-night.mjs`.
- Ship gate: `LANE=standard VIEWS=<changed ui-audit states> bash scripts/gauntlet.sh` (verify skill) — 0 webkit · 1 unit · 2 inline · 3 tenants-check · 4 Playwright · 5 ui-audit.

## Shipped this arc (snag-train-2026-11, 2026-11-02 — on the branch, NOT yet merged or published)
- Gate-enabling `f462844`: `scripts/gauntlet.sh` reads `LANE` (+ `VIEWS` gates stage 5); `iphone-webkit` states `browserName: 'webkit'`.
- #28 + #30 already met (kickers are taglines since marquee-polish S1; FSA = stethoscope since the LABELS rework) — specs pin both.
- #29 phone wing cards: 14px hero→meta. #31 Thrift Shop connect row hint. #32 collapsed Connect: page ends 16px under Manage.
- #34 recovery kit: "Unlock with passkey to include Cardsharp". Evidence `docs/evidence/snag-train-2026-11-*`.
- Close-out manifest: push DONE · PR DONE (not draft) · merge review BLOCKED (no reviewer — no Agent tool; the chat reviews the
  diff before the button) · merge: → Mark's button at verify · reconcile: → chat after merge · stage stamp: → chat after merge ·
  migrations N/A (no db) · deploy N/A · publish N/A (press-native — Pages serves main on merge; rollback `git revert <merge sha>`,
  previous index.html blob 973d31635907) · catalog N/A (no new page) · handoff DONE · report-back: the PR's final comment.

## Open / blockers
- **snag-train `kind` is still `mac-task`** while its `what` now says "Cloud scheduled task" (from council's patch) — confirm
  where it runs and fix `kind` in a follow-up if it moved to the cloud (D1 🟡).
- **FSA receipt inlet** is off on the monitor until it actually reports in; switch `press_agent_expect.enabled` back on then.
- **The shared gates still carry sub-44px controls.** `src/gate.js` (`.pg-back`, `.pg-btn`) and `src/family-gate.js`
  (`.fg-back`, `.fg-link`) are fixed on press pages by page-level overrides only; editing the modules drifts 7 tenants (T3).
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. Steward no longer depends on them.
- **Cloud gauntlet stage 3**: tenants-check defaults to sibling clones; with all tenant repos (9 now, incl. rebate-radar) + council attached it is GREEN
  (76/0/24, this arc). A tenant repo left out still FAILs T2 (by design) — dispatch press arcs with the tenant repos in scope. council-guide's `repoPath`
  (`~/Documents/Claude/council-hub/council`, tenants.json) SKIPs T2 in the cloud.
- Carried: on-demand AI functions record no runs ("No data") · optimo's cloud Playwright baseline RED (env) · flow
  `kayley.html` compare BLOCKED (flow out of scope) · remote branch `claude/perth-phase-2-security-c7a88b`
  and merged `inbox/perth-rebuild` (if still present) safe to delete.

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
