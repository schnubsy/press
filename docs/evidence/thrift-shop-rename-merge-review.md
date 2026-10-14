# thrift-shop-rename — D1 merge review, press PR #44 (2026-10-14)

The tenant-change arc rides in thrift-shop `arc/thrift-shop-rename`, merged as thrift-shop PR #29 `ff3b592`. Two fresh-context general-purpose sub-agent reviewers reviewed this PR in two rounds.

## Round 1 — `e4aeba3`: 🔴 0 · 🟡 1 · 🟢 3

**Checks that held:**
- `src/gate.js` is byte-identical.
- `KEYRING_ID` is the only link↔keyring mapping, and every portal keyring read/write goes through it.
- The stub never appears on the lobby, the archive, or the cached fallback.
- steward still unlocks.
- Blob hashes match the app source: `thrift-shop.html 7da10522` and `card-scout.html aef66f77`.
- The registries agree with each other.
- T7, T8 and T10 are sound, and their FAIL paths are unit-tested.
- Tests (a)–(d) are behavioural.
- No secrets.
- No dead links (T10 root: 17 files).

**🟡:** the Private Wing built its cards from a possibly CDN-stale spaces.json. For a few minutes after merge it could show a stub card.

## Fix — `bd24c1a`

- The wing list is mapped through `linkFile()` and de-duplicated.
- A new spec case covers it.

**Gauntlet:**
- unit 143/0 · inline ✓ · playwright 148 passed · ui-audit GREEN on WebKit.
- Stage 3 shows 18 FAIL rows. The sorted diff against main is empty: these are T2–T4 for six tenants whose repos this cloud session cannot clone.

## Round 2 — `bd24c1a`: 🔴 0 · 🟡 0 · 🟢 3

- The fix is correct: dedupe, ordering, drag reorder via `data-file`, and other tools are unaffected.
- The new test fails on `e4aeba3`'s index.html (1 failed / 8 passed) and passes on `bd24c1a` (9/9).
- No regressions.

## Open 🟢 (carried)

T8's `formerly` acceptance never expires. The Steward renames the council snag-registry row, then `formerly` is dropped (thrift-shop HANDOFF, next step 5).

## Gate (a)

- No CI is configured (0 check runs).
- Every gauntlet stage this PR can affect is green.
- Stage 3's base-red rows are identical on main. This PR adds no new failure: every thrift-shop T-row passes, and so do T10 stub and T10 root.
