
## 2026-10-14 — pointer: thrift-shop rename (tenant-change arc)
CLOSED 2026-10-14 — press PR #44 merged `bd38aec` (thrift-shop PR #29 `ff3b592`); thrift-shop.html published, card-scout.html = redirect stub. Nothing to run here.

## 2026-10-14 — Fix (verify 🔴): land press S2 — tenants-check sibling-clone defaults

HOME: github:schnubsy/press
BRANCH: arc/tenants-check-siblings
PUBLISH TARGETS: none
DEPLOYS: none
SLICES: 1

**Why (verify of fsa-claims PR #20, 2026-10-14).** S2 of "Unpin the Mac" was built and gauntlet-GREEN but its push was
refused (press not in that Builder's session). The patch is committed on this branch at
`docs/evidence/unpin-the-mac-slice-2-press.patch` (applies cleanly on b01de06 — verified).

S1 — `git apply docs/evidence/unpin-the-mac-slice-2-press.patch`: `tools/tenants-check.mjs` `CODE_ROOT` default = parent of
the press clone, `COUNCIL_DIR` default = sibling `../council` (env overrides kept; no `homedir()/Documents` defaults —
the `~` expansion of `repoPath` is fine). Add the one-line press-side note (CLAUDE.md or the tool's header) that a Mac
press run sets `COUNCIL_DIR` / `CODE_ROOT` when its siblings aren't beside it. Clone council and the tenant repos the
check needs as siblings, then press gauntlet GREEN (test/tenants-check.test.mjs incl. the new defaults test). No page or
publish change. D1 self-merge.
LAST line `Chat: run verify`.
