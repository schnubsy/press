# migrate-home — slice 1 — §0 gate · Home line · path sweep · secrets map · verify skill · cloud gauntlet

Run: cloud Claude Code Builder, fresh clone of schnubsy/press (full depth), branch `arc/migrate-home`, 2026-10-11.

## §0 close-out gate (council migrate.md)
| Check | Result |
|---|---|
| working tree clean + pushed | `git status --porcelain` empty; `git rev-list --count origin/main..main` = 0 |
| unmerged branches | local: only `arc/migrate-home` (this arc, PR #27). Remote `--no-merged origin/main`: `arc/migrate-home` (this arc) and `claude/perth-phase-2-security-c7a88b` — 1 `+` commit `b445d4e` (`db/20260922_perth_rls_gate.sql` + rollback), no PR ever opened. The migration **is applied live** (`list_migrations`: `20260922170011 perth_rls_gate`), so its mirror belonged on main: **cherry-picked into this arc** (db mirror only, no live effect). Other remote arc branches: `git cherry` = 0 `+` (in main). |
| worktrees | `git worktree list` = the clone only (web home, ephemeral) |
| HANDOFF current | stale (2026-09-24, Mac MAIN CHECKOUT wording) — overwritten at this arc's close |
| backlog = Issues | `BACKLOG.md` holds Eye polish (P1–P3), not app defects — filed as Issues in S2 |
| ARC.md tail | this arc's order — ticked/truncated at the close |
| repo settings | visibility `public` (stays PUBLIC, never changed); `delete_branch_on_merge` = `true` (step 6a already satisfied) |

## Path sweep — `grep -rn "Documents/code\|/Users/mark" .` (excl. .git, node_modules)
- `ARC.md:18` — the order text itself; truncated at close.
- `HANDOFF.md:33,53` — Mac MAIN CHECKOUT wording; HANDOFF is overwritten at the close (GitHub wording).
- `tools/tenants-check.mjs:28,30` — Mac-only **defaults** for `CODE_ROOT` / `COUNCIL_DIR`, kept as Mac wording (comment now says so);
  `scripts/gauntlet.sh` passes the sibling-clone parent / `../council` in the cloud.
- `docs/evidence/cardsharp-seal-slice-6.txt`, `docs/evidence/marquee-tenancy-slice-3-tenants-check.txt` — historical evidence
  (immutable records of Mac runs); left as-is.

## Secrets map
`docs/secrets-map.md` — 0 `.env*` keys; 2 GitHub Actions secret **names** (`SUPABASE_PRESS_ANON_KEY` — publishable by design;
`AGENT_HEALTH_HEARTBEAT_URL`). Whether they are set: BLOCKED from the cloud (`actions/secrets` → proxy HTTP 403).

## Verify skill + gauntlet
- New `scripts/gauntlet.sh` (4 stages) + `.claude/skills/verify/SKILL.md`; `.gitignore` now `.claude/*` + `!.claude/skills/`.
- Cloud mode (optimo arc-7 precedent): `playwright.config.mjs` launches `PW_CHROMIUM` when set; `test/wing-drag-iphone.spec.mjs`
  runs as Chromium iPhone-15 emulation when `PW_CHROMIUM` is set (vendor assertion kept for real WebKit). Unset = Mac behaviour unchanged.
- Before cloud mode: 80/81 Playwright tests failed at browser launch (`chromium_headless_shell-1243` missing — pinned Playwright 1.63 vs image Chromium 1194).
- Result (`docs/evidence/migrate-home-slice-1-baseline-gauntlet.txt`): unit 91/0 · inline:check in sync · tenants-check 50 pass / 0 fail / 21 skip ·
  Playwright 80 passed, 1 skipped (`sealed-unlock.spec.mjs:221` real-WebKit IDB test — no WebKit in the cloud image) → **GAUNTLET GREEN, exit 0**.
