// arc/passkey-only Slice 1 — "Protect your local tools" (kind:'local').
// Retirement is local-only (press_retirement has 0 rows; sync never enabled), so it seals a
// per-tool data_key INSIDE the sealed keyring instead of a sync_id/passphrase. Hermetic +
// ADDITIVE — this file does not touch the Connect specs. It verifies:
//   - the Protect UI exists with the not-backed-up warning; retirement is NOT a Connect tool
//   - Protect seals a 32-byte data_key; the FROZEN entry is exactly { v:1, data_key }
//   - the WRITE PATH structurally refuses to replace an existing data_key (idempotent), proven
//     by calling protectTool() twice and asserting the key is byte-identical
//   - the data_key survives lock -> unlock
//   - a passkey enrolled AFTER Protect INHERITS the same real data_key (the resequence guarantee)
// press_vault is an in-memory, RLS-gated (x-vault-id) mock; a CDP virtual authenticator drives
// the real WebAuthn enrol/unlock/addPasskey path. NOTHING touches production.

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
    res.writeHead(404); res.end('nf');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`; // localhost (not 127.0.0.1) for WebAuthn rp.id
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

async function harness(page, context) {
  const state = { vault: new Map() };
  await context.route('https://api.github.com/**', route => {
    const url = route.request().url();
    if (url.includes('/contents/archive')) { route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...PUBLIC_FILES, ...PERSONAL_FILES, 'index.html'].map(name => ({ type: 'file', name }))) });
  });
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/press_portal**', route => {
    const m = route.request().method();
    route.fulfill({ status: m === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' });
  });
  await context.route('**/rest/v1/press_deals**', route => { // card-scout probe (unused at load); never hit production
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await context.route('**/rest/v1/press_vault**', route => {
    const req = route.request(), method = req.method(), vid = req.headers()['x-vault-id'] || '';
    if (method === 'GET') { const row = state.vault.get(vid); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); return; }
    if (method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (!body.id || body.id !== vid) { route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: '42501', message: 'rls' }) }); return; }
      const row = { ...body, kdf: body.kdf || 'hkdf-sha256', version: body.version || 1 };
      state.vault.set(body.id, row);
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) }); return;
    }
    if (method === 'DELETE') { const row = state.vault.get(vid); if (row) state.vault.delete(vid); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); return; }
    route.fulfill({ status: 204, body: '' });
  });
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, hasPrf: true, isUserVerified: true, automaticPresenceSimulation: true },
  });
  return state;
}

async function enrolAndOpen(page, context) {
  const state = await harness(page, context);
  page.on('dialog', d => d.accept());
  await page.goto(base + '/?view=personal');
  await page.waitForFunction(() => !!window.PressVault);
  await page.locator('#setupLink').click(); // first-time enrol
  await expect(page.locator('.tw-card')).toHaveCount(PERSONAL_FILES.length);
  return state;
}

test('the wing shows "Protect your local tools" with a not-backed-up warning; retirement is NOT a Connect tool', async ({ page, context }) => {
  await enrolAndOpen(page, context);
  const protect = page.locator('.tw-protect');
  await expect(protect).toBeVisible();
  await expect(protect.locator('h4')).toHaveText('Protect your local tools');
  await expect(protect).toContainText('not backed up anywhere');
  await expect(protect).toContainText('cannot be recovered');
  await expect(protect.locator('.tw-ptool[data-f="retirement.html"] .tw-protect-btn')).toHaveText('Protect this tool');
  // retirement is NOT in the Connect list; the other three kinds stay there, unaffected
  const connect = page.locator('.tw-connect');
  await expect(connect.locator('.tw-tool[data-f="retirement.html"]')).toHaveCount(0);
  await expect(connect.locator('.tw-tool[data-f="fsa.html"]')).toHaveCount(1);
  await expect(connect.locator('.tw-tool[data-f="giving.html"]')).toHaveCount(1);
  await expect(connect.locator('.tw-tool[data-f="card-scout.html"]')).toHaveCount(1);
  // no passphrase field anywhere in the Protect block
  await expect(protect.locator('input[type="password"]')).toHaveCount(0);
});

test('Protect seals the FROZEN { v:1, data_key } (32-byte key); status flips to protected', async ({ page, context }) => {
  await enrolAndOpen(page, context);
  await page.locator('.tw-ptool[data-f="retirement.html"] .tw-protect-btn').click();
  await expect(page.locator('.tw-ptool[data-f="retirement.html"] .tw-tool-status')).toHaveText('● protected');
  const info = await page.evaluate(() => {
    const entry = PressVault.loadSession().keyring.apps['retirement.html'];
    const dk = entry.data_key;
    const b64 = dk.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    return { keys: Object.keys(entry).sort(), v: entry.v, hasKey: !!dk, bytes: bin.length };
  });
  expect(info.hasKey).toBe(true);
  expect(info.bytes).toBe(32);
  expect(info.v).toBe(1);
  expect(info.keys).toEqual(['data_key', 'v']); // exactly { v, data_key } — no placeholder carried forward
});

test('the write path STRUCTURALLY refuses to replace a live data_key (protectTool twice is byte-identical)', async ({ page, context }) => {
  await enrolAndOpen(page, context);
  const res = await page.evaluate(async () => {
    const a = await protectTool('retirement.html');
    const b = await protectTool('retirement.html'); // second call must NOT regenerate
    const onDisk = PressVault.loadSession().keyring.apps['retirement.html'].data_key;
    return { a, b, onDisk };
  });
  expect(res.a.already).toBe(false);
  expect(res.b.already).toBe(true);
  expect(res.b.data_key).toBe(res.a.data_key);
  expect(res.onDisk).toBe(res.a.data_key);
});

test('the data_key survives lock -> unlock', async ({ page, context }) => {
  await enrolAndOpen(page, context);
  const before = await page.evaluate(async () => (await protectTool('retirement.html')).data_key);
  await page.evaluate(() => PressVault.lock());
  const after = await page.evaluate(async () => {
    const r = await PressVault.unlock();
    return r.keyring.apps['retirement.html'].data_key;
  });
  expect(after).toBe(before);
});

test('RESEQUENCE GUARANTEE: a passkey enrolled AFTER Protect inherits the real data_key (not a placeholder)', async ({ page, context }) => {
  const state = await enrolAndOpen(page, context);
  const row1 = [...state.vault.keys()][0];
  const dk = await page.evaluate(async () => (await protectTool('retirement.html')).data_key);
  expect(dk).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(state.vault.size).toBe(1);

  const post = await page.evaluate(async () => {
    await PressVault.addPasskey({ label: 'second-device' });
    const sess = PressVault.loadSession();
    const e = sess.keyring.apps['retirement.html'] || {};
    return { vaultId: sess.vaultId, dk: e.data_key };
  });
  expect(state.vault.size).toBe(2);                  // a NEW row was written
  expect(post.vaultId).not.toBe(row1);               // active session is now the NEW credential's row
  expect(state.vault.has(post.vaultId)).toBe(true);  // that new row is stored
  expect(post.dk).toBe(dk);                           // the NEW row's keyring carries the SAME real data_key

  const opened = await page.evaluate(async () => {
    PressVault.lock();
    const r = await PressVault.unlock();
    const e = r.keyring.apps['retirement.html'] || {};
    return e.data_key;
  });
  expect(opened).toBe(dk); // ciphertext round-trip: a stored row decrypts back to the same key
});
