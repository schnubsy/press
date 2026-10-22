# D1 merge-gate review — PR #56 (arc/vantage-app-lab-tour-fonts)

Reviewer: independent D1 (not the author) · 2026-10-22 · PR head 81aee63, base origin/main 96ad977 (merge-base == main tip)

## Checks

1. **Scope** — 🟢 `git diff origin/main...HEAD` touches only `app-lab/vantage/**` (54 paths) plus control files
   (CLAUDE.md, HANDOFF.md, docs/history.md, docs/lessons.md, docs/evidence/vantage-app-lab-tour-fonts*). pages.json,
   spaces.json, index.html, app-lab.html, app-lab/frame.html, app-lab/prototypes.json, .github and .claude are untouched.
   ARC.md is empty on HEAD (0 bytes; added in 717b873, truncated in 81aee63, so the net diff against main is zero).
2. **References** — 🟢 `app-lab/vantage/index.html` points at `index-BsNeUenB.js` + `index-ieoaEdJQ.css`, and both exist.
   I collected every hashed asset name referenced from index.html, all JS chunks and all CSS (including the font `url()`s):
   50 names. All 50 exist in `assets/`, and `assets/` holds no unreferenced file (50 files). Nothing in the tree outside
   docs/ references the 5 deleted or renamed hashes (index-PzQikWRp, index-B5UBch43, Whiteboard-DG6NJ5y3,
   NotesEditor-6PCSNPyu, TagPopover-CXe-L0P3). The only other `url()` is an inline data: SVG.
3. **Secrets** — 🟢 The only key in the shipped assets is `sb_publishable_…` (the Supabase publishable key, which is
   acceptable). There are no `sb_secret_`, JWT, `service_role`, GitHub, AWS or `sk-` tokens. The word `service_role`
   appears only in the evidence .md, as prose saying that none was found.
4. **Control files** — 🟢 Merge state reads exactly `PR pending (branch arc/vantage-app-lab-tour-fonts)` in CLAUDE.md:36
   and HANDOFF.md:13. The CLAUDE.md stage block, the HANDOFF "Shipped / Exact next steps" section, the history entry and the
   new lesson all match each other and the tree.
5. **Evidence vs tree** — 🟢 I verified these independently:
   - vantage clone HEAD = 76da0c2.
   - The staged patch (54 `diff --git`) applies cleanly to a 96ad977 worktree, and the resulting `app-lab/` tree has
     **zero diff** against the PR HEAD's `app-lab/`. That is byte-identical, as claimed.
   - The bundle contains "Take the tour" once, and "Stroke smoothing" is only in `Whiteboard-C4E02ABj.js`.
   - In the gauntlet log: unit 152/0; Playwright 116 passed + 1 skip; tenants-check 43/25/27. The 25 FAILs are exactly
     T2/T3/T4 × 8 private tenant repos + T8 (council not cloned). Every App Lab row (T1, T2, T3 gate 532e6ae3, T4, T9) and
     optimo's T1 parent row PASS.

## Findings

- 🟡 **The iPhone WebKit gate did not run.** WebKit install was blocked (egress), so Playwright ran Chromium only and
  ui-audit is PARTIAL. The PR says so openly, and HANDOFF step 0 asks for a re-run with WebKit. This does not block merge
  for a byte-identical rebuild of a patch already validated in vantage, but the Safari-equivalent proof is still owed.
- 🟢 **The change counts are inconsistent.** The evidence, CLAUDE.md and HANDOFF all say "54 paths (50 A · 3 D · 1 M)",
  which adds up to 54 but mixes two git counting modes. With rename detection git reports 48 A · 2 R · 3 D · 1 M (54).
  Without it git reports 50 A · 5 D · 1 M (56). This is wording only; the file list in the evidence is correct.
- 🟢 **The Playwright count fell from 150 (PR #55) to 116.** This is explained by the missing WebKit project, not by lost
  tests.
- 🟢 **The stale hash names in vantage's staged .md are documented properly.** The evidence notes them, a lesson was
  promoted, and the patch is the source of truth.

Verdict: no 🔴
