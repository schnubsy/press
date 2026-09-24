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
      const ex = state.grants.find(g => g.email === row.email && g.page === row.page);
      if (ex) Object.assign(ex, row); else state.grants.push(row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
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
