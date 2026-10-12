// arc/wings-polish slice 4 — access.html redesign + opt-out grants (UI half, hermetic).
// The LIVE press_access_has() opt-out semantics are verified against the real DB on resume, after
// Cowork applies db/20260924_press_access_optout.sql. Here we prove the admin UI end to end with a
// stateful in-memory REST mock:
//   • admin sign-in SURVIVES a reload (the {session,status,code} wrapper bug fix) and accepts a
//     6–10 digit code;
//   • People render as one card per person with a switch per family tool, ON by default (opt-out);
//   • adding a person shows their card with every family tool ON;
//   • opting a person out of a tool writes an active=false grant that PERSISTS across a reload.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACCESS = readFileSync(join(ROOT, 'access.html'), 'utf8');
const FAMILY_GATE = readFileSync(join(ROOT, 'src', 'family-gate.js'), 'utf8');
const SPACES = { v: 2, personal: ['access.html'], family: ['remit.html', 'perth.html'] };
const PAGES = { 'remit.html': { title: 'Remit' }, 'perth.html': { title: 'The Runway — Perth' } };

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/access.html' || url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(ACCESS); return; }
    if (url === '/src/family-gate.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(FAMILY_GATE); return; }
    if (url === '/spaces.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(SPACES)); return; }
    if (url === '/pages.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(PAGES)); return; }
    res.writeHead(404); res.end('nf');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

// A stateful mock of GoTrue + PostgREST, isolated per test. `people`/`grants` mutate on POST so a
// reload re-reads the persisted state — exactly what the persistence assertion needs.
async function backend(context, seed) {
  const state = {
    people: seed?.people ? JSON.parse(JSON.stringify(seed.people)) : [{ email: 'mark@fam.test', name: 'Mark', is_admin: true, active: true, last_seen_at: null }],
    grants: seed?.grants ? JSON.parse(JSON.stringify(seed.grants)) : [],
    requests: seed?.requests ? JSON.parse(JSON.stringify(seed.requests)) : [],
    grantWrites: [],
    apps: [{ page: 'remit.html', label: 'Remit', gated: true }, { page: 'perth.html', label: 'The Runway — Perth', gated: true }],
  };
  // src/gate.js stub: a public (never-enrolled) browser -> no passkey belt -> straight to admin OTP.
  await context.route('**/src/gate.js', route => route.fulfill({ status: 200, contentType: 'text/javascript',
    body: `window.PressVault={SESSION_KEY:'press:vault:v1',everEnrolled:function(){return false;},loadSession:function(){return null;},unlock:async function(){return true;}};` }));

  await context.route('**/auth/v1/otp', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/auth/v1/verify', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'aaa.bbb.ccc', refresh_token: 'refresh-1', expires_in: 3600, user: { email: 'mark@fam.test', user_metadata: { name: 'Mark' } } }) }));
  await context.route('**/auth/v1/token**', route => route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'aaa.bbb.ccc', refresh_token: 'refresh-1', expires_in: 3600, user: { email: 'mark@fam.test', user_metadata: { name: 'Mark' } } }) }));

  await context.route('**/rest/v1/**', route => {
    const req = route.request();
    const u = new URL(req.url());
    const path = u.pathname.replace('/rest/v1', '');
    const method = req.method();
    const json = body => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/rpc/press_access_is_admin') return json(true);
    if (path === '/rpc/press_access_touch') return route.fulfill({ status: 204, body: '' });
    if (path === '/press_access_people') {
      if (method === 'GET') return json(state.people);
      const row = JSON.parse(req.postData() || '{}');
      const ex = state.people.find(p => p.email === row.email);
      if (ex) Object.assign(ex, row); else state.people.push(Object.assign({ is_admin: false, active: true, last_seen_at: null }, row));
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (path === '/press_access_apps') { if (method === 'GET') return json(state.apps); return route.fulfill({ status: 201, body: '[]' }); }
    if (path === '/press_access_grants') {
      if (method === 'GET') return json(state.grants);
      const row = JSON.parse(req.postData() || '{}');
      state.grantWrites.push(row);
      const ex = state.grants.find(g => g.email === row.email && g.page === row.page);
      if (ex) Object.assign(ex, row); else state.grants.push(row);
      // mirror the DB trigger press_access_grants_resolve: a grant going active resolves its request
      if (row.active) state.requests.forEach(r => { if (r.email === row.email && r.page === row.page && !r.handled_at) r.handled_at = new Date().toISOString(); });
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    if (path === '/press_access_requests') {
      // the page asks only for pending rows (handled_at=is.null)
      const pendingOnly = u.searchParams.get('handled_at') === 'is.null';
      return json(state.requests.filter(r => !pendingOnly || !r.handled_at));
    }
    return json([]);
  });
  return state;
}

async function signIn(page) {
  await page.locator('#em').fill('mark@fam.test');
  await page.locator('#send').click();
  await expect(page.locator('#cd')).toBeVisible();
  await page.locator('#cd').fill('12345678');       // 8 digits — exercises the 6–10 range
  await page.locator('#ver').click();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
}

test('admin sign-in survives a reload (verifyCode wrapper bug fix) and accepts a 6–10 digit code', async ({ page, context }) => {
  await backend(context);
  await page.goto(base + '/access.html');
  await signIn(page);
  // reload: the SAVED session (r.session, not the wrapper) is re-read -> still the admin grid, no loop
  await page.reload();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.locator('#em')).toHaveCount(0);   // NOT bounced back to the sign-in screen
});

test('People are cards with a switch per family tool, ON by default; the "gate an app" section is gone', async ({ page, context }) => {
  await backend(context);
  await page.goto(base + '/access.html');
  await signIn(page);
  const card = page.locator('.pcard').first();
  await expect(card).toContainText('Mark');
  await expect(card.locator('.prow')).toHaveCount(2);                 // remit + perth
  await expect(card.locator('.sw2.on')).toHaveCount(2);               // both ON by default (opt-out)
  await expect(card).toContainText('The Runway — Perth');
  await expect(page.locator('body')).not.toContainText('Which tools are gated');   // removed section
  await page.screenshot({ path: join(ROOT, 'docs', 'evidence', 'wings-polish-slice-4-access-admin.png'), fullPage: true });
});

test('adding a person shows their card with every family tool ON', async ({ page, context }) => {
  await backend(context);
  await page.goto(base + '/access.html');
  await signIn(page);
  await page.locator('#an').fill('Barbara');
  await page.locator('#ae').fill('barbara@fam.test');
  await page.locator('#addBtn').click();
  const barb = page.locator('.pcard', { hasText: 'Barbara' });
  await expect(barb).toBeVisible();
  await expect(barb.locator('.sw2.on')).toHaveCount(2);               // granted every tool by default
});

test('opting a person out of a tool writes an active=false grant that persists across a reload', async ({ page, context }) => {
  const state = await backend(context);
  await page.goto(base + '/access.html');
  await signIn(page);
  const firstSwitch = page.locator('.pcard').first().locator('.sw2[data-grant]').first();
  await expect(firstSwitch).toHaveClass(/on/);
  await firstSwitch.click();
  await expect(firstSwitch).not.toHaveClass(/on/);
  // the backend recorded an active=false revocation
  await expect.poll(() => state.grants.filter(g => g.active === false && g.email === 'mark@fam.test').length).toBe(1);
  // reload: the persisted revoke re-renders the switch OFF
  await page.reload();
  await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
  await expect(page.locator('.pcard').first().locator('.sw2[data-grant]').first()).not.toHaveClass(/on/);
});

// ── arc/marquee-wings-monitor slice 2 — Family Wing Access Manager + request flow ──
const KAYLEY_OFF = {
  people: [
    { email: 'mark@fam.test', name: 'Mark', is_admin: true, active: true, last_seen_at: null },
    { email: 'kayley@fam.test', name: 'Kayley', is_admin: false, active: true, last_seen_at: null },
  ],
  grants: [{ email: 'kayley@fam.test', page: 'perth.html', active: false }],
  requests: [{ email: 'kayley@fam.test', page: 'perth.html', requested_at: new Date(Date.now() - 5 * 60000).toISOString(), handled_at: null }],
};

test('the page is the "Family Wing Access Manager" (title + heading)', async ({ page, context }) => {
  await backend(context);
  await page.goto(base + '/access.html');
  await expect(page).toHaveTitle('Family Wing Access Manager');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Family Wing Access Manager' })).toBeVisible();
});

for (const vp of [{ name: 'desktop', size: { width: 1280, height: 900 } }, { name: 'mobile', size: { width: 390, height: 844 } }]) {
  test(`a pending request shows in the Requests strip + as a badge; "Turn on" resolves it (${vp.name})`, async ({ page, context }) => {
    await page.setViewportSize(vp.size);
    const state = await backend(context, KAYLEY_OFF);
    await page.goto(base + '/access.html');
    await signIn(page);
    const strip = page.locator('#reqs');
    await expect(strip).toBeVisible();
    await expect(strip.locator('.rq')).toHaveCount(1);
    await expect(strip).toContainText('Kayley wants The Runway — Perth');
    const kcard = page.locator('.pcard', { hasText: 'Kayley' });
    await expect(kcard.locator('.badge')).toHaveText('Requested');
    await expect(kcard.locator('.sw2[data-grant="kayley@fam.test|perth.html"]')).not.toHaveClass(/on/);
    await page.screenshot({ path: join(ROOT, 'docs', 'evidence', `marquee-wings-slice-2-access-manager-${vp.name}.png`), fullPage: true });

    await strip.getByRole('button', { name: 'Turn on' }).click();
    await expect(page.locator('#reqs')).toHaveCount(0);                                     // strip gone
    await expect(kcard.locator('.badge')).toHaveCount(0);                                   // badge gone
    await expect(kcard.locator('.sw2[data-grant="kayley@fam.test|perth.html"]')).toHaveClass(/on/);
    expect(state.grantWrites.at(-1)).toMatchObject({ email: 'kayley@fam.test', page: 'perth.html', active: true, revoked_at: null });
    expect(state.requests[0].handled_at).toBeTruthy();                                       // resolved
    await page.reload();
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();
    await expect(page.locator('#reqs')).toHaveCount(0);                                     // stays resolved
  });
}

test('flipping the person’s switch ON also resolves their pending request', async ({ page, context }) => {
  const state = await backend(context, KAYLEY_OFF);
  await page.goto(base + '/access.html');
  await signIn(page);
  await expect(page.locator('#reqs .rq')).toHaveCount(1);
  await page.locator('.sw2[data-grant="kayley@fam.test|perth.html"]').click();
  await expect(page.locator('#reqs')).toHaveCount(0);
  await expect(page.locator('.pcard', { hasText: 'Kayley' }).locator('.badge')).toHaveCount(0);
  expect(state.requests[0].handled_at).toBeTruthy();
});

test('adding a person writes ONLY a people row — no grant rows (opt-out: no row = on)', async ({ page, context }) => {
  const state = await backend(context);
  await page.goto(base + '/access.html');
  await signIn(page);
  await page.locator('#an').fill('Barbara');
  await page.locator('#ae').fill('barbara@fam.test');
  await page.locator('#addBtn').click();
  await expect(page.locator('.pcard', { hasText: 'Barbara' }).locator('.sw2.on')).toHaveCount(2);
  expect(state.grantWrites).toHaveLength(0);
  expect(state.grants.filter(g => g.email === 'barbara@fam.test')).toHaveLength(0);
});

test('an unreadable requests table never breaks the manager (no strip, grid still renders)', async ({ page, context }) => {
  await backend(context, KAYLEY_OFF);
  await context.route('**/rest/v1/press_access_requests**', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }));
  await page.goto(base + '/access.html');
  await signIn(page);
  await expect(page.locator('.pcard')).toHaveCount(2);
  await expect(page.locator('#reqs')).toHaveCount(0);
});
