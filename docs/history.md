# press — arc history

Dated milestones, newest first.

---

## 2026-09-21 — arc/perth-runway (The Runway published)

Published `perth.html` — "The Runway", a public family board for Brandon's move to Perth (arriving
14 Jan 2027). A page, not an app: one self-contained file on the `press_tasks` state lane, `page='perth'`.
Opened by the Council (Ear gut-check → Eye lite → Forge), orchestrated in Cowork, slices run in Claude
Code. **S1 — seed:** 99 tasks + one `__meta__` row (10 categories, 2 people, `depart=2027-01-14`) POSTed
to PostgREST (upsert on `page,item_id`, batches of 25) after deleting existing `page='perth'` rows;
round-trip verified 100 rows with a field-for-field sample match on title/status/category/week/extras.
**S2/S3:** `pages.json` gained `"perth.html": {"title":"Perth · The Runway"}` (spaces.json untouched —
public for now, per Mark's decision; task titles carry no personal identifiers); `docs/favicons.md`
registered the "pin on a horizon" glyph (`#22312F` ground, `#6B7F6A → #D8C6A3` + `#E08B4E`). **S4 —
publish (Lane A):** input blob `379e3d1923ec57100016eae6a0e0f8feea54d47c` hash-verified, committed
`99a7c87`, pushed to `main`. **S5 — verified live:** raw blob SHA matched, both axes render (Runway 24
week columns incl. the "Departure week" 11–17 Jan; Categories 10 lanes), 99 cards load from Supabase,
people strip renders, sync pill reaches "synced", Marquee portal lists the NEW card, no mobile h-scroll.
Decisions (do not re-litigate): Brandon is an Australian citizen — no visa branch, the passport +
citizenship-by-descent chain is the critical path; open RLS on medical/school content mitigated by the
public/no-identifier discipline + JSON export, revisited at family-wing migration.

## 2026-09-19 — align-retirement follow-ups (keyring pruned; public standalone retired)

Post-close housekeeping. **Keyring residue pruned:** the passkey-only `data_key`/`v` that
`protectTool()` had sealed into the vault's `retirement.html` entry was removed via a **click-driven**
`updateKeyring` re-seal — a bare console call hangs because WebAuthn `get()` needs user activation —
leaving every app entry shape-identical: `fsa`/`giving`/`retirement` → `{ pass, sync_id }`,
`card-scout` → `{ sync_id }` (verified live after a reload). **Public standalone retired:**
`schnubsy.github.io/retirement-projection` was unpublished (Pages source → None, verified 404); the
repo is intact + reversible, and `retirement/tools/release.js` now marks that deployment RETIRED so a
future arc won't resurrect it — `press/retirement.html` is retirement's only live target. Press change
this follow-up: `docs/lessons.md` + control files only.

## 2026-09-19 — arc/align-retirement CLOSED (revert passkey-only; republish retirement gated)

Reverted the passkey-only/`data_key` wing experiment and republished retirement as a normal gated
cloud tool. `index.html` restored **byte-identical to `f054714`** (retirement back in `CONNECT_TOOLS`
with the cloud `TOOL_CFG` shape; `LOCAL_TOOLS` + `protectStatus`/`protectTool`/`renderProtect`/
`wireProtect` + the `.tw-protect`/`.tw-ptool` CSS removed), `test/protect.spec.mjs` deleted,
`test/marquee.spec.mjs` reverted. **Kept only** `src/gate.testkit.mjs`'s standard-ArrayBuffer-PRF-at-
create shim — a real create-time PRF path (YubiKey / iCloud Keychain) that neither the 1Password shim
nor the virtual authenticator exercised, independent of the abandoned design. Merged `--no-ff`
(`a1d4eba`). **`retirement.html` republished** from `retirement/tools/release.js` (`9ae3424`): the
gated build carrying fsa's `PressGate` page lock over retirement's existing cloud sync — enforced on
`PressVault.everEnrolled()` (press + the standalone share one github.io origin), a SCREEN LOCK not
encryption. Publish is fail-closed on CHECK A (gate present) + a vendored-gate byte-compare vs
`src/gate.js`. **Premise correction recorded:** press's `inline:check` (`tools/inline-vault.mjs`) only
syncs `vault.js` within press — it never guarded fsa's (or any sibling's) vendored gate; fsa's copy had
drifted. Gauntlet green (31/31 unit, `inline:check` clean, 25/25 smoke); pushed `1d9ce9e..9ae3424`;
verified live (public path open, enrolled path gated on direct nav; fsa/giving/card-scout untouched).

## 2026-09-19 — arc/private-wing-spare-keys-collapse CLOSED (drawer collapse + Card Scout)

The private wing's "Connect your tools" drawer was reworked. CONNECTED tools now render as a quiet
line — app name + a Connected dot + a real `Reconnect` button (`aria-expanded`) — with their
sync-id/passphrase fields ABSENT from the DOM until Reconnect is pressed (it expands the row in place
and focuses the first field); collapsing removes the fields again, clearing anything typed.
NOT-connected tools keep the full form, expanded. **Card Scout** — the one personal app with no
spare-keys row, so losing its sync key this morning forced a full passkey unlock — joined the drawer as
**sync-id-only**: no passphrase input, and no `pass` key in its keyring entry. Its verification probes
`press_deals` with the entered value as the `x-plan-id` header (`page=eq.card-scout`, minimal select,
limit 1); a 200 with ≥1 row = verified, a 200 with ZERO rows = WRONG key (RLS returns empty rather than
erroring — the exact silent-failure that emptied the feed), surfaced as "That sync id doesn't open Card
Scout's deals", never a raw status code. The verdict logic (`dealsVerdict` / `verifyCardScout`) lives
in `src/vault.js` (single source of truth, re-inlined into index.html + gate.js via
`tools/inline-vault.mjs`) so it is unit-tested, including the 200-with-zero-rows = FAILURE case.
Nothing on page load touches WebAuthn or `press_vault`. Gate: 31 unit + 25 smoke (connect flow on
desktop + iPhone 15, incl. collapse/reconnect, sync-only Card Scout, wrong-key rejection) +
`inline:check` — all green. PR #9 → `main` (merge `f054714`, index.html blob `efcbdb42`),
live-verified 200 with the new markers present.

---

## 2026-09-19 — arc/two-space-marquee CLOSED (+ two passkey hotfixes + press_deals cleanup)

The two-space marquee arc is complete. The private wing (public space + a personal wing gated by a
WebAuthn-PRF passkey, `press_vault`, with `spaces.json` driving the split and a fail-closed publish
gate in each app's `tools/release.js`) shipped earlier this arc; it then took two hotfixes to make
1Password enrolment actually work. **Hotfix 1** — 1Password's shim returns the PRF output as a
base64url STRING, not an ArrayBuffer, so `asBytes` threw `expected bytes`; fixed by decoding base64url
(PR #4, merge `b359581`). **Hotfix 2** (regression) — at credential-create 1Password returns an
unusable/enabled-only PRF, and `prfResult` called `asBytes` unguarded, so the throw escaped and skipped
enrol's `prfViaGet` assertion fallback; fixed by making `prfResult` total (returns null for any
unreadable shape) so enrol falls through to the `get()` (PR #6, merge `9f3f792`). Both live-verified
(served `index.html` blob == GitHub main blob == local blob; markers present; HTTP 200). Mark then
enrolled successfully — the wing unlocks and Card Scout renders deals through the vault. With the
precondition met, the deferred **`press_deals` cleanup** ran (migration
`20260918_press_deals_gate_cleanup`, Supabase version `20260919043403`): dropped the open
`_anon_all`/`_auth_all` policies, revoked anon+authenticated DELETE, `sync_id SET NOT NULL` (DEFAULT
kept). Negative probes captured (`docs/evidence/two-space-slice-4-deals-rls.txt`): no/wrong header ⇒ 0
rows + insert rejected; matching header ⇒ own rows only (15/15, 1 distinct sync_id); anon DELETE ⇒ 401;
not enumerable. `get_advisors(security)` shows no new lint. The 🔴 open-policy finding is CLOSED.
Standing rule set this arc: an outward-facing publish at the end of a green arc/hotfix needs no
separate merge approval. Lesson promoted: a probe must return null, not throw.

---

## 2026-09-14 — control-file contract v2 seeded

Branch `arc/control-files-v2`. Added CLAUDE.md, HANDOFF.md, ARC.md, docs/spec.md,
docs/history.md, docs/lessons.md, docs/evidence/.gitkeep. No migration needed (no
ORCHESTRATION.md / STATUS.html / CLAUDE-archive.md existed at root).

---

## 2026-09-14 — agent-health.html v4.0.0 shipped

agent-health.html grouped-by-app view live. Reads Supabase all-apps views at runtime
(client-side JS). Evidence: docs/evidence/agent-health-desktop.png,
docs/evidence/agent-health-mobile.png, docs/evidence/v4-slice-4-agent-health.txt.

---

## 2026-09-12 — council-guide.html published

council-guide.html added to marquee.

---

## 2026-07-17 — press marquee established

Initial set of pages published: kayley.html, eagle-path.html. README seeded.
