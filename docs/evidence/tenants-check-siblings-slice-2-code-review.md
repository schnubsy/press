# tenants-check-siblings — slice 2: adversarial review (/code-review, fresh-context subagent on `b01de06..9ed270d`)

| # | Finding | Verdict | Action |
|---|---|---|---|
| 1 | Defaults test compares against `mkdtemp` path, but Node resolves the checker's path symlink-free — on macOS `/var` → `/private/var`, the test fails | CONFIRMED | `estate()` base = `realpathSync(mkdtempSync(...))` |
| 2 | Defaults derived from `SELF_ROOT`, not `PRESS` — `--press <dir>` kept looking beside the checker's own clone | CONFIRMED (minor, not a regression) | defaults now `join(PRESS,'..')` / `join(PRESS,'..','council')`; new `--press` assertion in the defaults test |
| 3 | A bare Mac run with council at `~/Documents/Claude/council-hub/council` now FAILs T8 (registry missing) | By design | header line: a Mac run sets `COUNCIL_DIR` / `CODE_ROOT` when siblings aren't beside it (ARC.md S1) |
| 4 | `doesNotMatch(/snag registry MISSING/)` could pass vacuously if the checker died early | CONFIRMED (false-pass risk) | defaults test now seeds a tenant and asserts a positive `[PASS] T8 registry-parity` line |
| 5 | `homedir` import dead? regex escaping? relative env values? | REJECTED | `homedir` still used for `~` repoPath expansion; escaping correct; relative env values `resolve()`d as before |

Residual (out of scope per ARC.md — "the `~` expansion of `repoPath` is fine"): `tenants.json` council-guide
`repoPath: ~/Documents/Claude/council-hub/council` → T2 SKIP (provenance-only) in a cloud clone. → HANDOFF next steps.

Tests: `node --test test/tenants-check.test.mjs` 34/34. Gauntlet GREEN: `tenants-check-siblings-slice-2-code-review-gauntlet.txt`.
