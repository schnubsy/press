// SLICE 3 — the two-space marquee smoke test.
// Hermetic: index.html is served from localhost; GitHub + Supabase are intercepted so
// NOTHING touches production. press_vault is an in-memory, RLS-gated (x-vault-id) mock.
// A CDP virtual authenticator with PRF drives the real WebAuthn enrol/unlock path.

import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');

const PUBLIC_FILES = ['council-guide.html', 'kayley.html', 'eagle-path.html', 'halvsies.html', 'agent-health.html'];
const PERSONAL_FILES = ['fsa.html', 'giving.html', 'retirement.html', 'card-scout.html'];
const MANIFEST = Object.fromEntries([...PUBLIC_FILES, ...PERSONAL_FILES].map(f => [f, { title: f.replace(/\.html$/, '') }]));
const SPACES = { v: 1, personal: PERSONAL_FILES };

let server, base;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/index.html') || req.url.startsWith('/?')) {
      res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); return;
    }
    res.writeHead(404); res.end('not found');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  // navigate via localhost (NOT 127.0.0.1): WebAuthn forbids an IP address as rp.id,
  // but treats localhost as a secure context with rp.id 'localhost'.
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

// Per-test fixtures: a virtual authenticator + intercepts + a vault-request counter.
async function harness(page, context) {
  const state = { vaultRequests: 0, vault: new Map() };

  // --- GitHub contents (listPages) ---
  await context.route('https://api.github.com/**', route => {
    const url = route.request().url();
    if (url.includes('/contents/archive')) { route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    const body = [...PUBLIC_FILES, ...PERSONAL_FILES, 'index.html'].map(name => ({ type: 'file', name }));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  // --- raw manifests + spaces.json ---
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  // --- press_portal (sort/archive state) — empty, writable ---
  await context.route('**/rest/v1/press_portal**', route => {
    const m = route.request().method();
    if (m === 'GET') { route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  // --- press_vault — in-memory, RLS-gated on x-vault-id ---
  await context.route('**/rest/v1/press_vault**', route => {
    state.vaultRequests++;
    const req = route.request();
    const method = req.method();
    const vid = req.headers()['x-vault-id'] || '';
    if (method === 'GET') {
      const row = state.vault.get(vid);
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
      return;
    }
    if (method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (!body.id || body.id !== vid) { // WITH CHECK: id must equal the presented header
        route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'row-level security' }) });
        return;
      }
      const row = { ...body, kdf: body.kdf || 'hkdf-sha256', version: body.version || 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      state.vault.set(body.id, row);
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
      return;
    }
    if (method === 'DELETE') {
      const row = state.vault.get(vid);
      if (row) state.vault.delete(vid);
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) });
      return;
    }
    route.fulfill({ status: 204, body: '' });
  });

  // --- CDP virtual authenticator with PRF ---
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2', transport: 'internal',
      hasResidentKey: true, hasUserVerification: true, hasPrf: true,
      isUserVerified: true, automaticPresenceSimulation: true,
    },
  });
  return state;
}

test('landing shows the two-space marquee and makes ZERO vault calls (not set up)', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/');
  const secure = page.locator('.tw-secure');
  await expect(secure).toBeVisible();
  await expect(secure.locator('h3')).toHaveText('The Private Wing');
  await expect(secure.locator('.lockline')).toContainText('Set up the private wing');
  // public cards present; personal files NOT among them
  const fns = await page.locator('.tw-card .fn').allTextContents();
  for (const p of PERSONAL_FILES) expect(fns).not.toContain(p);
  for (const p of PUBLIC_FILES) expect(fns).toContain(p);
  // landing header counts only public cards
  await expect(page.locator('.tw-top span').last()).toContainText(`${PUBLIC_FILES.length} showing`);
  expect(state.vaultRequests).toBe(0);

  // archive view also makes zero vault calls
  await page.goto(base + '/?view=archive');
  await expect(page.locator('h2.tw-title')).toBeVisible();
  expect(state.vaultRequests).toBe(0);
});

test('enrol → 4 cards → lock → unlock → lock (full private-wing flow)', async ({ page, context }, testInfo) => {
  const state = await harness(page, context);
  await page.goto(base + '/?view=personal');

  // locked + not enrolled → "Set up the private wing"
  await expect(page.locator('#unlockBtn')).toHaveText('Set up the private wing');
  await page.locator('#unlockBtn').click();

  // enrol resolves → unlocked → the four personal cards render
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);
  const fns = await page.locator('.tw-card .fn').allTextContents();
  for (const p of PERSONAL_FILES) expect(fns).toContain(p);
  await expect(page.locator('#lockBtn')).toBeVisible();
  expect(state.vault.size).toBe(1); // exactly one enrolled row written
  await page.screenshot({ path: 'docs/evidence/two-space-personal-unlocked.png', fullPage: true });

  // lock now → locked panel, now enrolled → "Use your passkey"
  await page.locator('#lockBtn').click();
  await expect(page.locator('.tw-unlock')).toBeVisible();
  await expect(page.locator('#unlockBtn')).toHaveText('Use your passkey');
  await page.screenshot({ path: 'docs/evidence/two-space-personal-locked.png', fullPage: true });

  // unlock with the discoverable passkey → four cards again
  await page.locator('#unlockBtn').click();
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);

  // landing now reads Unlocked, and loading it issues NO new vault request
  const before = state.vaultRequests;
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure .lockline')).toContainText('Unlocked');
  await expect(page.locator('.tw-secure .lockline')).toContainText(`${PERSONAL_FILES.length} tools`);
  expect(state.vaultRequests).toBe(before);
});

test('landing screenshots — desktop + mobile (two-space)', async ({ page, context }) => {
  await harness(page, context);
  await page.setViewportSize({ width: 900, height: 1200 });
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure')).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/marquee-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure')).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/marquee-mobile.png', fullPage: true });
});
