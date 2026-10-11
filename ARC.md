## 2026-09-26 — snag parity + page-diff: see council arc/snag

→ optimo ARC.md 2026-09-27 arc 2, slice 6 (optimo.html family-wing launcher; published at optimo close via optimo/tools/release.js)

→ cardsharp ARC.md 2026-09-28 Arc 1, slice 5 (cardsharp.html private-wing tenant: spaces/tenants/pages, KICKERS/ICONS, TOOL_CFG + Connect; published at cardsharp close via cardsharp/tools/release.js)

→ cardsharp ARC.md 2026-10-06 Arc 10, slice 11 (private + family wing drag reorder; ships at cardsharp's Arc 10 close via a press PR merged before cardsharp tools/release.js)

→ optimo ARC.md 2026-10-10 migrate-home, S2 (optimo app served at /press/optimo/ — press/optimo/ mirrored by optimo/tools/release.js; published at optimo close 0264cf6 from merge 83cdcc1)

## 2026-10-10 — migrate-home (press → GitHub home)

SLICES: 3 · SINGLE-SLICE JUSTIFICATION: none
Work order — press → GitHub home (council migrate.md, Wave 1)
HOME: github:schnubsy/press · BRANCH: arc/migrate-home
/goal close-out manifest all DONE/N/A, gauntlet (or named PARTIAL) + sentry green, GREEN REPORT line posted
Context: council v4.12.1 migrate instrument (clone https://github.com/schnubsy/council to ../council, read-only: skills/hand/references/migrate.md, tools/secrets-map.mjs). Proven pattern 2026-10-10 on rebate-radar PR #3, retirement PR #10, optimo PR #113, fdd-agent PR #11. Cloud egress is allowlisted — a probe needing an external host is BLOCKED (named), never routed around. Remote branch deletes are refused by the proxy (auto-delete-on-merge is ON for this repo). A code change is never Mark's manual step. ONE WRITER ON PRESS: this arc does NOT write to schnubsy/press (the press migration runs in parallel) — if a press publish would be needed, record it as the next arc instead.
S1 — migrate.md §0 gate re-check in this clone; `Home: github:schnubsy/press` as Current stage line 1 (Merge state line 2); path sweep (`grep -rn "Documents/code\|/Users/mark" .` → repo-relative or GitHub wording; Mac-only steps keep Mac wording and are named as such); docs/secrets-map.md (names only, never values; say which are public-by-design client keys); .claude/skills/verify/SKILL.md that runs the repo gauntlet; cloud gauntlet run — GREEN, or PARTIAL with every BLOCKED probe named.
Status: done ea2fab2
S2 — press-SPECIFIC (below).
S3 — /code-review adversarial slice (independent sub-agent), fix real findings; then the close per arc.md rule 4: PR → merge → reconcile origin/main == merge SHA → post-merge stage stamp → close-out manifest. If the merge is refused as unreviewed, leave the PR open, comment "awaiting chat review", and finish everything else. GREEN pressRT line per migrate.md (NAS zip = Mark's Mac step, BLOCKED). Post the full report as the PR's final comment; LAST line `Chat: run verify`.
S2 — press is the PUBLIC marquee publishing target: visibility stays PUBLIC (never change it). Its main is written by many app arcs — treat it as shared: make only control-file + docs changes in this arc, rebase on origin/main right before the PR. Also absorb the flow decommission: compare flow's kayley.html (https://github.com/schnubsy/flow, file kayley.html — clone read-only) with press kayley.html; if flow's is newer/different and correct, bring it into press per the press publish rules (pages.json untouched unless a new page); record the diff summary in docs/evidence. Update press CLAUDE.md "Served pages" to include optimo (family wing, /press/optimo/ app dir + optimo.html card) and retirement current state. ARC.md (580 B) has existing content — keep/process per control-files rules.
