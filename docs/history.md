# press — arc history

Dated milestones, newest first.

---

## 2026-10-22 — arc/thrift-shop-redesign-card-label (redesign card: own icon + test label)

The thrift-shop-redesign publishes added `thrift-shop-redesign.html` to pages.json + LABELS but left `test/card-labels.spec.mjs`
red on both projects (no WANT entry) and gave the card Thrift Shop's `drop-bag` glyph (the next "two cards share an icon" failure).
S1 added a Feather `layers` glyph to ICONS, pointed the redesign's LABELS entry at it, and added the WANT pair. Full gauntlet:
Playwright 150/0, ui-audit GREEN on WebKit; tenants-check fails only on the 9 out-of-scope tenant repos, byte-identical to main.

## 2026-10-22 — arc/vantage-app-lab-tour-fonts (Vantage App Lab release: whiteboard, colours, tour, fonts)

Chat verify of vantage PR #30 dispatched its STAGED press half here. S1 rebuilt the App Lab release from vantage main 76da0c2
with `tools/build-app-lab.mjs`: 54 paths under `app-lab/vantage/` (new bundle `index-BsNeUenB.js`, Whiteboard chunk, the
self-hosted board/marker fonts), byte-identical to vantage's staged patch; nothing outside the folder moved. Gauntlet green
on unit / inline / Playwright; WebKit + ui-audit PARTIAL (egress this run); tenants-check fails only on the out-of-scope tenant
repos and council (BLOCKED access), every App Lab row PASS.

---

## 2026-10-21 — arc/publish-vantage-onboarding-tour (Vantage App Lab training tour + catalog row)

Chat verify of vantage PR #29 (polish-onboarding-tour) dispatched its STAGED press half here. S1 rebuilt the App Lab release
with vantage `tools/build-app-lab.mjs` from merged main (web/ unchanged since 8f70424): `app-lab/vantage/index.html` plus five
hashed assets replaced — byte-identical to vantage's staged patch; app-lab.html / frame / prototypes.json / pages.json untouched.
S2 updated the RLS-gated `press_catalog` row through the Supabase connector. The order named council 76a3a6c, but council main
had moved on (094544a, rebate-radar) carrying the same Vantage change, so the row went straight to main's version (58a476c7,
101919 bytes) as one guarded replace()-hunk UPDATE — no destructive pop-up this time. Full gauntlet green except
tenants-check's out-of-scope tenant rows (BLOCKED scope, same on main).

---

## 2026-10-21 — arc/publish-thrift-shop-iphone-compact (Thrift Shop iPhone-compact publish)

thrift-shop PR #33 (iphone-compact, 95c72e1) merged and its card-scout v44 deploy verified; its press publish was STAGED
because that Builder could not run press's gauntlet. S1 rebuilt `thrift-shop.html` with thrift-shop `tools/release.js`
from its merged main (9fec8b0): only that file changed, blob d8818498 → 2403c3bb (== thrift-shop main). Gauntlet green on
every stage except tenants-check, whose 21 FAILs are the 7 tenant repos outside this session's scope (same on main) —
BLOCKED (scope); merge left to the chat's verify per D1.

---

## 2026-10-20 — arc/chrome-route-press (quiet-night agent-watch + Chrome route expect rows)

Council arc/chrome-keeper (PR #59, merge 940bf96) STAGED its press half; the chat's verify found the press full gauntlet
incomplete (tenants-check could not reach the tenant repos). S1 applied `council/docs/evidence/chrome-keeper-staged-press.patch`
verbatim: `watch-core.mjs` gains `chicagoMinutes` / `inQuietNight` / `nightPriority` (22:00–07:00 America/Chicago ⇒ push priority
−1, never louder demoted by day; DST-tested), `index.ts` applies it to the one push per tick (email untouched); migration
`db/20261020_chrome_route_expect.sql` registers `chrome-preflight` (The Council · browser-task · checkin · daily 01:10 · grace 180)
and moves amazon-memos to Mon 01:20 and card-scout-weekly-store-check to Wed 01:35. Full gauntlet with all eight tenant repos +
council cloned as siblings: unit 152/0, inline ✓, tenants-check 76 pass / 0 fail / 24 skip (by-design skips only), Playwright 150,
ui-audit GREEN on WebKit. Sentry: diff secrets scan 0 hits.

## 2026-10-19 — arc/amazon-memos-monitor (Agent Monitor: Amazon memos + night-window times)

Mark asked to schedule the press half of council arc/night-window-amazon-memos. S1 applied council's staged patch
(`docs/evidence/night-window-amazon-memos-staged-press.patch`, council main 7830c0d) verbatim: migration
`db/20261019_amazon_memos_expect.sql` inserts the `amazon-memos` check-in expectation (The Money, browser-task, weekly Mon
01:43, grace 24 h; idempotent ON CONFLICT DO NOTHING) — without it the task's `press_agent_checkin('amazon-memos', …)` raises
"unknown check-in agent" — and moves five existing check-in expectations to their night-window times so real runs are not
read as late. Dry-run on the live DB in a rolled-back block (next due 2026-10-26 06:43 UTC). Gauntlet: unit 151/0, inline ✓,
Playwright 150 ✓, ui-audit GREEN; tenants-check red only for sibling tenant repos absent in the cloud clone (identical without
the patch). Applied to Supabase after merge via the connector (non-destructive).

## 2026-10-14 — arc/tenants-check-siblings (tenants-check sibling-clone defaults)

Verify of fsa-claims PR #20 ("Unpin the Mac") found press S2 built + gauntlet-green but never pushed (press was outside that
Builder's session scope); the patch rode in on this branch (`docs/evidence/unpin-the-mac-slice-2-press.patch`). S1 applied it:
`tools/tenants-check.mjs` defaults `CODE_ROOT` to the parent of the press clone and `COUNCIL_DIR` to `../council` (env overrides
kept; no `homedir()/Documents` paths); header line says a Mac run without siblings sets the env; `scripts/gauntlet.sh` comment
updated; new defaults test. S2 (adversarial review, fresh subagent): test base realpath'd (macOS `/var` → `/private/var` would
fail it), defaults follow `--press`, the defaults test now asserts a positive T8 PASS. Gauntlet GREEN both slices (unit 144,
tenants-check 69/0/24 with every sibling cloned, Playwright 148, ui-audit GREEN). Residual: council-guide's `repoPath`
(`~/Documents/Claude/council-hub/council`) still SKIPs T2 in a cloud clone — left by the order.

## 2026-10-13 — arc/quiet-alerts (agent alerts only after a day down)

Mark: nothing running is SLA-critical — tell me when an agent has been down for a day and needs me, not when it is a
bit late. Before: 5 alerts in 2 days (push + email each), none needing action. Causes found: Card Scout's judge logs a
`skipped` run when there is nothing new to judge, which the monitor read as a missed 7am run; FSA receipt inlet was
never connected (permanently "late"); GitHub's hourly timer drifts; Steward watch (Mac-side) ran ~10 h late.
Changes: `watch-core.mjs` alerts once per down episode at 24h+ and sends one quiet "working again" note after such an
alert; watcher self-gap threshold 24 h; GH backup check every 6 h, fails only if agent-watch is stale > 24 h (the
"undeliverable alert" path moved into the watcher's own retry). Migration `db/20261013_agent_monitor_quiet_alerts.sql`:
`press_agent_watch_state.bad_since/down_alerted`, `press_agent_expect.idle_is_work` (card-scout on), view patched
from its live definition, `fsa-capture` switched off, notifier sched every 360. Edge Function `agent-watch` v7.
Gauntlet: unit 137/0, inline ✓, Playwright 130 ✓, ui-audit GREEN; tenants-check red only for sibling repos absent in
the cloud clone (same on untouched main).

---

## 2026-10-13 — arc/safari-ui (iPhone UI audit on WebKit)

Cloud Builder, three slices, dispatched from the council safari-ui roll-out. **S1** (`334d533`) — vendored council
`instruments/ui-audit/{ui-probe,run}.mjs` byte-identical (stamp `council-ui-audit@1.0.0`) + `test/ui-audit.config.mjs`
(hermetic: local server, faked GitHub/Fonts/Supabase, the passkey gate seeded past-lock through its localStorage hook).
WebKit installed in the cloud (cdn.playwright.dev); first run RED: 76 wrap · 420 touch · 170 font16. Gauntlet gained stage 0
(WebKit install) + stage 5 (ui-audit) and an `iphone-webkit` Playwright project; sealed-unlock's WebKit test had been silently
skipping in cloud mode (the runner handed it chromium's executablePath). **S2** (`3c734f2`) — every defect fixed: 44px tap
boxes with the pills redrawn by `::before`, clickable spans → buttons, 16px fields, one-line setup action, access switch
44×44; one named exception (`.row .line`). A first attempt edited `src/gate.js` + `src/family-gate.js` → tenants-check T3 RED
for 7 tenants, so the gate fixes became page-level overrides. **S3** (`f671ac7`) — code-review: bash 3.2 empty-array 🔴
fixed, desktop tests chromium-only, steward-denied state added (found + fixed an inline-link tap target). GREEN on WebKit,
200 surfaces.

---

## 2026-10-12 (evening) — hotfix PR #37 + Winston PR #38 (close-out)

**#37** Agent Monitor showed "can't check": anon lacked EXECUTE on the schedule helpers its public view calls (Postgres
checks function EXECUTE as the caller even inside a definer-owned view). Access Manager switches never saved: `rest()` let
per-call headers replace the admin auth headers (pre-existing; the spec mock now refuses writes without a Bearer JWT).
Labels "User Access Management" / "System Health". **#38 Winston** — Mark's RULE: every email Claude sends comes from
Winston (winston.marksclaude@gmail.com): Supabase Auth SMTP on press + elevate-ops, MAILER_* + COUNCIL_MAILER_* → the Winston
mailer, `press_winston_mail()` for scheduled-task reports. Auth email sync ran green (scoped token). Steward fixture row
deleted. NAS zip done by Mark. Council standard = council PR #29 (v4.14.1, Mac merge + bundle reload pending).

---

## 2026-10-12 — arc/steward-report (Steward report page)

Cloud Builder, three slices. **S1** (`155c873`) — council `20261012_press_steward_reports.sql` copied byte-identical into
`db/` and applied via the Supabase connector: RLS on, 0 policies, grants `service_role` only (anon/authenticated have no
SELECT); fixture row inserted and read back. **S2** (`910da08`) — `steward.html` (press-native, private wing): latest report
(headline lamp, Needs you · Fixed for you · Cost moves · ledger · All clear) plus a 12-week history strip (weekly dot, monthly ring),
390-first. Registered in spaces/pages/tenants.json, KICKERS/ICONS, favicon register, and the council snag registry (T8). The
page loads `src/gate.js` by relative path (as access.html does), guards on `card-scout.html` and POSTs that capability to the new
`steward-reports` Edge Function, which reads with the service role. **S3** (`02fff38`) — the adversarial review found a 🔴: the
first gate checked "a press_deals row with this sync_id exists", which anon can forge, because it may INSERT rows with any
sync_id. Fixed by `press_steward_capability_ok`, a service-role-only RPC that compares against the server-held column
default. Function v2 was redeployed (ezbr `6d542a81…`). Also fixed: calendar-week bucketing, JSON try/catch, XSS and
lock-after-unlock specs. Live proof ran from pg_net so the capability never left the DB: ungated / zeros / non-default → 401,
real → 200, anon REST and anon RPC → 42501. The fixture DELETE timed out on the connector's confirmation step (#94450), so the
row was moved out of the 84-day window instead (the page shows the empty state) and the delete went to Mark.
`.claude/settings.json` (D1 merge allow) was refused by the classifier. Evidence: `docs/evidence/steward-report-*`.

---

## 2026-10-12 — arc/marquee-wings-monitor (marquee wording · Family Wing requests · Agent Monitor rebuild)

From Mark's petition (one batched checkpoint: email automatic, Fix = admin-only, marquee owns naming, alerts push+email).
**S1** marquee owns card naming: one `LABELS` map in index.html (kicker/title/icon) wins over pages.json; Mark's 10 new
labels; filename lines removed; topical distinct icons; tenants-check **T9** fails a page with no label entry; spec RULE
for future apps. **S2** Family Wing: blocked screen gains **Request access** (`press_access_request` RPC → trigger →
`access-notify` push+email; switching on resolves it); access.html → "Family Wing Access Manager" with a Requests strip;
remit's data gate moved to opt-out (`remit_has_access()` → `press_access_has`); wing-level sign-in email template in
`docs/auth/` + `auth-email-sync` workflow (needs Mark's `SUPABASE_ACCESS_TOKEN`). **S3** remit PR #15 + optimo PR #114
re-vendor the gate. **S4** Agent Monitor rebuilt: health from REAL work (skipped ticks never count), 25-row inventory
(edge, pg_cron, cloud + Mac scheduled tasks, browser lane, notifier) with expected cadence → late detection; landing =
dots grouped by app, click to expand, switched-off collapsed; projection = MTD + 7-day avg × days left (CT); `agent-watch`
(pg_cron 15 min) alerts on change; GitHub Action = watcher-of-the-watcher; admin-only `agent-fix`; scheduled tasks
check in via `press_agent_checkin`. **S5** review: 0 🔴 / 4 🟡 fixed + Eye P0 (never-run = amber) fixed.
Audit finding recorded: the old notifier only watched `AGENT_APP=giving`, and `skipped` runs refreshed `last_ok_at`.

---

## 2026-10-11 — arc/migrate-home (press → GitHub home, PR #27)

First cloud Builder run on press (council v4.12.1 migrate instrument, Wave 1). **S1** §0 gate re-checked in a fresh clone:
clean; the one orphan branch `claude/perth-phase-2-security-c7a88b` held the `perth_rls_gate` migration mirror — applied live
since 2026-09-22 but never on main — so it was cherry-picked. `Home: github:schnubsy/press`; path sweep (Mac defaults in
tenants-check kept and named); `docs/secrets-map.md` (0 `.env` keys, 2 Actions secret names); new `scripts/gauntlet.sh`
(node --test · inline:check · tenants-check · Playwright) + `.claude/skills/verify/SKILL.md`; cloud mode (`PW_CHROMIUM`)
because Playwright 1.63 pins a Chromium the image lacks and there is no WebKit — 80/81 specs had failed at launch.
**S2** CLAUDE.md served pages (+cardsharp, +optimo and its `/press/optimo/` app dir, retirement live blob `77506d01` ==
a fresh `--public` rebuild); BACKLOG Eye items → Issues #28–#32; T6 grants live (optimo 1 · perth 1 · remit 2).
flow `kayley.html` compare BLOCKED (flow unreadable from the session). **S3** independent adversarial review: 0 defects,
5 nits fixed (Mac skips now RED; BSD-grep-safe); sentry GREEN. Visibility untouched (PUBLIC by rule).

Migrate report (2026-10-11): `press: origin/main 76c7b0c (merge PR #27; stamp 33aa45c); 0 unmerged; 0 worktrees; secrets-map 0 keys (+2 Actions secret names); cloud gauntlet GREEN; NAS zip BLOCKED (Mark)` — **not GREEN yet**: NAS zip owed (HANDOFF step 1); flow kayley compare BLOCKED (next press arc). Post-merge gauntlet on main: `docs/evidence/migrate-home-close-gauntlet.txt` GREEN.

---

## 2026-09-24 — T7 tool-cfg check (#17)

tenants-check gained **T7 `tool-cfg`**: every `spaces.json` personal page with a vault keyring entry must have a
`TOOL_CFG` entry in `index.html`, so it can't silently drop out of Connect your tools or the recovery kit.
4 tests; spec notes "reprint the recovery kit after adding a private tool or changing a passphrase". Merged `166f56b`.

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
