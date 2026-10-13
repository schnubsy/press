# press — HANDOFF

_Last updated: 2026-10-13. arc/safari-ui — the iPhone UI audit on WebKit (cloud Builder)._

## Standing rule: publish auto-close (do NOT re-litigate)

When a **green arc or hotfix** ends in an outward-facing publish, that publish does NOT need a separate merge approval from
Mark. Once the gauntlet is green, the publish (merge or push to `main`, which GitHub Pages serves) is completed as part of
the close. Auto-merge is still never enabled pre-emptively. Set by Mark 2026-09-18.

## Current state

- Merge state: PR pending (branch arc/safari-ui)
- Home: `github:schnubsy/press`. Work happens in a cloud clone. The repo is PUBLIC and stays public.
- Ship gate: `bash scripts/gauntlet.sh` (verify skill). Now: stage 0 `npx playwright install webkit` · 1 unit · 2 inline ·
  3 tenants-check · 4 Playwright `chromium` + `iphone-webkit` (real WebKit, iPhone 15) · 5 **ui-audit** on WebKit.
  Exit 0 GREEN · 1 RED · 2 PARTIAL (egress — the WebKit hosts are missing from the environment).
- ui-audit: `test/ui-audit/` = council `ui-audit@1.0.0` byte-identical; `test/ui-audit.config.mjs` = 20 press-native states
  × 320/375/390/393/430 × dark+light (200 surfaces). Close evidence: `docs/evidence/safari-ui-slice-3-review-*`.
- `.claude/settings.json` (`Bash(gh pr merge:*)`) is on main (backfilled by a Mac session, `32d8498`).

## Shipped this arc
- **S1 `334d533`**: harness + gauntlet stages + iphone-webkit project + secrets-map Egress (`cdn.playwright.dev`,
  `playwright.download.prss.microsoft.com`). First run RED (76 wrap · 420 touch · 170 font16). sealed-unlock's WebKit test
  no longer silently skips in cloud mode.
- **S2 `3c734f2`**: every defect fixed — 44px tap boxes (pills keep their look via `::before`), the mini controls are real
  `<button>`s (fixes the 390px pill wrap from PR #35), 16px text fields, "Set up a new passkey" is a one-line button, access
  switch 44×44. One designed exception: agent-health `.row .line` (server status copy that must wrap).
- **S3 `f671ac7`**: code-review — bash 3.2 empty-array 🔴 fixed; desktop tests chromium-only; steward-denied state audited
  (its inline link is now running text).

## Open / blockers
- **The shared gates still carry sub-44px controls.** `src/gate.js` (`.pg-back`, `.pg-btn`) and `src/family-gate.js`
  (`.fg-back`, `.fg-link`) are fixed on press pages by page-level overrides only; editing the modules drifts 7 tenants (T3).
- **press_deals anon INSERT (and TRUNCATE/REFERENCES/TRIGGER) grants**: pre-existing. Steward no longer depends on them.
- **Cloud gauntlet stage 3**: tenants-check needs the tenant repos as sibling clones (present in this session: 0 fail).
- Carried: on-demand AI functions record no runs ("No data") · optimo's cloud Playwright baseline RED (env) · flow
  `kayley.html` compare BLOCKED (flow out of scope) · Issues #28–#32 · remote branch `claude/perth-phase-2-security-c7a88b`
  safe to delete.

## Exact next steps
1. Chat: run verify on the safari-ui PR (close-out report = its final comment). Live check: `index.html?view=personal`
   on Mark's iPhone — Lock now / Devices / Recovery kit on one line each, pills look unchanged.
2. **Tenant wave — shared-gate tap targets** (one arc per tenant, or one wave): move the page-level overrides into
   `src/gate.js` + `src/family-gate.js` (min-height 44 on `.pg-btn`; inline-flex 44px `.pg-back` / `.fg-back` / `.fg-link`),
   then every tenant re-vendors (card-scout, retirement, giving, fsa, cardsharp; remit, optimo) and re-publishes; drop the
   overrides from index.html + steward.html; tenants-check T3 0 fail. The tenants' own safari-ui roll-outs can carry it.
3. press-hygiene arc (HOME github:schnubsy/press · BRANCH arc/press-hygiene):
   - tenants-check cloud mode, so absent sibling clones SKIP (or always dispatch with the tenant repos in scope).
   - flow kayley carry-over (needs schnubsy/flow in scope).
   - pin auth-email-sync actions to SHAs + move off Node 20 (GitHub deprecation warning).
   - (done here: `.claude/settings.json` exists; the 390px private-wing pill wrap is fixed.)
4. Card Scout tenant arc (schnubsy/card-scout + press in scope): revoke anon INSERT/TRUNCATE/REFERENCES/TRIGGER on
   `press_deals` after confirming no browser path inserts deals; keep the `sync_id` literal default
   (`press_steward_capability_ok(<real key>)` must stay true); re-sync `docs/cowork-task.md`.
5. remit arc: CLAUDE.md access contract → opt-out (`remit_has_access()` delegates to `press_access_has`).
6. council (mac home): release.md/press.md → the press spec "Card naming — marquee label map" + Agent Monitor registration
   rule; MANUAL Steward update; claude-environment `system/scheduled-tasks/` edits.
7. Elevate Ops: brand its "Magic Link" auth email.

## Mark's manual steps
1. Token renewal: `press-auth-email-sync` expires 2027-10 — make a new one (same two permissions: Auth Config RW +
   Project Settings RW, press only) and update the Actions secret `SUPABASE_ACCESS_TOKEN`.
