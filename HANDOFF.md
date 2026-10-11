# press — HANDOFF

_Last updated: 2026-10-11 — arc/migrate-home (press → GitHub home), cloud Builder, PR #27._

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge approval
from Mark. When the gauntlet is green, complete the publish (merge/push to `main`, which GitHub Pages serves)
as part of closing out. (Auto-merge is still never enabled pre-emptively.) Set by Mark 2026-09-18.

## Current state

- Merge state: Merged: PR #27 76c7b0c on 2026-10-11; main checkout on main @ 76c7b0c
- Home: `github:schnubsy/press` — work happens in a cloud clone (`git clone https://github.com/schnubsy/press`); PUBLIC, stays public.
- Ship gate: `bash scripts/gauntlet.sh` via `.claude/skills/verify/SKILL.md` — cloud GREEN 2026-10-11 (unit 91/0 ·
  inline in sync · tenants-check 50/0 · Playwright 80 passed + 1 WebKit-only skip).
- `delete_branch_on_merge` = true (already set). Served pages unchanged by this arc.

## Shipped this arc
- S1 Home line · path sweep · `docs/secrets-map.md` · gauntlet + verify skill (cloud mode) · `perth_rls_gate` db mirror onto main.
- S2 CLAUDE.md served pages (+cardsharp, +optimo app dir, retirement live state) · BACKLOG → Issues #28–#32 · T6 grants live.
- S3 adversarial review (0 defects, 5 nits fixed) · sentry GREEN.
- Evidence: `docs/evidence/migrate-home-slice-{1,2,3}-*`.

## Open / blockers
- **flow `kayley.html` compare — BLOCKED.** schnubsy/flow was not in this session's repo scope (no `add_repo`; clone auth
  failed). press `kayley.html` blob `347e248` unchanged; flow's per migrate.md §2 = `779b1c4`. flow must NOT be archived
  until a press arc with flow in scope diffs the two (next steps).
- **GitHub Actions secrets set-state** unreadable from the cloud (proxy 403 on `actions/secrets`) — see Mark's step 2.
- **NAS zip** of the Mac press folder — Mark's step 1 (BLOCKED in the cloud).
- Remote branch `claude/perth-phase-2-security-c7a88b` survives (cloud cannot delete remote branches); its only commit is
  now on main by patch-id — safe for Mark/the chat to delete.
- Issues #28–#32 (Eye polish, `page:index`).

## Exact next steps
1. Chat: run verify on PR #27 (close-out report is its final comment).
2. Next press arc — **flow kayley carry-over** (dispatch with BOTH repos in scope):
   HOME: github:schnubsy/press · BRANCH: arc/flow-kayley
   S1 — `git clone https://github.com/schnubsy/flow ../flow` (read-only); diff `../flow/kayley.html` vs `kayley.html`; if flow's
   is newer and correct, bring it in per the press publish rules (pages.json untouched), ship proof (200 + blob == hash-object);
   record the diff in `docs/evidence/`. Then the chat archives flow (`gh repo archive schnubsy/flow --yes`) per migrate.md §2.
3. Snag train / polish arc for Issues #28–#32 when Mark wants it.

## Mark's manual steps
1. NAS zip of the Mac press folder (migrate.md step 7):
   `test -d ~/Documents/code/press && ditto -c -k --keepParent ~/Documents/code/press "<NAS>/archive/code/press-2026-10-11.zip" && unzip -l "<NAS>/archive/code/press-2026-10-11.zip" | tail -1`
   — expected: a file count > 0 on the last line. Only then may the Mac folder be deleted (Finder).
2. Confirm in GitHub → schnubsy/press → Settings → Secrets → Actions that `SUPABASE_PRESS_ANON_KEY` (and optionally
   `AGENT_HEALTH_HEARTBEAT_URL`) exist — expected: both names listed; the daily Agent health notifier runs green.
