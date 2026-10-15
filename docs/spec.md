# press — spec

## Overview

press is a static GitHub Pages site at https://schnubsy.github.io/press/ that serves
as the marquee publishing target for the council system. No build step — what is
committed is what is served.

## Two spaces (public + personal wing)

The marquee is split into two spaces:

- **Public** — open-access cards, plus the Archive card. Anyone can view them; nothing
  is required to see the landing or the public marquee.
- **Personal wing** — sensitive tools (`fsa.html`, `giving.html`, `retirement.html`,
  `thrift-shop.html`), reached through a **personal/secure card pinned to the top of the
  stack**. One WebAuthn passkey (1Password, PRF) unlocks the wing; once in, every personal
  app is usable without a further prompt.

**Boundary:** page shells stay public on GitHub Pages. Protection lives where the data
is — AES-256-GCM ciphertext in Supabase behind header-gated RLS. The arc gates the
**keys**, not the files. Two invariants that must never be relaxed:

1. The landing and public marquee make **zero** WebAuthn and **zero** `press_vault` calls
   (card state is read from the local `press:vault:v1` session only).
2. No sync id or passphrase is ever committed to `schnubsy/press`.

### spaces.json (repo-owned)

`spaces.json` in the press root decides the split. It is **repo-owned and NEVER written
by a release script**:

```json
{ "v": 1, "personal": ["fsa.html", "giving.html", "retirement.html", "thrift-shop.html"] }
```

A page in neither list is treated as **public** (matches historical behaviour). Fail-closed
is enforced at publish time (see Publish flow): each app's `tools/release.js` aborts unless
its own page is listed in `personal[]`. The split must NOT depend on `press_portal` (that
table is anon read/write, so an anonymous write must never move a card between spaces).

## Portal contract

`index.html` is the entry portal. It reads `pages.json` and `spaces.json` from the repo
root (via the GitHub raw URL, with a `press:marquee:v3` cache/offline fallback).

### pages.json shape

`pages.json` is an **object keyed by filename**, each value `{ "title": ... }` only:

```json
{
  "fsa.html": { "title": "FSA Claims" },
  "giving.html": { "title": "Giving Tracker" }
}
```

`pages.json` `title` is the page's own manifest / **tab title** only — it does NOT name the card.

### Card naming — the marquee label map (RULE, Mark 2026-10-12)

**RULE: the marquee owns card naming.** Every card's small pink **kicker** (`.k`), large white
**title** (`h3`) and **icon** come from ONE label map in `index.html`:

```js
const LABELS = {
  'optimo.html': { kicker:'Day planner', title:'Optimo', icon:'calendar-check' },
  …
};
```

- `icon` is a key in `index.html`'s `ICONS` registry (Feather/Lucide-grade, 24 viewBox, stroke 2,
  round joins). Icons key off the label entry, never off kicker text — a kicker rename never moves an icon.
  Every served page has its own glyph.
- The same title names the page everywhere the marquee shows it: lobby/wing cards, the Private Wing
  "Connect your tools" rows (`TOOL_CFG` carries no label), and the recovery kit.
- Cards carry no filename line.
- A page with no entry falls back to kicker "Page" + its `pages.json` title + the generic glyph — a
  degraded state that `tools/tenants-check.mjs` **T9 `labels`** FAILS (every `pages.json` page needs an
  entry with a non-empty kicker, title and an `icon` that exists in `ICONS`).
- **New web apps coordinate naming with the marquee:** a new page's publish adds its `LABELS` entry
  (and, if needed, a new `ICONS` glyph) **in the same press change**. Release scripts never set card
  wording — they write `pages.json` (tab title) only. `spaces.json` is not theirs at all.

## The vault model (personal wing)

- **`public.press_vault`** — one AES-256-GCM-encrypted keyring row per enrolled passkey.
  `id` = SHA-256 (hex) of the passkey's raw credential id (never the raw id). Ciphertext
  only. RLS gates every row on the `x-vault-id` request header = `id` (mirrors the
  `press_fsa` / `press_retirement` `x-plan-id` pattern) — with one deliberate difference:
  **DELETE is granted to anon, gated the same way**, so a device can be revoked from the
  browser.
- **Key derivation** — the AES key is derived in the browser from the 32-byte WebAuthn PRF
  output via **HKDF-SHA-256** (correct for high-entropy PRF output; the apps' own document
  crypto uses PBKDF2 because their input is a low-entropy passphrase). The key never reaches
  the server; there is no readable data in `press_vault`.
- **Keyring** (v1): `{ v, apps: { "fsa.html": {sync_id, pass}, … , "card-scout.html": {sync_id} } }`. A keyring key is a
  **keyring id**, normally the page's file name — but a page renamed after enrolment keeps its enrolled id: Thrift Shop
  (`thrift-shop.html`, renamed 2026-10-14) still seals under `"card-scout.html"`. index.html maps link file → keyring id
  in ONE alias map, `KEYRING_ID` (+ `keyringId()` / `linkFile()`); `TOOL_CFG`, `CONNECT_TOOLS` and `LABELS` are keyed by
  the link file, every keyring read/write goes through `keyringId()`. The shared gate is untouched (tenants keep calling
  `guard({page:'card-scout.html'})`), so nobody re-enrols.
- **Enrolment** creates a discoverable credential (`residentKey`+`userVerification` required,
  `rp.id` = the site's hostname). PRF absent ⇒ abort with a plain message; **there is no
  passphrase fallback**. `addPasskey` seals the SAME keyring under a new key as a NEW row.

### Session contract

- `press:vault:v1` in **localStorage**: `{ keyring, unlockedAt, expiresAt, vaultId }`, TTL
  **8 hours**. `lock()` clears it and fires a storage event so other tabs drop it too.
- Each personal app reads this session (read-only; the marquee owns the crypto) and adopts
  its credentials **in memory** — no passphrase prompt. The apps **never re-persist a
  passphrase to disk**: fsa/giving/retirement keep the passphrase only in tab-scoped
  `sessionStorage` (cleared on tab close) for the manual fallback; card-scout sources its
  `sync_id` from the vault (cached to localStorage for direct visits — a capability, not a
  passphrase). Log out / log back in applies to the **secure section only**.
- The vault module lives at `src/vault.js` (unit-tested in Node) and is inlined verbatim
  into `index.html` via `tools/inline-vault.mjs` (`--check` guards drift). The site keeps no
  build step. The private-wing session TTL is **7 days, fixed from unlock** (no slide-on-use).
- **Recovery is a printable paper kit, not an email reset.** The passkey is only a convenience
  keyring; each app's data is encrypted by that app's own passphrase. The unlocked wing offers
  **Print recovery kit** — a print-styled sheet of every keyring entry (app name, sync ID,
  passphrase) built in-browser from the unlocked keyring (nothing sent or stored anywhere new),
  hidden when locked. The paper kit is the recovery path; there is no email reset by design.
  After adding a private tool or changing a passphrase, reprint the recovery kit.
  Every personal-tier page in `spaces.json` that stores data must have a `TOOL_CFG` entry in
  `index.html` (so it appears in *Connect your tools* and the recovery kit); `tools/tenants-check.mjs`
  T7 enforces this, keying "stores data" off the vault keyring (`src/vault.js` → `emptyKeyring`).

## Page contract

Each published page is a **single self-contained HTML file**:

- All assets inlined or referenced from a sibling assets directory (e.g. `council-assets/`)
- No server-side dependencies except where the page explicitly declares them
  (e.g. `agent-health.html` and the personal apps call Supabase at runtime)
- Renders correctly at https://schnubsy.github.io/press/<filename>
- No build step — what is committed is what is served

## Publish flow

1. A page is authored/updated in its source project.
2. That project's `tools/release.js` **stages** into press: builds (if any), runs its secrets
   gate, runs the **personal-space gate** (abort unless the page is in `press/spaces.json`
   `personal[]` — absent/unparseable `spaces.json` is also a failure), copies the page, and
   registers the `pages.json` object entry. It **never pushes on its own**.
3. The arc **close** commits and pushes the marquee, then hash-verifies:
   `git hash-object <file>` == the GitHub blob SHA, and the live URL returns 200.
4. Lane B (emergency): a hot-patch committed directly; must be documented in `docs/evidence/`.

## Assets directories

Sibling asset directories (e.g. `giving-assets/`, `fsa-assets/`, `council-assets/`) are
referenced by their paired page and committed together.

## Tenants

**Redirect stubs (named exception, 2026-10-14).** A root `.html` that is NOT a page: an old file name kept only so
bookmarks / home-screen icons still land after a rename. Listed in `tenants.json` → `redirects` (`{old: {to, source,
why}}`) and mirrored by index.html `REDIRECT_STUBS` (the marquee never lists it). A stub is ≤ 2 KB, noindex,
`location.replace('<to>' + location.search + location.hash)` before a meta-refresh fallback, with no gate/vault/data code,
and appears in no page registry (pages.json, spaces.json, LABELS). Its source lives in the tenant repo and ships with the
tenant's release. tenants-check **T10 `redirects`** enforces all of it, and that every root `.html` is a pages.json page,
a redirect or `index.html`. Today: `card-scout.html` → `thrift-shop.html` (source `thrift-shop:redirect/card-scout.html`).
**Parented pages (`parent`, arc app-lab 2026-10-14).** A `pages.json` entry may carry `"parent": "<page>.html"`: the page
is listed INSIDE that parent (today: `optimo.html` → `app-lab.html`, an App Lab prototype whose `optimo.html` is only its
Family Wing sign-in step), so the portal renders **no card** for it on any surface (lobby, wing views, wing-door counts —
`index.html` `cardFiles()`). Everything else is unchanged: it stays in `spaces.json`, keeps its gate, grant key and access-admin
column, and stays a served root file. The parent's own registry (e.g. `app-lab/prototypes.json`) lists it. `tenants.json`
mirrors the field. tenants-check **T1 parent** fails a `parent` that is not a pages.json page, sits in a different space tier,
or is itself parented (one level only).
A renamed tenant may carry `formerly: {page, repo}` so T8 accepts its council snag-registry row under the former name
until the Steward updates that row (reported as PASS with "council registry update pending").

The marquee is a **platform with tenants**, not an instrument. A tenant is a page whose
source lives in another repo (`~/Documents/VSCode/<repo>`) and ships here via that repo's
release script; a **press-native** page (`repo: null`) is authored directly in press. The
registry is **`tenants.json`** (repo-owned like `spaces.json`), keyed by page filename with
`repo · tier · gate · vendored · release · build · output · deterministic · note`. This
section is the **canonical** tenancy contract; the council reference and the MANUAL point here.

**Snag train gates (registry parity + page-diff).** Every tenant page is also a row in the council
snag registry (`~/Documents/Claude/council-hub/council/instruments/snag/registry.json`, same repo) —
`tools/tenants-check.mjs` **T8 `registry-parity`** fails a page with no row or a repo mismatch, and a missing
registry file is a FAIL, not a SKIP (`COUNCIL_DIR` overrides the path). The monthly snag train gates every
page it rebuilds with **`tools/page-diff.mjs <built> <live-url>`** (Playwright, 1280×800 + 390×844,
pixelmatch): above `--threshold` (default 2 % of pixels on either viewport) it exits 2 and the train goes
🔴 unless the slice's scope declares a layout change. Both are dev-only tools; the site keeps no build step.

**Two RULEs (the invariant this arc protects):**
- **`press/src` is the ONLY source for shared modules — apps pull, never push.** A published
  page in press is NEVER hand-edited; a hotfix lands in the source repo and ships via that
  app's release. `src/gate.js` (private wing) and `src/family-gate.js` (family wing) are the
  canonical gates; every vendored copy is byte-identical to its canonical.
- **A marquee change rides INSIDE the tenant app's arc, never as a parallel press arc** — one
  writer on press at a time (fixed order: council `arc.md` → Tenant-change arcs).

**What a tenant OWES the marquee:** a `pages.json` entry (`{title}` only); a `tenants.json`
entry; its tier in `spaces.json` (repo-owned; release scripts READ, never write); a **`LABELS`
entry in `index.html`** (kicker + title + icon key, added in the same press change as the first publish —
the marquee owns card naming, see Portal contract → Card naming; T9 `labels` enforces it; never a card
field or icon in `pages.json`); for
a **family** page, a `press_access_apps` row (gated) BEFORE the gate ships. Access is opt-out (2026-09-24; remit
aligned 2026-10-12): every active person is in unless a switch is off — no grant rows needed.

**DB grants RULE (Data API grants — from 2026-10-30):** every migration that creates a table in `public` GRANTS in
the same file — Supabase stops auto-granting Data API access to NEW `public` tables on that date (existing
tables keep theirs). `grant select, insert, update, delete on public.<t> to authenticated, service_role;`
always; `grant select on public.<t> to anon;` ONLY when the page is genuinely public (omit anon otherwise).
RLS still decides which rows; the grant only opens the door. A service-role-only table (e.g. a deny-all
`*_capture_*` or a views-only base table) grants `service_role` alone and says so in a comment.

**Borrowed capability — `steward.html` (press-native, private wing; arc/steward-report 2026-10-12).** It has no
keyring entry of its own (T7-exempt, like `access.html`). It guards on `card-scout.html`, so the shared gate releases
the private wing's Card Scout capability, and POSTs that capability as `x-plan-id` to the `steward-reports` Edge Function
(`supabase/functions/steward-reports/`). The function compares it, through the service-role-only RPC
`press_steward_capability_ok` (`db/20261012_press_steward_capability.sql`), against the **server-held
`press_deals.sync_id` column default**. It never checks "a row with this sync_id exists", because anon can INSERT rows
with any sync_id. Only after that does it read the service-role-only `press_steward_reports` table. **Coupling:**
rotating Thrift Shop's (keyring id `card-scout.html`) key moves Steward access with it.

**Family-wing tenants inherit the wing (arc/marquee-wings-monitor, 2026-10-12):** a new family-wing app
inherits the ONE wing-level sign-in email (`docs/auth/family-wing-otp.*`, "Your Family Wing sign-in code",
synced to Supabase Auth by `auth-email-sync.yml`) — **never a per-app template or an app name in the email**
(`test/auth-email.test.mjs` enforces it). It also inherits the opt-out access model and the blocked-screen
"Request access" flow from `src/family-gate.js`; its RLS goes through `press_access_has('<page>.html')` (or a
helper that delegates to it, as `remit_private.remit_has_access()` now does) — never a private opt-in check.

**What the marquee OWES a tenant:** the canonical gate modules in `press/src`; the shell; and
the shared DB shapes (`press_<shape>`, every row keyed by a `page` column = filename stem):
- `press_state` — simple checkboxes. Cols `page`, `item_id`, `checked` bool, `updated_at`;
  PK `(page,item_id)`. Lane 1. Reference `kayley.html`.
- `press_tasks` — rich task rows. Cols `page`, `item_id`, `title`, `status`, `category`,
  `week`, `position`, `extras` jsonb, `created_at`, `updated_at`; PK `(page,item_id)`. Lane 2.
  Reference `eagle-path.html`.
- RLS posture: **header-gated / allow-listed, NOT open** — policies gate on a request header
  (`x-vault-id`, `x-plan-id`, `x-app`) so a URL holder cannot read another page's private
  rows. (`press_portal` sort/archive state stays anon r/w by design.) Identifiers: MANUAL §12.2.

**Release-script contract** (each tenant's `tools/release.js`):
- READS `spaces.json` and **fails closed** if its page is in the wrong list (absent/unparseable
  `spaces.json` is also a failure); honours `PRESS_DIR` (default `../press`).
- **Byte-compares its vendored gate against `press/src/<gate>` BEFORE building** and fails
  closed — a SKIP (press repo absent) is NOT a pass.
- Writes its `pages.json` entry in the SAME commit as the page.
- **Never writes `spaces.json` or `tenants.json`**; never pushes on its own (the arc close does).

**Hotfix rule:** source repo first, then release — never patch `press/<page>.html` by hand.

## Agent Monitor (`agent-health.html`)

Arc marquee-wings-monitor slice 4 (2026-10-12). One page answers, for every agent, AI function, pg_cron job and
scheduled task behind the marquee apps: *is it working, when did it last do REAL work and what did it produce, is
anything late or missed, what did it cost this month (and projected), and how do I fix it?*

**Not self-validating.** Status is computed on the server by `press_agent_monitor_public` from real evidence against
an expected schedule — never from `press_agent_registry.last_ok_at` (council agent-core bumps that on `skipped`
ticks too) and never by the page. Evidence sources (`press_agent_expect.source`):

| source | real work = | used for |
|---|---|---|
| `runs-work` | `press_agent_runs` outcome `ok`/`warn` (never `skipped`) | scheduled agents (card-scout, agent-watch) |
| `runs-alive` | any non-`dead` run — the pipe is alive | inlets polled on a timer (Gmail Apps Script, fsa-capture, the GH notifier) |
| `runs-event` | last attempt's outcome; no cadence | on-demand agents that log runs |
| `cron` | `cron.job_run_details` (`dispatch_only` = an http_post job: "succeeded" only means queued) | pg_cron jobs |
| `checkin` | `press_agent_checkin()` rows | cloud / Mac / browser scheduled tasks |
| `none` | — shown honestly as **No data** | AI functions that log nothing yet |

Statuses: `healthy` · `late` (missed its due time + grace) · `failed` (never ran, last attempt failed, or silent
4× its window) · `no-data` (grey ring — never green) · `off`. Schedules (`sched`, America/Chicago):
`{"every":min}` · `{"daily":["HH:MM",…]}` · `{"weekly":{"dow":0-6,"at":"HH:MM"}}` · `{"monthly":{"dom":1-28,"at":"HH:MM"}}` · `null` (on demand).
Expectations start at `registered_at` — a new row is never "late" for a run due before it existed.
Month cost = CT month-to-date; **projected = MTD + avg(cost of the last 7 complete CT days) × CT days remaining
(fractional)** (server per agent; `src/agent-monitor.js` `projectMonth` for the page total).

**Alerting (arc quiet-alerts, 2026-10-13).** pg_cron `agent-watch` (every 15 min, Vault-held header secret) → Edge
Function `agent-watch` diffs the view against `press_agent_watch_state` (`bad_since` = start of the unbroken late/failed
episode, `down_alerted`) and sends ONE Pushover push (priority 0) + ONE Gmail email only when an item has been down
for **24h+** (once per episode), plus one quiet (priority −1) "working again" note if that item recovers. Shorter blips
are stored silently; an undelivered alert is retried every tick and logs the watcher as an error. It reports its own
silence only after a day. An agent with `press_agent_expect.idle_is_work` (Card Scout's judge) counts a `skipped` run
with the empty-input hash `h-811c9dc5` ("checked, nothing to judge") as real work. The GH Action
`agent-health-notifier` (every 6 h) is the watcher of the watcher: it fails (GitHub emails) only if agent-watch has
done no real work for > 24 h.

**Fix.** Per-agent `fix_hint` + public-safe `fix_links` for everyone. Retry/Run now appears only when the Family
Wing session in localStorage (`press:family:v1`) belongs to an admin; Edge Function `agent-fix` re-verifies the JWT
(GoTrue) and `press_access_is_admin()` as the caller, runs only the row's allowlisted `retry_action`
(`cron:<job>` → `press_agent_fix_run`, service_role only), rate-limits 1 per agent per 10 min and logs a run row.

### RULE — registering a new agent (every future agent, AI function, job or scheduled task)

1. **One row in `public.press_agent_expect`** (migration in `db/`, mirrored byte-identical): `id`, `app_label` (the
   marquee app name: Card Scout, Cardsharp, Optimo, FSA Claims Tracker, Giving Tracker, The Council, Marquee …),
   `label`, `what`, `kind`, `source` (+ `run_app`/`run_agent` or `cron_job`), `sched` + `grace_minutes`, `fix_hint`,
   `fix_links`, optional `retry_action`. The page, the watcher and the GH check pick it up automatically.
2. **A scheduled task (cloud / Mac / browser) checks in as its LAST step** via the Supabase connector (`execute_sql`
   on project `eepjhpyziczrxvirczio`):
   ```sql
   select public.press_agent_checkin('<id>', 'ok', '<one line: what it produced>');   -- 'ok' | 'warn' | 'fail'
   RULE: the note is PUBLIC (shown on agent-health.html) — counts only; never amounts, names, providers or personal data.
   ```
   `press_agent_checkin` is SECURITY DEFINER and executable only by `service_role`/`postgres` (never anon or
   authenticated), and refuses ids that are not `source = 'checkin'` rows.
3. An agent that writes `press_agent_runs` (council agent-core) needs nothing else — but it is only "working" when it
   logs `ok`; a `skipped` tick is never real work.
