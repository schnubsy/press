# The Family Wing — a third access tier for the press marquee

A repeatable, light-touch access-control option for marquee pages that are not sensitive enough for
the Private Wing but should not be readable by the whole internet. Authored 2026-09-21 alongside
`remit`, which is its first tenant. **This document belongs to the `press` repo, not to remit.**

---

## 1. The three spaces

| Space | Who gets in | How | Protection | Example |
|---|---|---|---|---|
| **Public** | anyone | nothing | none needed | `council-guide.html`, `halvsies.html` |
| **Family Wing** *(new)* | people Mark has granted | 6-digit code emailed to their address, then signed in on that device indefinitely | Supabase Auth + RLS per email | `remit.html` |
| **Private Wing** | Mark | WebAuthn passkey + a sealed keyring | client-side AES-256-GCM; the key never reaches the server | `fsa.html`, `giving.html` |

The Private Wing protects data from the *server*. The Family Wing protects data from *the public*.
They are different problems and deliberately have different mechanisms; the Family Wing does not
try to be a weaker passkey, and the Private Wing does not try to be a multi-user system.

### 1.1 Both wings open from the lobby — the wings are siblings, not a chain

The public marquee root (`index.html`) carries **two doors, side by side**: *Family Wing*
(`?view=family`) and *Private Wing* (`?view=personal`). Reaching the Private Wing must **never**
route through the Family Wing, and vice versa. The tiers describe how much protection each space
has, not an order you pass through.

Binding rules for the lobby:
- **Neither door makes an auth call until it is opened.** press's existing rule — "the landing path
  makes zero WebAuthn / vault calls until the user opens the wing" — is extended to cover Supabase
  sign-in. An idle lobby tab prompts for nothing and calls nothing.
- **Each door shows only a count**, never the names of the pages behind it. The public lobby should
  not enumerate a private space. (`spaces.json` is public in the repo, so this is politeness rather
  than secrecy — but a count is the honest amount to show.)
- **A page stays directly bookmarkable.** `remit.html` opens straight from a link; the wing is a
  directory, not a doorway. The gate lives on the page. This already holds for `fsa.html` and the
  rest of the Private Wing and must hold identically here.
- **`renderMarquee` gains no new state.** The family door is a static card in the lobby paint,
  exactly like the existing Private Wing card, and is rendered from `spaces.json` alone.

---

## 2. The honest security claim

**A page on GitHub Pages cannot be hidden.** The HTML is public and always will be. So:

> **The gate is courtesy. RLS is the protection.**

The visible sign-in screen exists so that a person who lands on the page understands they are
somewhere private and stops. The actual defence is that every row of data sits behind a Postgres
policy requiring a valid JWT whose email holds a live grant. Someone who views source, deletes the
gate and loads the page gets a working app with nothing in it.

Stated plainly so that nobody later mistakes the gate for the lock — the same discipline as
retirement's "a SCREEN LOCK, not encryption" note, except here the lock underneath is real.

---

## 3. The fail-closed union

A page is gated when **either** source says so:

```
gated(page) = spaces.json.family.includes(page)  OR  press_access_apps[page].gated
```

`spaces.json` is repo-owned and read-only to release scripts — the existing fail-closed rule,
unchanged. `press_access_apps` is data, editable from the admin page, so Mark can put a page behind
the gate without a deploy.

The union is the safety property: **the database can only ADD gating, never remove it.** A tampered
row can lock people out — annoying, instantly reversible — but can never open a page. And because
data access is enforced by RLS on the email in the JWT, a forged `gated:false` still yields nothing.

`spaces.json` v2 gains one key and keeps its existing shape:

```json
{ "v": 2,
  "personal": ["fsa.html", "giving.html", "retirement.html", "card-scout.html"],
  "family":   ["remit.html"] }
```

A page in neither list is public — the existing default, unchanged. `normSpaces()` must tolerate a
v1 file (no `family` key) so nothing breaks before the first publish.

---

## 4. Tables

Three, all in the shared `press` project, all admin-writable only.

```
press_access_people    email (pk) · name · is_admin · active · added_at
press_access_apps      page (pk)  · label · gated · added_at
press_access_grants    email · page (pk together) · active · granted_at · revoked_at
```

RLS shape:
- **Read** — a signed-in user may read their OWN row in `press_access_people` and their own grants.
  Nothing else. This is what lets a page ask "am I allowed in?" without exposing the family list.
- **Write** — only an email whose `press_access_people.is_admin` is true. One `security definer`
  helper, `press_access_is_admin()`, used by every write policy.
- `anon` is revoked on all three tables. The gate does not need to read them: an ungranted user
  simply fails at the app's own tables.

```sql
create or replace function public.press_access_is_admin() returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.press_access_people p
    where p.email = (select auth.jwt() ->> 'email') and p.is_admin and p.active );
$$;

create or replace function public.press_access_has(page text) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.press_access_grants g
    join public.press_access_people p on p.email = g.email
    where g.page = page and g.active and p.active
      and g.email = (select auth.jwt() ->> 'email') );
$$;
```

Each tenant app then writes one line per table:
`using ( public.press_access_has('remit.html') )`.

---

## 5. Who can sign in at all

Two locks, neither needing a server:

1. **Sign-ups off** in the dashboard, and the client always calls
   `signInWithOtp({ shouldCreateUser: false })`. An unknown address gets no email at all.
2. **A Before User Created hook**, implemented as a plain Postgres function, refusing any address
   not active in `press_access_people`. This is the belt to the above braces, and it is what makes
   "invite someone" a single row rather than a deployment.

```sql
create or replace function public.press_access_before_user_created(event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare addr text := lower(event -> 'user_metadata' ->> 'email');
begin
  if not exists (select 1 from public.press_access_people p
                 where lower(p.email) = addr and p.active) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403, 'message', 'This address is not on the family list.'));
  end if;
  return '{}'::jsonb;
end; $$;
```

**Inviting is therefore: add the row, then send them the link.** No service-role key, no Edge
Function, no invite email infrastructure. They open the link, type their address, get a code.

**Revoking is: flip `active` to false.** Their existing JWT stays technically valid for up to an
hour, but every query it makes returns nothing, because `press_access_has()` is evaluated per query.

---

## 6. The access admin page

`access.html` — a new page in the press repo, listed in `spaces.json.personal`, so it sits in the
**Private Wing behind Mark's passkey**. It additionally requires Mark's own Supabase session,
because its writes are RLS-gated on `is_admin`. Passkey to see it; signed-in admin to change it.

Four things, and nothing else:

1. **The grid.** People down the side, gated apps across the top, a toggle in each cell. One tap
   grants or revokes. The state of the grid is the state of the system — there is no separate
   "apply".
2. **Gate an app.** A list of every page in `pages.json` with a switch. Turning one on writes
   `press_access_apps.gated = true` and the page is gated on its next load. A note under it says
   which pages are gated by `spaces.json` instead, and that those cannot be ungated from here —
   because the union is deliberately one-directional.
3. **Add someone.** Name and email. Writes `press_access_people`, then offers the page link to copy
   and send however Mark likes. Optionally pre-ticks grants for chosen apps in the same action.
4. **Who is in.** Per person: which apps, when granted, when last seen. Last-seen comes from a
   `last_seen_at` stamp the shared gate writes on successful sign-in — one column, no telemetry.

Deactivating a person greys their whole row and is reversible. Deleting is a separate, confirmed
action that also deletes their grants.

---

## 7. The shared gate block

`press/src/family-gate.js`, vendored into each tenant app the same way `press-gate.js` is today.
It is the **only** place the sign-in flow is written.

```
FamilyGate.require(page)   → resolves when a granted session exists;
                             otherwise renders the full-page sign-in and resolves after it
FamilyGate.session()       → the current user's email and name, or null
FamilyGate.signOut()
```

Behaviour:
- Reads `spaces.json` and `press_access_apps` for its page. **If either read fails, it gates** —
  failing closed is the whole point.
- Makes **zero** auth calls until it knows the page is gated, so a public page never touches
  Supabase.
- On a failed token refresh, shows the sign-in screen rather than an error.
- Ships a `--check` inline guard in the tenant's `tools/publish-checks.js`, exactly as retirement
  does, so a drifted vendored copy fails the publish. (`press`'s own `inline:check` does not police
  sibling repos — a known gap recorded in press's HANDOFF; each tenant owns its check.)

---

## 8. Adding a second tenant later

1. Add the page to `spaces.json.family` (or flip it on in the admin page). The lobby's Family Wing
   door picks it up automatically — its count comes from `spaces.json`, not from a hand-kept list.
2. Vendor `family-gate.js` and call `FamilyGate.require('<page>.html')` before boot.
3. Put `using ( public.press_access_has('<page>.html') )` on its tables.
4. Grant the people in the admin grid.

That is the whole contract. No new tables, no new flow, no new decisions.

---

## 9. What this framework is not

- **Not per-user data.** Everyone granted a page sees the same dataset. Per-user views would need a
  fourth tier and are not wanted.
- **Not roles.** Grant or no grant. remit explicitly wants everyone to have full edit rights.
- **Not a replacement for the Private Wing.** Anything where the *server* should not be able to read
  the data stays behind the passkey and client-side encryption.
- **Not a way to hide a page.** See §2.

---

## 10. Risks

| | Risk | Mitigation |
|---|---|---|
| 🟡 | Gmail SMTP deliverability to UK/AU consumer addresses | Test all three in S2; move to Brevo (300/day, single-sender verification) if anything lands in spam |
| 🟡 | Safari's 7-day storage sweep signs someone out | Add to Home Screen exempts them; worst case is one code |
| 🟡 | Mark loses admin access (no admin row, no way to write one) | The admin flag is set once by hand via the Supabase connector; a second admin (Barbara) is cheap insurance |
| 🟢 | A tampered `press_access_apps` row | Union is one-directional; RLS is independent |
| 🟢 | Someone shares the page URL | The URL was never the secret |
