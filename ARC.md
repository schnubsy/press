## 2026-11-02 — arc/snag-train-2026-11 (snag train 2026-11, SHADOW)

Work order — snag train 2026-11: the six open `page:index` snags on the marquee

Repo: schnubsy/press
HOME: github:schnubsy/press
DEPLOYS: none (press-native index.html; GitHub Pages serves main after Mark's merge — shadow mode stops at the open PR)
LANE: Standard
BRANCH: arc/snag-train-2026-11
PUBLISH TARGETS: none
DATA: none (UI copy/layout + one client-side passkey button; no learning path)
SLICES: 8 · SINGLE-SLICE JUSTIFICATION: none
/goal close-out manifest all DONE/N/A/STAGED, gauntlet + sentry green, verify evidence committed

STANDING RULES (verbatim in every order)
(1) Batch every question up front, then run every slice back-to-back. Return only at arc-complete or a real blocker.
(2) Branch arc/<slug>. `git add` by name only; never `rm -rf` (CLAUDE.md → "Project rules").
(3) PER SLICE: extend the tests → build/lint clean → SCOPED checks only (testing.md → "Test budget") → done-proof
    citing that run in docs/evidence/<arc>-slice-<N>-<name>.<ext> → commit `feat: slice <N> — <summary>` → tick the slice
    `Status: done <sha>` in ARC.md and commit (tick + commit only — handoff.md STEP 4).
(4) ARC-COMPLETE CLOSE: FULL CLOSE FIRST, so it ships in the PR: /council:handoff (handoff.md) → the gates LAST,
    on the final head (gauntlet + sentry at the lane's stages) → push → PR → the D1 gate ("Merge policy (D1)") →
    STOP with the PR open. Post-merge steps belong to whoever runs after the merge (the chat at verify).
    A RED gate, or a 🔴 that cannot be fixed in-arc: stop at the last green slice, push, open the PR as DRAFT, report.
(5) Publishing and deploying are part of the close, strictly after the merge; a Builder STAGES them (it stops before
    the merge). Every release names its rollback path before it ships (snag.md → "Rollback").
(6) Never claim "deployed" / "published" / "live" from an exit code, a success line or a version number — ship proof.

ORIENT FIRST
Read CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md. Gate-enabling commit f462844 (gauntlet reads LANE + VIEWS; iPhone
project states browserName webkit) landed before this order so the test-budget hook lets the specs run.

=== SLICE 1 — one kicker convention on the wing cards (#28) ===
Scope: layout change (copy). index.html `familyCardHTML` / `secureCardHTML`. The Issue's "THE FAMILY WING" vs "PERSONAL"
split was already retired by marquee-polish S1 (2026-09-22): both kickers are now lowercase taglines ("a safe space" /
"behind the passkey") and the h3 names the wing. Mark's family kicker text is NOT changed.
Done-criteria: a spec pins ONE convention — each wing kicker is a tagline that does not repeat the wing name, and each
h3 is "The <X> Wing"; screenshot at 390. Fixes #28.
Status: done b0d2c5f

=== SLICE 2 — mobile wing cards breathing room (#29) ===
Scope: layout change. index.html CSS, ≤480px only.
Done-criteria: at 390px the gap from each wing card's h3 bottom to its lockline top is ≥ 14px (was ~0 on the private
card); desktop squares unchanged. Spec + screenshot. Fixes #29.
Status: done a41fe02

=== SLICE 3 — the FSA glyph reads as medical (#30) ===
Scope: layout change (icon). The FSA card already uses the `stethoscope` glyph (LABELS rework, 2026-10-12) — not a plus.
Done-criteria: a spec pins `fsa.html` → icon `stethoscope` and asserts the rendered FSA card svg is not a plus/cross;
screenshot. Fixes #30.
Status: done 581ecff

=== SLICE 4 — the Thrift Shop (Card Scout) connect row reads as deliberate (#31) ===
Scope: layout change (copy). index.html `toolFieldsHTML` for kind:'deals'.
Done-criteria: the deals row shows a one-line hint ("Sync id only — Thrift Shop has no passphrase and nothing to
download.") under its field; the app rows do not; spec + screenshot. Fixes #31.
Status: done 394f29a

=== SLICE 5 — trim the gap under collapsed Connect your tools (#32) ===
Scope: layout change. index.html CSS + `renderConnect` / toggle (an `is-collapsed` class).
Done-criteria: collapsed, the space from the Manage button's bottom to the page bottom is ≤ 32px at 390 and 1280 (was
~56px+), expanded unchanged; spec + screenshot. Fixes #32.
Status: open

=== SLICE 6 — recovery kit Unlock button when Cardsharp is redacted (#34) ===
Scope: layout change + behaviour. index.html `recoveryKitHTML` / `showRecoveryKit`.
Done-criteria: with a redacted MEMORY_ONLY entry the kit shows "Unlock with passkey to include Cardsharp" (not printed);
clicking runs `PressVault.unlock()` in this tab and re-renders the kit with Cardsharp's sync ID + passphrase; a failed
unlock shows the error and keeps the button; no button when nothing is redacted. Spec. Fixes #34.
Status: open

=== SLICE 7 — design review + performance (standard UI slices) ===
Done-criteria: before/after screenshots of every changed surface at 390 + 1280 reviewed against the Issues
(docs/evidence/snag-train-2026-11-slice-7-design-review.md); performance = index.html byte delta + lobby/wing load
timing (no Lighthouse in an arc).
Status: open

=== SLICE 8 — page-diff gate (train) ===
Done-criteria: `node tools/page-diff.mjs index.html https://schnubsy.github.io/press/index.html --evidence docs/evidence/`
diff % recorded per viewport; every slice is a layout change, so > 2 % is expected and not 🔴.
Status: open

RETURN POINTS: arc-complete, or genuinely blocked.
