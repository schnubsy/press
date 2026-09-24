# press — arc history

Dated milestones, newest first.

---

## 2026-09-24 — arc/wings-polish (private + family wing polish; opt-out grants)

Five slices polishing both wings. **(1) Private-wing weekly re-lock** — vault TTL 8h→**7 days, fixed from
unlock** (no slide-on-use). Bumped in the press-owned copies only (Mark's Option 2): `src/vault.js` source →
inlined into `index.html` + `src/gate.js`; the four published tenant pages keep 8h until their own next
release. `test/ttl-honored.spec.mjs` proves each published tenant page HONOURS a portal-minted 7-day session
(reads `expiresAt`, never recomputes to 8h). **(2) Mobile wing cards** — headings render one word per line at
≤480px via explicit per-word `<span>` blocks (desktop inline); both locklines are plain tool counts.
**(3) perth title** → "The Runway — Perth". **(4) Family Access opt-out grants** — `access.html` redesigned
to per-person cards with a switch per family tool (ON by default) + Deactivate; removed the "which tools are
gated" section; fixed the sign-in loop (saved the `{session,status,code}` wrapper instead of `.session`) and
accept 6–10 digit codes. `db/20260924_press_access_optout.sql` redefines `press_access_has` to opt-out (active
person AND `press_access_apps.gated` AND no `active=false` grant) and ensures remit/perth gated=true; applied +
live-verified by Cowork. **(5) Recovery kit** — the unlocked private wing prints a paper kit of every keyring
entry (app, sync ID, passphrase) + restore steps; the paper kit is the recovery path, no email reset by design.

Gauntlet: **65 node + 56 Playwright, 0 skipped; inline:check green; tenants-check 28 pass / 0 fail.** Gate
file (7d) re-vendored into all four tenant source repos under the clean/main/synced guard — **fsa-claims #14,
retirement #3, giving-tracker #10** (ff-pulled first), **card-scout #15** (its uncommitted ARC.md seed left
untouched; only `src/vendor/press-gate.js` staged; ARC.md hash `e00a419` unchanged before/after). Press
**PR #16 merged** to main and published. The four PUBLISHED tenant pages still inline 8h until each app's own
next release. Branch `claude/arc-wings-polish-0e3d69`.

---

## 2026-09-22 — arc/marquee-tenancy (the marquee as a platform with tenants)

Made the marquee↔tenant couplings explicit and auditable. **`tenants.json`** (repo-owned, like
`spaces.json`) keys every `pages.json` page to `repo/tier/gate/vendored/release/build/deterministic`.
**`docs/spec.md` → Tenants** is the single canonical contract (tenant owes / marquee owes / release-script
contract / the two RULEs / hotfix rule); council `press.md` (31→24 lines, "Open RLS" removed) and MANUAL
§12.2 shrank to pointers. **`tools/tenants-check.mjs`** audits every coupling — T1 registry, T2 source, T3
vendored-gate byte-identity, T4 release contract, T5 rebuild-vs-live, T6 family-grants (emitted SQL) — 15
node:test cases, `npm run tenants:check`. remit + retirement `release.js` (and remit `publish-checks.js`)
now honour `PRESS_DIR`; retirement auto-copies into press, sha256-verified. Council **4.6.0**: audit DETECT
group 7 "Marquee tenants" + an arc "Tenant-change arcs" order template; MANUAL §1.1 three-tier table.
**Concurrency:** mid-arc, remit's `arc/scratchpad-rework` closed & shipped to press main (a989a4d) — a
magic-link family-gate (now canonical `9eba177d`) + new `remit.html` (`2c4ac65e`); the branch was rebased
onto it, which resolved a transient "gate drift" that was really a stale base. Gauntlet green: 63 node + 40
Playwright, 0 skipped; `tenants-check --rebuild` 30 pass 0 fail. T6 grants read live: remit/perth 1 active
each (🟢). `council-guide.html` republished v4.2.0→v4.6.0 (live 200, blob `e9273078`). Closed one PR/repo:
press#14 (`9cf7e1c`), council#3 (`a67d14f`), remit#3 (`42c683c`), retirement#2 (`a47b277`), env#2 (`661f6ee`).

## 2026-09-22 — arc/marquee-polish (corrective UI batch + remit source repair)

A five-slice corrective pass on the marquee UI batch plus a cross-repo drift fix. **S1 copy:** inverted the
wing labels so the BIG text is the NAME and the small line the tagline, in all four places (family card+view,
private card+view): family "a safe space"/"The Family Wing", private "behind the passkey"/"The Private Wing".
Retired "A safer space for the fam" from live source + tests (append-only records keep it as history), and
lowercased the private eyebrow. Updated the card-h3 test pins (marquee.spec:109 → "The Private Wing";
family-lobby:72 → "The Family Wing" + kicker "a safe space"). **S2 icons:** perth's Australia (illegible at
26px) → a Feather paper-plane; remit → a banknote glyph via a new `[/remit/,'Remit']` KICKERS rule placed
FIRST (first-match wins, can't fall to Money/Page), distinct from halvsies' $. **S3 layout:** the two wing
squares were inset — aspect-ratio:1/1 + max-height:230 shrank each square's width below its 1fr track and
left-aligned it, so the private square's right edge sat 17px inside the card edge. Removed max-height → squares
fill their tracks; family LEFT and private RIGHT edges now flush (measured dL=dR=0.00). Added 2 edge-alignment
acceptance tests (desktop+mobile, ≤1px). **S4 remit source drift:** remit main still vendored the
pre-`requireSession` family-gate, so a rebuild would regress the Phase-1 gate. Merged the parked back-link
branch, re-vendored the canonical family-gate (`b5ff2b65`), added the back-link to the dynamic head
(`src/ui/month.js`) and aligned the .tw-back CSS — `node build.js` is now BYTE-IDENTICAL to the live
`press/remit.html` (`c866f3f4`). remit NOT republished (nothing shipped). Also landed 3 uncommitted council
inbox files (remit ARC.md+HANDOFF.md, giving-tracker ARC.md) rather than discarding them. **S5 verify:** Eye
LITE (changed elements, P0-only) found one P0 — a mobile private card whose 3-line kicker overflowed the
fixed square and clipped the lockline; fixed by dropping the square aspect-ratio ≤480px so phone cards grow
to content. Lighthouse landing 89/96/96. `src/gate.js` untouched throughout (`6080e25d`). Gauntlet green
(43 node + 37 Playwright, 0 skipped). Closed via one PR per repo (press, remit) with per-page live verify.

## 2026-09-22 — arc/marquee Phases 3–5 (UI batch)

The marquee's visual/UX pass, run as one five-slice arc. **Slice 1 (layout+icons):** the two wing cards
(`.tw-secure`, `.tw-family`) now render as big side-by-side squares — FAMILY left, PRIVATE right — via a new
`.tw-wings` grid (falls back to the private card full-width when there is no family space, so the pre-Family
paint and the marquee/family-lobby smoke stay byte-stable). Real Feather-grade glyphs added to the
KICKERS+ICONS registry (NOT `pages.json` — it is fetched+stubbed and would go untested): fsa=medical cross,
giving=heart, retirement=trending-up, card-scout=credit-card, the Family door=people (was an envelope), and
perth=a hand-drawn Australia (Feather has none). **Slice 2 (copy):** a true swap between the landing card and
the wing view — private card hero "Behind the passkey." while the wing-view title is "The Private Wing" (all
three tw-title states); family card hero "A safer space for the fam" with a "The Family Wing" kicker. The
session line became an absolute wall clock ("Unlocked · N tools · until 7:41 pm", new `clockUntil()`). The
family wing view still carried "Signed in with a code." at the arc base (contra the Phase-1 note) — removed.
**Slice 3 (nav+connect):** a persistent "← Private/Family Wing" back chip added to each tool's app chrome
(fsa/giving/retirement from their own source repos; remit+perth edited directly in press — remit's source
still carries a pre-`requireSession` family-gate, so rebuilding it would regress Phase 1); and the "Connect
your tools" section is now collapsible (collapses once `CONNECT_TOOLS.every(toolConnected)`, reusing the
Reconnect drawer pattern). **Slice 4 (Eye):** a LITE design review returned 3 P0s — wing-view title
duplication, mobile kicker/icon collision, and perth's Australia illegible at 26px — all actioned; the rest
went to `BACKLOG.md`. **Slice 5 (perf):** Lighthouse on the landing = 89 performance / 96 accessibility /
96 best-practices, all above budget. `src/gate.js` untouched throughout (`6080e25d…`). Gauntlet green (43
node + 35 Playwright, 0 skipped). Closed via one PR→merge per touched repo (press, fsa-claims,
giving-tracker, retirement) with per-page live verification on press.

## 2026-09-22 — arc/family-wing-gate Phase 1 (gate the family wing)

Turned the Family Wing from an open directory into a GATED door. `renderFamily()` (`index.html?view=family`)
now requires a live family session, mirroring the Private Wing's `paintPersonal()` shape: nothing behind
the door paints until sign-in. Added `FamilyGate.requireSession()` to `src/family-gate.js` — a session-only
entrance sign-in (email OTP, NO page grant; `renderSignIn` gained an `opts.sessionOnly` branch) — so ONE
sign-in at the door opens every family tool with no further prompt (each tenant page still gates its own
data by grant via `require(page)`, unchanged). Added a **Log out** control (clears `press:family:v1`,
returns to the gate) and removed the now-untrue "open a tool — it asks for a code" landing copy. Deep links
to `?view=family`/`#family` hit the gate — smoke tests added to `marquee.spec.mjs` + `family-lobby.spec.mjs`
(the latter's old open-directory test rewritten to the gated contract). **perth.html** joined the wing:
added to `spaces.json` family[] and gated with `FamilyGate.require('perth.html')` before boot; its
`press_tasks` read/write is UNCHANGED (RLS hardening deferred to Phase 2). `press_access` already carried
the `perth.html` app row + an active grant for Mark (seeded by Cowork, verified live). Shared gate
re-vendored byte-identical into index/remit/perth (sha1 `b5ff2b65…`, 26415 B); `access.html` tracks
`src/family-gate.js` by `<script src>`. `src/gate.js` untouched (`6080e25d…`). Published one page at a time —
`dbfc97a` (src+index), `84a4965` (remit), `cba9682` (spaces+perth) — each pushed to `main` and confirmed
live-200 + git-hash-verified; live family wing shows the gate with zero auth/REST calls and no tool leak.
Gauntlet green: 34 Playwright + 43 node, 0 skipped. Phases 2–4 (RLS, copy, admin) not started.

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
