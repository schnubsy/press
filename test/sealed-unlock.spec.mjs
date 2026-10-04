// cardsharp Arc 7 slice 6 — the gate's SEALED 7-day unlock, end to end in a real browser.
// A stand-in MEMORY_ONLY app page (cardsharp.html) inlines src/gate.js exactly as a tenant build does; the REAL wing
// (index.html) is served beside it. After ONE passkey unlock: reload, wing-and-back, a second tab, tab switches and
// 10 min idle never re-prompt; 7 days + 1 min, the wing's "Lock now" and the app's own lock re-gate EVERY tab. A dump
// of localStorage + IndexedDB never holds the plaintext sync id or pass, and the IDB key is non-extractable.
// Hermetic: GitHub + Supabase intercepted; press_vault is an in-memory RLS-gated mock; a CDP virtual authenticator
// (PRF) drives the real WebAuthn unlock. WebKit (no virtual authenticator) proves the IDB seal survives a reload.
import { test, expect, webkit } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const GATE = readFileSync(join(ROOT, 'src', 'gate.js'), 'utf8');
const SYNC = 'c0ffee00c0ffee00c0ffee00c0ffee00'; // hermetic test-only values
const PASS = 'test-only-pass-phrase-cardsharp';
const DAY = 24 * 60 * 60 * 1000;
const appPage = (name) => `<!doctype html><meta charset="utf-8"><title>${name}</title><body>
<main id="app" hidden><p id="state">open</p></main><button id="signout">Sign out</button>
<script>${GATE}</script>
<script>
PressGate.guard({ page: ${JSON.stringify(name)},
  onUnlock: function (c) { document.getElementById('app').hidden = false; document.body.dataset.unlocked = String(!!(c && c.syncId)); },
  onLock: function () { document.getElementById('app').hidden = true; delete document.body.dataset.unlocked; } });
document.getElementById('signout').onclick = function () { PressVault.lock(); };
</script>`;

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const u = req.url;
    if (u.startsWith('/cardsharp.html')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(appPage('cardsharp.html')); return; }
    if (u.startsWith('/fsa.html')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(appPage('fsa.html')); return; }
    if (u === '/' || u.startsWith('/index.html') || u.startsWith('/?')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); return; }
    res.writeHead(404); res.end('nf');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`; // localhost, not an IP: WebAuthn rp.id
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

async function routes(context) {
  const vault = new Map();
  await context.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('https://raw.githubusercontent.com/**', (r) => {
    const u = r.request().url();
    if (u.endsWith('/spaces.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 1, personal: ['fsa.html', 'cardsharp.html'] }) });
    if (u.endsWith('/pages.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'fsa.html': { title: 'fsa' }, 'cardsharp.html': { title: 'cardsharp' } }) });
    return r.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/rest/v1/press_vault**', (route) => {
    const req = route.request(); const vid = req.headers()['x-vault-id'] || '';
    if (req.method() === 'GET') { const row = vault.get(vid); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); }
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.id !== vid) return route.fulfill({ status: 401, body: '{}' });
      vault.set(vid, body); return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([body]) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  // count every passkey assertion across all tabs (the user-visible "prompt")
  await context.addInitScript(() => {
    const og = navigator.credentials && navigator.credentials.get && navigator.credentials.get.bind(navigator.credentials);
    if (og) navigator.credentials.get = (o) => { localStorage.setItem('test:prompts', String(+(localStorage.getItem('test:prompts') || 0) + 1)); return og(o); };
  });
}
async function authenticator(context, page) {
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, hasPrf: true, isUserVerified: true, automaticPresenceSimulation: true } });
}
const prompts = (page) => page.evaluate(() => +(localStorage.getItem('test:prompts') || 0));
const open = async (page) => { await expect(page.locator('#press-gate')).toHaveCount(0); await expect(page.locator('#app')).toBeVisible(); };
const gated = async (page) => { await expect(page.locator('#press-gate')).toBeVisible(); await expect(page.locator('#app')).toBeHidden(); };
async function sealKey(page, tenant = 'cardsharp.html') {
  return page.evaluate((p) => new Promise((res) => {
    const o = indexedDB.open('press:vault:seal', 1);
    o.onupgradeneeded = () => o.result.createObjectStore('keys');
    o.onsuccess = () => { const db = o.result; const r = db.transaction('keys', 'readonly').objectStore('keys').get(p);
      r.onsuccess = async () => { db.close(); const k = r.result && r.result.key; if (!k) return res(null);
        let exportable = true; try { await crypto.subtle.exportKey('raw', k); } catch (e) { exportable = false; }
        res({ type: k.type, extractable: k.extractable, alg: k.algorithm.name, usages: [...k.usages], exportable }); }; };
  }), tenant);
}
const lsDump = (page) => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

// enrol (the wing's job) → lock → open the app → ONE passkey unlock through the gate
async function unlockOnce(page, context, { clock = false } = {}) {
  await routes(context);
  await authenticator(context, page);
  if (clock) await page.clock.install();
  await page.goto(base + '/cardsharp.html');
  await page.evaluate(async (kr) => { await PressVault.enrol({ label: 't', keyring: kr }); PressVault.lock(); },
    { v: 1, apps: { 'cardsharp.html': { sync_id: SYNC, pass: PASS }, 'fsa.html': { sync_id: 'a'.repeat(32), pass: 'fsa-test-pass' } } });
  await page.reload();
  await gated(page);
  await page.evaluate(() => localStorage.setItem('test:prompts', '0'));
  await page.locator('#pg-unlock').click();
  await open(page);
  await expect.poll(() => sealKey(page)).not.toBeNull();
  expect(await prompts(page)).toBe(1);
}

test('one unlock → reload, wing and back, a second tab, tab switches, 10 min idle: never a second prompt', async ({ page, context }) => {
  await unlockOnce(page, context, { clock: true });
  await page.reload(); await open(page);
  await page.goto(base + '/index.html?view=personal');
  await expect(page.locator('#lockBtn')).toBeVisible(); // the real wing, unlocked
  await page.goBack(); await open(page);
  await page.goto(base + '/cardsharp.html'); await open(page);
  const two = await context.newPage();
  await two.goto(base + '/cardsharp.html'); await open(two);
  await page.bringToFront(); await open(page);
  await two.bringToFront(); await two.reload(); await open(two);
  await page.clock.fastForward(10 * 60 * 1000);
  await open(page);
  await page.reload(); await open(page);
  expect(await prompts(page)).toBe(1);
  await two.close();
});

test('7 days + 1 minute → the gate returns in-tab and on reload; the seal and its key are gone', async ({ page, context }) => {
  await unlockOnce(page, context, { clock: true });
  await page.clock.fastForward(7 * DAY + 60_000);
  await gated(page);
  await page.reload(); await gated(page);
  expect((await lsDump(page))['press:vault:v1']).toBeUndefined();
  await expect.poll(() => sealKey(page)).toBeNull();
});

test('the wing\'s "Lock now" → every app tab re-gates; IDB key + ciphertext deleted; reload still gated', async ({ page, context }) => {
  await unlockOnce(page, context);
  const two = await context.newPage();
  await two.goto(base + '/cardsharp.html'); await open(two);
  const wing = await context.newPage();
  await wing.goto(base + '/index.html?view=personal');
  await wing.locator('#lockBtn').click();
  await gated(page); await gated(two);
  expect((await lsDump(page))['press:vault:v1']).toBeUndefined();
  await expect.poll(() => sealKey(page)).toBeNull();
  await page.reload(); await gated(page);
  await two.close(); await wing.close();
});

test('the app\'s own lock → every tab re-gates and the seal is deleted', async ({ page, context }) => {
  await unlockOnce(page, context);
  const two = await context.newPage();
  await two.goto(base + '/cardsharp.html'); await open(two);
  await two.locator('#signout').click();
  await gated(two); await gated(page);
  await expect.poll(() => sealKey(page)).toBeNull();
  await two.close();
});

test('a new session (re-unlocked in the wing) invalidates the old seal; an open app tab reseals onto a wing re-save', async ({ page, context }) => {
  await unlockOnce(page, context);
  const before = JSON.parse((await lsDump(page))['press:vault:v1']);
  const two = await context.newPage();
  await two.goto(base + '/cardsharp.html'); await open(two);
  await page.goto(base + '/index.html?view=personal'); // the wing, in the tab that holds the (virtual) passkey
  await page.locator('#lockBtn').click(); await gated(two);
  await page.locator('#unlockBtn').click(); // a NEW wing unlock (new unlockedAt)
  await expect(page.locator('#lockBtn')).toBeVisible();
  await two.reload(); await gated(two); // the old seal died with the old session: the app asks once more
  await expect.poll(() => sealKey(two)).toBeNull(); // …and its stale key is removed
  await page.goto(base + '/cardsharp.html'); await gated(page);
  await page.locator('#pg-unlock').click(); await open(page);
  const sealAt = async () => { const s = JSON.parse((await lsDump(page))['press:vault:v1']); const x = s.seal && s.seal['cardsharp.html']; return x && x.at === s.unlockedAt ? x.at : null; };
  await expect.poll(sealAt).not.toBeNull();
  expect(await sealAt()).not.toBe(before.unlockedAt);
  // a wing re-save (Connect's updateKeyring / another unlock) writes a NEW session without a seal → the open app
  // tab reseals onto it silently, so the next reload still needs no prompt
  const first = await sealAt();
  await two.evaluate(() => { const s = PressVault.loadSession(); PressVault.saveSession(s.keyring, s.vaultId); });
  await expect.poll(sealAt).not.toBe(first);
  await expect.poll(sealAt).not.toBeNull();
  await open(page);
  await page.reload(); await open(page);
  await two.reload(); await open(two);
  expect(await prompts(page)).toBe(3); // unlockOnce + wing + app — never on a reload
  await two.close();
});

test('localStorage + IndexedDB hold no plaintext sync id / pass; the key is a non-extractable AES-GCM key', async ({ page, context }) => {
  await unlockOnce(page, context);
  await page.reload(); await open(page);
  const ls = await lsDump(page);
  const key = await sealKey(page);
  expect(JSON.parse(ls['press:vault:v1']).seal['cardsharp.html'].ct).toBeTruthy();
  expect(key).toEqual({ type: 'secret', extractable: false, alg: 'AES-GCM', usages: ['encrypt', 'decrypt'], exportable: false });
  const dump = JSON.stringify({ ls, key });
  expect(dump).not.toContain(SYNC);
  expect(dump).not.toContain(PASS);
});

test('other tenants unchanged: fsa.html opens from the session and writes no seal', async ({ page, context }) => {
  await unlockOnce(page, context);
  const before = (await lsDump(page))['press:vault:v1'];
  await page.goto(base + '/fsa.html'); await open(page);
  expect((await lsDump(page))['press:vault:v1']).toBe(before);
  expect(await sealKey(page, 'fsa.html')).toBeNull();
});

test('no IndexedDB (private mode) → memory only, as before: a reload asks again', async ({ page, context }) => {
  await context.addInitScript(() => { try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {} });
  await routes(context);
  await authenticator(context, page);
  await page.goto(base + '/cardsharp.html');
  await page.evaluate(async (kr) => { await PressVault.enrol({ label: 't', keyring: kr }); PressVault.lock(); }, { v: 1, apps: { 'cardsharp.html': { sync_id: SYNC, pass: PASS } } });
  await page.reload();
  await page.locator('#pg-unlock').click(); await open(page);
  expect(JSON.parse((await lsDump(page))['press:vault:v1']).seal).toBeUndefined();
  await page.reload(); await gated(page);
});

test('WebKit: the IDB-held key survives a reload and unseals with no prompt; a lock deletes it', async () => {
  let browser;
  try { browser = await webkit.launch(); } catch (e) { test.skip(true, 'WebKit not installed: ' + String(e).slice(0, 80)); }
  try {
    const context = await browser.newContext();
    await routes(context);
    const page = await context.newPage();
    await page.goto(base + '/cardsharp.html');
    await gated(page);
    // no virtual authenticator in WebKit: mint the session as an unlock would (saveSession keeps the full keyring
    // in this page's memory), then the gate's storage watcher seals it
    await page.evaluate((kr) => { PressVault.saveSession(kr, 'webkit-vid'); dispatchEvent(new StorageEvent('storage', { key: 'press:vault:v1' })); },
      { v: 1, apps: { 'cardsharp.html': { sync_id: SYNC, pass: PASS } } });
    await expect.poll(async () => !!JSON.parse((await lsDump(page))['press:vault:v1']).seal).toBe(true);
    await page.reload();
    await open(page);
    expect(await page.evaluate(() => document.body.dataset.unlocked)).toBe('true');
    const dump = JSON.stringify({ ls: await lsDump(page), key: await sealKey(page) });
    expect(dump).not.toContain(SYNC); expect(dump).not.toContain(PASS);
    await page.locator('#signout').click();
    await gated(page);
    await expect.poll(() => sealKey(page)).toBeNull();
    await page.reload(); await gated(page);
  } finally { await browser.close(); }
});
