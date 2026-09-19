// test/connect.spec.mjs — the Private Wing "Connect your tools" flow + DEFECT 2 (always-unlock).
// Hermetic: index.html served from localhost; GitHub + Supabase intercepted. A CDP virtual
// authenticator with PRF drives the real enrol/unlock; press_fsa is an in-memory mock whose row
// decrypts under a known passphrase, so "verify before store" runs against real crypto.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setupVirtualAuthenticator, buildEnvelope, enrolInPage } from '../src/gate.testkit.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const PUBLIC_FILES = ['council-guide.html', 'agent-health.html'];
const PERSONAL_FILES = ['fsa.html', 'giving.html', 'retirement.html', 'card-scout.html'];
const MANIFEST = Object.fromEntries([...PUBLIC_FILES, ...PERSONAL_FILES].map((f) => [f, { title: f.replace(/\.html$/, '') }]));
const SPACES = { v: 1, personal: PERSONAL_FILES };

const SYNC = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const PASS = 'zzzzz-yyyyy-xxxxx-wwwww';
const DOC = { v: 2, hello: 'fsa', years: { '2026': { claims: [] } } };

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise((r) => server.close(r)); });

async function harness(page, context) {
  const state = { vault: new Map(), fsaEnv: null, fsaGets: 0 };
  await context.route('https://api.github.com/**', (route) => {
    const body = [...PUBLIC_FILES, ...PERSONAL_FILES, 'index.html'].map((name) => ({ type: 'file', name }));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await context.route('https://raw.githubusercontent.com/**', (route) => {
    const u = route.request().url();
    if (u.endsWith('/spaces.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) });
    if (u.endsWith('/pages.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) });
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/press_portal**', (route) => route.fulfill({ status: route.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
  // press_vault — in-memory, x-vault-id gated
  await context.route('**/rest/v1/press_vault**', (route) => {
    const req = route.request(); const method = req.method(); const vid = req.headers()['x-vault-id'] || '';
    if (method === 'GET') { const row = state.vault.get(vid); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); }
    if (method === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (!body.id || body.id !== vid) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"42501"}' });
      const row = { ...body, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      state.vault.set(body.id, row);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([row]) });
    }
    route.fulfill({ status: 204, body: '' });
  });
  // press_fsa — one row for SYNC only; header-gated (mismatch → empty, like real RLS)
  await context.route('**/rest/v1/press_fsa**', (route) => {
    state.fsaGets++;
    const u = route.request().url();
    const m = u.match(/sync_id=eq\.([0-9a-fA-F]+)/);
    const sid = m ? m[1] : '';
    const rows = (sid === SYNC && state.fsaEnv) ? [{ doc: state.fsaEnv, version: 1 }] : [];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
  });
  await setupVirtualAuthenticator(context, page);
  return state;
}

// enrol an EMPTY keyring (the real live situation) then reload into the unlocked wing.
async function enrolEmptyAndOpen(page, state) {
  await page.goto(base + '/?view=personal');
  state.fsaEnv = await buildEnvelope(page, { doc: DOC, passphrase: PASS });
  await enrolInPage(page, { apps: { 'fsa.html': { sync_id: '', pass: '' }, 'giving.html': { sync_id: '', pass: '' }, 'retirement.html': { sync_id: '', pass: '' }, 'card-scout.html': { sync_id: '' } } });
  await page.reload();
  await expect(page.locator('.tw-connect')).toBeVisible();
}

function fsaTool(page) { return page.locator('.tw-tool[data-f="fsa.html"]'); }

test('DEFECT 2: locked wing shows "Use your passkey" as the primary action', async ({ page, context }) => {
  await harness(page, context);
  await page.goto(base + '/?view=personal');
  await expect(page.locator('#unlockBtn')).toHaveText('Use your passkey');
  await expect(page.locator('#setupLink')).toBeVisible(); // setup is the secondary link
});

test('DEFECT 2: a second device (reachable row, no local flag) adopts via Setup — never creates an empty duplicate row', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/?view=personal');
  await enrolInPage(page, { apps: { 'fsa.html': { sync_id: '', pass: '' } } }); // row + credential exist
  expect([...state.vault.values()].length).toBe(1);
  // simulate a fresh device/browser: drop the local session + enrolled flag, keep the synced passkey
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#unlockBtn')).toHaveText('Use your passkey');
  page.on('dialog', (d) => d.accept());
  await page.locator('#setupLink').click();        // Setup must ADOPT the reachable row, not enrol a new empty one
  await expect(page.locator('.tw-connect')).toBeVisible(); // unlocked
  expect([...state.vault.values()].length).toBe(1);        // STILL one row — no empty duplicate
});

test('connect fsa: verify against real data, then seal into the keyring; status flips to connected', async ({ page, context }) => {
  const state = await harness(page, context);
  await enrolEmptyAndOpen(page, state);

  const tool = fsaTool(page);
  await expect(tool.locator('.tw-tool-status')).toContainText('not connected');
  await tool.locator('.tw-conn-toggle').click();
  await tool.locator('.tw-sync').fill(SYNC);
  await tool.locator('.tw-pass').fill(PASS);
  await tool.locator('.tw-verify').click();

  await expect(tool.locator('.tw-tool-msg')).toContainText('Connected');
  await expect(tool.locator('.tw-tool-status')).toContainText('connected');
  await expect(tool.locator('.tw-dl')).toBeVisible(); // download offered immediately

  // sealed into the keyring (in memory) AND persisted to the vault row (re-sealed, not re-keyed)
  const kr = await page.evaluate(() => window.PressVault.loadSession().keyring.apps['fsa.html']);
  expect(kr).toEqual({ sync_id: SYNC, pass: PASS });
  // the vault row now holds a POPULATED keyring (ciphertext changed length from the empty 244)
  const rows = [...state.vault.values()];
  expect(rows.length).toBe(1);
  expect(rows[0].ciphertext.length).toBeGreaterThan(244);
});

test('connect fsa with the WRONG passphrase: distinct message, nothing stored', async ({ page, context }) => {
  const state = await harness(page, context);
  await enrolEmptyAndOpen(page, state);
  const tool = fsaTool(page);
  await tool.locator('.tw-conn-toggle').click();
  await tool.locator('.tw-sync').fill(SYNC);
  await tool.locator('.tw-pass').fill('wrong-wrong-wrong-wrong');
  await tool.locator('.tw-verify').click();
  await expect(tool.locator('.tw-tool-msg')).toContainText('did not open the data');
  await expect(tool.locator('.tw-tool-msg')).not.toContainText('Connected');
  const kr = await page.evaluate(() => window.PressVault.loadSession().keyring.apps['fsa.html']);
  expect(kr).toEqual({ sync_id: '', pass: '' }); // unchanged — never store unverified
});

test('connect fsa with an UNKNOWN sync id: row-not-found message, distinct from a bad passphrase', async ({ page, context }) => {
  const state = await harness(page, context);
  await enrolEmptyAndOpen(page, state);
  const tool = fsaTool(page);
  await tool.locator('.tw-conn-toggle').click();
  await tool.locator('.tw-sync').fill('00000000000000000000000000000000');
  await tool.locator('.tw-pass').fill(PASS);
  await tool.locator('.tw-verify').click();
  await expect(tool.locator('.tw-tool-msg')).toContainText('No data found for that sync id');
});
