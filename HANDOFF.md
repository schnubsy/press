# press — HANDOFF

_Last updated: 2026-09-19 — arc/private-wing-spare-keys-collapse CLOSED_

## Standing rule — publish auto-close (do NOT re-litigate)

An outward-facing publish at the end of a **green arc or hotfix** does NOT need a separate merge
approval from Mark. When the gauntlet is green, complete the publish (merge to `main`, which is what
GitHub Pages serves) as part of closing out — do not stop to ask. Set by Mark 2026-09-18.
(Auto-merge is still never enabled pre-emptively; this is only about merging a finished, green change.)

## Current state

**arc/private-wing-spare-keys-collapse is COMPLETE.** The private wing's "Connect your tools" drawer
collapses CONNECTED apps to a quiet line + a real Reconnect button (fields absent from the DOM until
expanded, cleared on collapse); NOT-connected apps keep the full form. Card Scout is now in the drawer
as sync-id-only, verified against `press_deals`. Shipped as PR #9 → `main` (merge `f054714`),
hash-verified and live-verified. No open arc items.

## Shipped this arc (close)

- **Drawer collapse:** connected rows render as a quiet line (name + Connected dot + a real
  `Reconnect` `<button aria-expanded>`); fields are injected only on Reconnect (which focuses the first
  field) and removed on collapse (clears typed values). Not-connected rows keep the full form, expanded.
  44px tap targets; the revealed fields are a labelled region.
- **Card Scout added (sync-id-only):** no passphrase input, no `pass` key in its keyring entry. Verified
  by probing `press_deals` (`x-plan-id`, `page=eq.card-scout`, minimal select, limit 1). 200 + ≥1 row =
  verified; **200 + ZERO rows = WRONG key** (the silent-empty RLS trap), message "That sync id doesn't
  open Card Scout's deals" — never a raw status code. Verdict logic `dealsVerdict` / `verifyCardScout`
  in `src/vault.js`, re-inlined into index.html + gate.js via `tools/inline-vault.mjs`.
- **Gate:** 31 unit (incl. 200-with-zero-rows = FAILURE) + 25 smoke (connect flow on desktop + iPhone
  15) + `inline:check` — all green. index.html blob `efcbdb42` == GitHub `main` == live URL 200 with the
  new markers present. Nothing on page load touches WebAuthn or `press_vault`.

## Open / blockers

None from this arc. Pre-existing, non-arc security-advisor lints remain on **unrelated** objects:
`rls_enabled_no_policy` on `press_capture_seen`/`press_capture_state`, and `security_definer_view` on
the four public `press_agent_*` views. Address under agent-health work if ever wanted.

## Exact next steps

No arc in flight. Next work starts a fresh arc via `/council:kickoff`. **Heads-up:** a concurrent
`arc/passkey-only` Slice 1 (commit `b155741`, "Protect your local tools") is checked out in the MAIN
checkout `/Users/mark/Documents/VSCode/press` and is NOT yet on `origin/main` — that is another
session's in-flight work; leave it, do not clobber it. The local `main` ref was fast-forwarded to
`origin/main` (`f054714`) without switching that checkout's branch.

## Mark's manual steps

- **Env note (this session):** git WRITE commands (add/commit/push) were denied to the agent, so Mark
  ran the code commit (`716c69a`) + push by hand; PR #9 create/merge went through the GitHub API. This
  handoff's control-file commit likely needs the same: on branch
  `claude/private-wing-spare-keys-collapse-d1c4c6` —
  `git add CLAUDE.md HANDOFF.md docs/history.md docs/lessons.md && git commit -m "handoff: close arc/private-wing-spare-keys-collapse"`
  then push (branch already tracks origin). It is a post-merge bookkeeping commit; land it on `main`
  only if you want the control files updated there.
- Optional (unchanged): enrol a second passkey (Private Wing → Devices → Add this device); revoke a
  device via Private Wing → Devices → Remove.
