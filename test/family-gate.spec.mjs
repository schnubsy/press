// family-gate.js — the full sign-in flow, hermetic. Drives the vendored gate against mocked
// GoTrue (/auth/v1/otp, /verify) and PostgREST (rpc/press_access_has, rpc/press_access_touch).
// Nothing touches production. Proves: gated page shows sign-in; a granted email + correct code
// gets in; a signed-in-but-ungranted email is told so; a wrong code is refused; and — the whole
// point — NO auth call happens until the page is known gated.

import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GATE = readFileSync(join(ROOT, 'src', 'family-gate.js'), 'utf8');

// a minimal tenant page that boots the gate exactly as remit.html will
const HARNESS = (page) => `<!doctype html><html><head><meta charset="utf-8"><title>gate harness</title></head>
<body><div id="app" style="display:none">SECRET APP CONTENT</div>
<script>${GATE}</script>
<script>
  window.__result = null; window.__error = null;
  FamilyGate.cfg({ spacesUrl: '/spaces.json' });
  FamilyGate.require(${JSON.stringify(page)}).then(function(id){
    window.__result = id; document.getElementById('app').style.display = 'block';
  }).catch(function(e){ window.__error = String(e); });
</script></body></html>`;

let server, base;
const TOKEN = (email, name) => ({
  access_token: 'at.' + email, refresh_token: 'rt.' + email, expires_in: 3600,
  user: { email, user_metadata: { name } },
});

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url.startsWith('/gate')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HARNESS('remit.html')); return; }
    if (req.url.startsWith('/public')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HARNESS('nope.html')); return; }
    res.writeHead(404); res.end('nf');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

// state.grantEmails = which emails hold a grant for remit.html
async function harness(page, context, opts = {}) {
  const state = { authCalls: 0, sent: null, touched: 0, grantEmails: opts.grantEmails || ['mark@example.com'] };
  await context.route('**/spaces.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 2, family: ['remit.html'] }) }));
  await context.route('**/auth/v1/otp**', route => {
    state.authCalls++; state.sent = JSON.parse(route.request().postData() || '{}').email;
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await context.route('**/auth/v1/verify**', route => {
    state.authCalls++;
    const b = JSON.parse(route.request().postData() || '{}');
    if (b.token === '123456') { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TOKEN(b.email, 'Tester')) }); }
    else { route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid', error_description: 'Token has expired or is invalid' }) }); }
  });
  await context.route('**/rest/v1/rpc/press_access_has**', route => {
    const auth = route.request().headers()['authorization'] || '';
    const email = auth.replace('Bearer at.', '');
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.grantEmails.includes(email)) });
  });
  await context.route('**/rest/v1/rpc/press_access_touch**', route => { state.touched++; route.fulfill({ status: 204, body: '' }); });
  await context.route('**/rest/v1/press_access_apps**', route => route.fulfill({ status: 401, body: '{}' }));
  return state;
}

test('a gated page shows the sign-in and hides the app until a granted code is entered', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/gate');

  // the gate is up; the app content is not resolved yet
  await expect(page.locator('#family-gate')).toBeVisible();
  expect(await page.evaluate(() => window.__result)).toBeNull();

  // email step
  await page.fill('#fg-email', 'mark@example.com');
  await page.click('#fg-send');
  await expect(page.locator('#fg-code-form')).toBeVisible();
  expect(state.sent).toBe('mark@example.com');

  // code step — correct code, granted email
  await page.fill('#fg-code', '123456');
  await page.click('#fg-verify');

  await expect(page.locator('#family-gate')).toHaveCount(0);          // gate removed
  await expect(page.locator('#app')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__result && window.__result.email)).toBe('mark@example.com');
  expect(state.touched, 'last_seen_at not stamped on sign-in').toBeGreaterThan(0);
});

test('a wrong code is refused, the gate stays up', async ({ page, context }) => {
  await harness(page, context);
  await page.goto(base + '/gate');
  await page.fill('#fg-email', 'mark@example.com');
  await page.click('#fg-send');
  await page.fill('#fg-code', '000000');
  await page.click('#fg-verify');
  await expect(page.locator('#fg-msg.err')).toBeVisible();
  await expect(page.locator('#family-gate')).toBeVisible();
  expect(await page.evaluate(() => window.__result)).toBeNull();
});

test('a signed-in but UNgranted address is told it lacks access (not let in)', async ({ page, context }) => {
  await harness(page, context, { grantEmails: [] });   // nobody is granted
  await page.goto(base + '/gate');
  await page.fill('#fg-email', 'stranger@example.com');
  await page.click('#fg-send');
  await page.fill('#fg-code', '123456');                // valid code, but no grant
  await page.click('#fg-verify');
  await expect(page.locator('#family-gate')).toContainText('doesn’t have access');
  expect(await page.evaluate(() => window.__result)).toBeNull();     // app never resolves
});

test('zero auth calls happen before the page is known gated', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/gate');
  await expect(page.locator('#family-gate')).toBeVisible();
  // spaces.json read happened, but NO /auth/v1 call until the user acts
  expect(state.authCalls).toBe(0);
});
