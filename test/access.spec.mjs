// access.spec.mjs — slice 4 (arc/scratchpad-rework). access.html's per-page passkey overlay
// (access-framework §6: "Passkey to see it; signed-in admin to change it"). The overlay was added in
// b1a91a9; this spec is its regression guard. It serves the REAL access.html and family-gate.js from
// disk and stubs src/gate.js (PressVault) via a route so the two cases are hermetic:
//   (a) an ENROLLED browser with no live wing session -> the passkey gate is shown before anything;
//   (b) a never-enrolled browser -> straight to the admin OTP sign-in (RLS is still the real lock, §2).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ACCESS = readFileSync(join(ROOT, 'access.html'), 'utf8');
const FAMILY_GATE = readFileSync(join(ROOT, 'src', 'family-gate.js'), 'utf8');

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/access.html' || url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(ACCESS); return; }
    if (url === '/src/family-gate.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(FAMILY_GATE); return; }
    if (url === '/spaces.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ v: 2, personal: ['access.html'], family: ['remit.html'] })); return; }
    if (url === '/pages.json') { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); return; }
    res.writeHead(404); res.end('nf');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

// Replace src/gate.js with a stub that defines window.PressVault with the enrolment/session state we
// want, so the page's own enter()/wingLocked() logic runs unchanged against it.
async function stubVault(context, { enrolled, hasSession }) {
  const stub = `window.PressVault = {
    SESSION_KEY: 'press:vault:v1',
    everEnrolled: function(){ return ${enrolled ? 'true' : 'false'}; },
    loadSession: function(){ return ${hasSession ? '{ unlockedAt: Date.now() }' : 'null'}; },
    unlock: async function(){ return true; }
  };`;
  await context.route('**/src/gate.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: stub }));
  // access.html only reaches Supabase after the passkey belt; stub is_admin defensively.
  await context.route('**/rpc/press_access_is_admin', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'false' }));
}

test('enrolled browser, no session: direct navigation shows the passkey gate, not the admin sign-in', async ({ page, context }) => {
  await stubVault(context, { enrolled: true, hasSession: false });
  await page.goto(base + '/access.html');
  await expect(page.getByRole('heading', { name: 'Private wing' })).toBeVisible();
  await expect(page.locator('#pk')).toBeVisible();                 // "Unlock with your passkey"
  await expect(page.locator('#em')).toHaveCount(0);                // admin email field NOT shown yet
});

test('enrolled browser WITH a live session: the passkey belt passes, admin sign-in is reached', async ({ page, context }) => {
  await stubVault(context, { enrolled: true, hasSession: true });
  await page.goto(base + '/access.html');
  // wing unlocked -> boot() -> no supabase session -> the admin OTP sign-in (RLS the lock)
  await expect(page.locator('#em')).toBeVisible();
  await expect(page.locator('#pk')).toHaveCount(0);
});

test('never-enrolled browser: no passkey belt, admin OTP sign-in shows (RLS still enforces admin)', async ({ page, context }) => {
  await stubVault(context, { enrolled: false, hasSession: false });
  await page.goto(base + '/access.html');
  await expect(page.getByRole('heading', { name: 'Access admin' })).toBeVisible();
  await expect(page.locator('#em')).toBeVisible();                 // admin email sign-in
  await expect(page.locator('#pk')).toHaveCount(0);                // no passkey gate on a public browser
});
