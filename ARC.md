## 2026-10-20 — Chrome route, press half: quiet-night agent-watch + expect rows

Work order — Chrome route, press half: quiet-night agent-watch + expect rows

SLICES: 1 · SINGLE-SLICE JUSTIFICATION: one staged patch applied as a unit
Repo: press   (GitHub: schnubsy/press)
HOME: github:schnubsy/press
DEPLOYS: agent-watch Edge Function (Mark approved — arc chrome-keeper, 2026-10-19)
BRANCH: arc/chrome-route-press
PUBLISH TARGETS: none
EFFORT: low
/goal close-out manifest all DONE/N/A, gauntlet + sentry green, verify evidence committed

WHY: council arc chrome-keeper (PR #59, merge 940bf96) STAGED its press half; the chat's verify (2026-10-20) found the
press FULL gauntlet was not complete — tenants-check could not reach the 8 tenant repos. This session has them attached
(read): cardsharp, fsa-claims, giving-tracker, optimo, remit, retirement, thrift-shop, vantage — clone each as a SIBLING
of press, plus council, so tenants-check runs with CODE_ROOT/COUNCIL_DIR set.

STANDING RULES (verbatim in every order)
(1) Plan mode ONCE at the start. Batch every question up front, then run every slice back-to-back with
    no further pauses. Return only at arc-complete or a genuine blocker.
(2) Session branch arc/<slug>. `git add` by name only, never `-A`. Never `rm -rf` (use `rm -r`). Never
    remove or move a git worktree MID-ORDER — except the WORKTREE SWEEP in rule (4).
(3) PER-SLICE LOOP (every slice): extend the tests to cover the slice → build/typecheck/lint clean →
    run the SCOPED checks only (typecheck + unit + the slice's own specs — testing.md → "Test budget"; the full
    gauntlet runs ONCE, before the PR) → capture done-proof into
    docs/evidence/<arc>-slice-<N>-<name>.<ext> IN THE REPO → commit `feat: slice <N> — <summary>` →
    run /council:handoff → next slice, without returning.
    Per-slice `/council:handoff` is **tick + commit ONLY**: tick this slice `Status: done <sha>` in
    ARC.md and commit — nothing else. The FULL close (CLAUDE.md Current stage, docs/history.md,
    docs/lessons.md, HANDOFF.md overwrite, ARC.md truncate) does NOT run per slice; it runs ONCE at
    arc-complete, BEFORE the PR (rule 4), so it ships inside the same PR.
(4) ARC-COMPLETE CLOSE (fully automatic once gauntlet + sentry are BOTH green):
      FULL CLOSE FIRST (runs ONCE, BEFORE the PR so it ships in the same PR): the final
      `/council:handoff` — overwrite CLAUDE.md Current stage, prepend docs/history.md, promote
      docs/lessons.md, overwrite HANDOFF.md, tick every slice + truncate ARC.md — committed on the
      branch → THEN
      push branch → `gh pr create --fill --base main` → THE MERGE GATE (D1 — "Merge policy (D1)" below):
      an independent reviewer subagent reads the PR diff and returns no 🔴 → `gh pr merge <n> --merge
      --delete-branch` (the Builder merges its own PR; no merge step is Mark's)
      → RECONCILE THE MAIN CHECKOUT (mandatory, immediately after the merge):
          git -C <MAIN CHECKOUT> checkout main && git -C <MAIN CHECKOUT> pull --ff-only
        then ASSERT `git -C <MAIN CHECKOUT> rev-parse HEAD` == the merge commit SHA. (Web home: the
        MAIN CHECKOUT is the cloud clone — `git fetch origin && git checkout main && git pull --ff-only`,
        ASSERT `git rev-parse origin/main` == the merge SHA; control-files.md → "Homes".) The arc is NOT
        closed until this passes. Every manual step Mark runs next — deploy, publish, build — runs
        against the MAIN CHECKOUT's working tree, not against GitHub; a merged PR over a stale main
        checkout ships the PREVIOUS arc's code and reports success. If the pull cannot fast-forward,
        STOP and report a blocker; never force it.
      → POST-MERGE STAGE STAMP (mandatory, immediately after the reconcile, before anything ships): on
        main in the MAIN CHECKOUT, replace ONLY the `Merge state: PR pending (branch arc/<slug>)` line — the
        line after `Home:` in CLAUDE.md Current stage and the first bullet of HANDOFF.md Current state — with
        `Merge state: Merged: PR #<n> <merge-sha> on <date>; main checkout on main @ <sha>` (one-line,
        sed-safe; nothing else in either file changes), commit directly on main as
        `chore: post-merge stage stamp PR #<n>` and push. Without it the stage reports "PR pending"
        forever (vantage, quire, fdd-agent all did on 2026-10-05). Contract: control-files.md →
        "The `Merge state:` line".
      → if the project is a marquee page: PUBLISH via the press instrument, **strictly AFTER the merge
        and the main-checkout reconcile — publishing before merge is a RED close** (it ships the
        pre-merge tree). **Only when press is in this session's push scope** (press is the home, or a
        Mac / interactive session that holds it): build → `gh repo clone schnubsy/press` IN-SESSION (a fresh
        clone — never a Mac press path, never through the device link) → copy <page>.html [+ its assets
        dir] → commit → push; verify the live URL returns 200 AND `git hash-object <file>` == the GitHub
        blob SHA (this is the press case of SHIP PROOF — control-files.md). **A one-shot Builder whose home
        is not the target STAGES it instead** (RULE 2026-10-14 — `dispatch.md` → "Cross-repo writes are
        STAGED"): inside the arc, before the PR, it writes the patch / release command + exact file list
        into its own repo, validates it on a fresh clone of the target with the target's FULL gauntlet,
        and the manifest's publish row reads `STAGED → chat completes at verify`; the chat applies it at
        verify (`verify.md` step 3) and owns its ship proof. The same goes for every other cross-repo write
        (a council registry row, a tenant patch, a MANUAL line).
      → DEPLOY (an Edge Function or a migration this arc ships — RULE 2026-10-14), strictly AFTER the merge +
        reconcile, from the MERGE SHA: small bundles + non-destructive SQL via the connector; a big bundle or SQL
        that trips the destructive pop-up via **the Council deployer** — `node <council>/tools/deploy-request.mjs
        --kind function|migration --repo schnubsy/<repo> --sha <merge sha> … --push --wait 15`, then read back
        through the connector (`surface.md` → "Supabase channel"). The manifest's deploy row is DONE only with the
        receipt (`deploy/receipts/<id>.json`, `ok: true`: `ezbr_sha256` before → after CHANGED) + the read-back. A
        session without push to `schnubsy/council` STAGES the request (its exact flags into
        `docs/evidence/<arc>-staged-deploy.md`) and the row reads `deploy: STAGED → chat completes at verify`.
        A deploy is never Mark's manual step.
      → WORKTREE SWEEP (fixed step, after RECONCILE + STAGE STAMP and after PUBLISH if any; **N/A on a
        web home** — an ephemeral cloud clone dies with its session): from the MAIN
        CHECKOUT on main, for every `.claude/worktrees/agent-*` worktree and every `worktree-agent-*` branch
        (sub-agent output — throwaway by design; a worktree's lifetime is one arc):
          a branch is SAFE when every commit is in main by patch-id (`git cherry main <b>` prints no `+`) OR
          each of its `+` commits has a commit on main with the identical subject line (cherry-picked with
          conflict edits);
          worktree: `rm -f <wt>/node_modules` (the symlink) → `git worktree remove <wt>` (NEVER `--force`: a
          dirty worktree is KEPT and reported) → `git worktree prune -v`;
          branch: SAFE → `git branch -D <b>`; not SAFE → keep it and list it in HANDOFF "Open / blockers" with
          `git log --oneline main..<b>` — a judgement call for Mark, the ONLY way a worktree reaches him.
        POSTCONDITION (asserted; proof into the close-out evidence): `git worktree list` == the main checkout
        only (+ any reported dirty ones) AND `git branch --list 'worktree-agent-*'` == only the reported
        unsafe ones. When the arc published from a Mac press checkout, the sweep also covers it: worktrees
        outside the main checkout named in the arc are removed (same no-force rule) and their branches, once
        merged into main, deleted with `git branch -d`. `tools/project-drift.mjs --fix` runs the same sweep.
      → SHIP PROOF for anything this arc deployed or published, per control-files.md → "Verify the
        artifact, not the act": fingerprint before AND after, assert it CHANGED and matches source.
        A deploy this arc cannot prove is a RED gate, not a footnote.
      → INBOX CLEANUP: after the merge, remove the now-duplicate uncommitted inbox copies (ARC.md +
        INBOX FILES) from the MAIN CHECKOUT **only if** each is byte-identical (`git hash-object`) to its
        merged version; if any differs, LEAVE it and report the mismatch.
      → report: commits, PR URL, live URL, evidence files, Mark's manual steps (the full close/handoff
        already ran BEFORE the PR, per the top of this rule — it is not repeated here). The report's
        LAST line is always: `Chat: run verify` (Snag's verify instrument re-checks every claim —
        skills/hand/references/verify.md).
      → REPORT-BACK CONTRACT: the close-out report (with the manifest) is posted as the PR's FINAL
        COMMENT (`gh pr comment <n> --body-file <report>`) AND returned to the dispatcher (the one-shot
        task's run transcript, or the Local Code session). The chat verifies from those
        (skills/hand/references/dispatch.md → "Report-back").
      → CLOSE-OUT MANIFEST (the close is not complete until this is emitted). Enumerate EVERY
        required close step and give each EXACTLY ONE explicit outcome — never silence, never prose:
          push · PR · merge review (D1 reviewer verdict file) · merge · reconcile main checkout ·
          migrations/backfills · deploy · publish ·
          inbox cleanup · handoff · worktree sweep (DONE + counts removed/kept · N/A only if none existed,
          or a web home's ephemeral clone) · report-back (PR final comment URL)
        Per step, one of:
          DONE     + its proof (sha, hash, version fingerprint, URL status) — an assertion is not proof
          STAGED   + the staged patch path + the target's FULL-gauntlet result on a fresh clone — ONLY for a
                     write to a repo that is not this home (publish, registry row, tenant patch, MANUAL
                     line); the row reads `publish: STAGED → chat completes at verify`. Never BLOCKED for a
                     missing target repo, never "Mark: add the repo" (dispatch.md → "Cross-repo writes")
          N/A      + one line saying why it does not apply to this project
          BLOCKED  + it goes to HANDOFF "Mark's manual steps" as a NUMBERED item carrying its guarded
                     command (precondition && action && postcondition) and the expected postcondition value
                     — except a CODE CHANGE: still BLOCKED in the manifest, but it goes to HANDOFF
                     "Exact next steps" as a slice of the next arc order, never to "Mark's manual steps"
                     (RULE 2026-10-10: "A code change is never Mark's manual step — it goes into the
                     next arc order", handoff.md)
        A step that is neither DONE, N/A, STAGED nor BLOCKED is a RED close. Absence is the failure mode this
        exists to catch: on 2026-09-21 a required publish was simply missing from the report and
        nobody noticed for four hours.
      → THE SYNC-CANARY LINE, fixed wording (when the arc touched the council plugin): there is NO reload step — the
        repo is a synced claude.ai marketplace and the version bump IS the release (CLAUDE.md "Stack & how to
        run"). The close-out lists, for the chat's verify to paste once the version lands (never in "Mark's manual steps"), EXACTLY
        `Sync canary (paste into a NEW chat): /council:‹seat› ‹question› → ‹expected answer›.`
        — one line, the canary STARTS with the `/council:` slash command and its answer is stated in a SKILL.md
        (handoff.md → "Canary rules"), no terminal check blended in. A stale answer after the version landed
        is a sync fault, not a repo bug: Customize → Plugins → council shows the synced version.
      → the close-out report ENDS with `Chat: run verify` — nothing after it.
    If either gate is RED (or the D1 reviewer's 🔴 cannot be fixed in-arc): stop at the last green slice, leave the branch pushed, open the PR as DRAFT,
    and report. Nothing else returns to Mark.
(5) Publishing is PART OF THE CLOSE — the old "press publishing stays Mark's" rule is retired. Publish
    strictly AFTER merge + the main-checkout reconcile; **publishing before merge is a RED close.** A
    one-shot Builder off the target's home stages the publish (rule 4) and the chat completes it at verify.
(6) Never claim "deployed" / "published" / "live" from a command's exit code, a printed success line,
    or an incremented version number. Ship proof or it did not ship.

ORIENT FIRST
INBOX SYNC (first, before reading anything): if this session is in a git worktree
(`git rev-parse --git-common-dir` ≠ `.git`), copy ARC.md + every file on the INBOX FILES line from
MAIN CHECKOUT into the worktree byte-identical (verify with `git hash-object` both sides) — never
reconstruct a file the order says exists; if ARC.md is still empty afterwards, STOP and report a blocker
(control-files.md "Inbox delivery").
Read: CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md. Then spawn ONE Explore sub-agent to read
docs/lessons.md + docs/history.md + the council dossiers and return ONLY the lines relevant to this
arc's topics (never read those whole — the recall rule, control-files.md).

=== SLICE 1 — apply the staged chrome-keeper patch ===
Scope: quiet nights for agent-watch pushes (22:00–07:00 CT at priority −1) + Agent Monitor expect rows for the Chrome route.
Files in play: db/20261020_chrome_route_expect.sql, supabase/functions/agent-watch/{watch-core.mjs,index.ts}, test/agent-monitor.test.mjs.
Implementation: from a sibling council clone at origin/main (940bf96 or later), `git apply --index
../council/docs/evidence/chrome-keeper-staged-press.patch` (applies cleanly on press 0ed1f59, checked by the chat), commit
`feat: slice 1 — quiet-night agent-watch + chrome route expect rows`. Full press gauntlet WITH the tenant sibling clones.
After merge: apply db/20261020_chrome_route_expect.sql via the Supabase connector (project eepjhpyziczrxvirczio), read back
`select id, sched, grace_minutes from public.press_agent_expect where id in ('chrome-preflight','amazon-memos','card-scout-weekly-store-check');`
→ chrome-preflight daily 01:10 grace 180 · amazon-memos weekly dow 1 01:20 · card-scout weekly dow 3 01:35. Deploy agent-watch from the
merge SHA, verify_jwt false (council docs/evidence/chrome-keeper-staged-deploy.md — connector or the Council deployer: council is not
push-attached here, so prefer the connector; if it must go through the deployer, STAGE it). Ship proof: ezbr_sha256 before → after
CHANGED, then the dry tick `{"dry":true}` with the header secret answers 200 and notifies nothing.
Done-criteria: tenants-check GREEN (no T2/T3/T4 FAIL from missing repos); unit + playwright green; expect rows read back as above;
agent-watch hash changed + dry tick 200.

RETURN POINTS: arc-complete, or genuinely blocked. Errors are fixed, re-run, and re-validated inside
the order — nothing else returns to Mark.
