# arc/chrome-route-press — close-out report (2026-10-20)

PR: https://github.com/schnubsy/press/pull/53 · merge `0837afa5bdd0707f9e7a4c886066eb257ca503aa` · stage stamp `bcc32c4`
Commits: a4758d3 (slice 1 — council chrome-keeper staged patch, verbatim) · 6cc49b1 (arc close) · 8417500 (D1 review)

## Gates
- Full gauntlet (all 8 tenant repos + council as siblings, CODE_ROOT/COUNCIL_DIR set): **GREEN, exit 0** — unit 152/0 ·
  inline ✓ · tenants-check 76 pass / 0 fail / 24 skip (by-design: press-native pages, no vendored gate/release; council-guide
  repoPath carried) · Playwright 150 · ui-audit GREEN on WebKit 26.6 (200 surfaces). `docs/evidence/chrome-route-press-gauntlet.txt`
- Sentry: diff secrets scan 0 hits. `docs/evidence/chrome-route-press-sentry.md`
- CI: none configured on the PR (0 check runs).
- D1 reviewer (fresh subagent): **no 🔴** (4 🟡, all by-design or handled in this close). `docs/evidence/chrome-route-press-merge-review.md`

## Post-merge
- Migration `db/20261020_chrome_route_expect.sql` (blob 473dc1a7 == merge SHA) applied via the connector (`chrome_route_expect`).
  Read-back: chrome-preflight `{"daily":["01:10"]}` grace 180 · amazon-memos `{"weekly":{"at":"01:20","dow":1}}` ·
  card-scout-weekly-store-check `{"weekly":{"at":"01:35","dow":3}}` — matches the order.
- Deploy `agent-watch` from the merge SHA via the connector, verify_jwt false (kept): version 8 → 9,
  ezbr_sha256 `10d284ae…6118` → `1a161e81…c9fd` (CHANGED); read-back source = merge-SHA files (index.ts imports + calls
  `nightPriority`; watch-core.mjs carries the block; _shared/notify.mjs unchanged).
- Dry tick `{"dry":true}` with the Vault header secret (via net.http_post, value never printed): HTTP 200,
  `outcome ok · healthy 14 · no-data 12 · off 2 · alerts [] · sent push none / email none` — notified nothing.

## Close-out manifest
| step | outcome |
|---|---|
| push | DONE — arc/chrome-route-press @ 8417500 |
| PR | DONE — #53 |
| merge review (D1) | DONE — no 🔴, `docs/evidence/chrome-route-press-merge-review.md` |
| merge | DONE — 0837afa (Builder-merged via GitHub connector) |
| reconcile main checkout | DONE — origin/main == 0837afa asserted, then stamp bcc32c4 |
| migrations/backfills | DONE — chrome_route_expect applied + read back (above) |
| deploy | DONE — agent-watch v9, ezbr 10d284ae→1a161e81, verify_jwt false, dry tick 200 |
| publish | N/A — PUBLISH TARGETS: none; no page changed |
| inbox cleanup | N/A — web home: ARC.md is committed and was truncated in the close; no uncommitted copies |
| handoff | DONE — CLAUDE.md stage, history, lessons, HANDOFF, ARC truncate in 6cc49b1; stamp bcc32c4 |
| worktree sweep | N/A — web home, ephemeral cloud clone |
| report-back | DONE — this report as PR #53's final comment |

Mark's manual steps: none new.
