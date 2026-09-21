// test/connect.spec.mjs — the Private Wing "Connect your tools" flow, collapse behaviour,
// Card Scout (sync-id-only, press_deals probe) + DEFECT 2 (always-unlock).
// Hermetic: index.html served from localhost; GitHub + Supabase intercepted. A CDP virtual
// authenticator with PRF drives the real enrol/unlock; press_fsa is an in-memory mock whose row
// decrypts under a known passphrase and press_deals mirrors the header-gated RLS (a wrong
// x-plan-id returns a 200 with ZERO rows), so "verify before store" runs against real behaviour.
import { test, expect, devices } from '@playwright/test';
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

const SYNC = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';     // fsa sync id (throwaway)
const PASS = 'zzzzz-yyyyy-xxxxx-wwwww';               // fsa passphrase (throwaway)
const DOC = { v: 2, hello: 'fsa', years: { '2026': { claims: [] } } };
const CARD_SYNC = 'c1a2r3d4e5f6a7b8c9d0e1f2a3b4c5d6';  // throwaway card-scout sync id the deals mock accepts
const CARD_WRONG = '00000000000000000000000000000000';
const CARD_SCOUT_GATE_SENTINEL = 'not-a-secret:card-scout-has-no-passphrase:sentinel-only-to-satisfy-credsFor'; // MUST match index.html

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise((r) => server.close(r)); });

async function harness(page, context) {
  const state = { vault: new Map(), fsaEnv: null, fsaGets: 0, dealsGets: 0 };
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
  // press_deals — header-gated on x-plan-id = card-scout sync_id. A WRONG key returns a 200 with
  // ZERO rows (RLS filters, never errors) — the trap the connect flow must NOT read as success.
  await context.route('**/rest/v1/press_deals**', (route) => {
    state.dealsGets++;
    const sid = route.request().headers()['x-plan-id'] || '';
    const rows = (sid === CARD_SYNC) ? [{ item_id: 'deal-1' }] : [];
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

// enrol a keyring where fsa is ALREADY connected — so its row renders collapsed on open.
async function enrolFsaConnectedAndOpen(page, state) {
  await page.goto(base + '/?view=personal');
  state.fsaEnv = await buildEnvelope(page, { doc: DOC, passphrase: PASS });
  await enrolInPage(page, { apps: { 'fsa.html': { sync_id: SYNC, pass: PASS }, 'giving.html': { sync_id: '', pass: '' }, 'retirement.html': { sync_id: '', pass: '' }, 'card-scout.html': { sync_id: '' } } });
  await page.reload();
  await expect(page.locator('.tw-connect')).toBeVisible();
}

const tool = (page, f) => page.locator(`.tw-tool[data-f="${f}"]`);

// ── DEFECT 2 (unlock/setup, viewport-independent) ──────────────────────────
test('DEFECT 2: locked wing shows "Use your passkey" as the primary action', async ({ page, context }) => {
  await harness(page, context);
  await page.goto(base + '/?view=personal');
  await expect(page.locator('#unlockBtn')).toHaveText('Use your passkey');
  await expect(page.locator('#setupLink')).toBeVisible();
});

test('DEFECT 2: a second device (reachable row, no local flag) adopts via Setup — never creates an empty duplicate row', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/?view=personal');
  await enrolInPage(page, { apps: { 'fsa.html': { sync_id: '', pass: '' } } });
  expect([...state.vault.values()].length).toBe(1);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#unlockBtn')).toHaveText('Use your passkey');
  page.on('dialog', (d) => d.accept());
  await page.locator('#setupLink').click();
  await expect(page.locator('.tw-connect')).toBeVisible();
  expect([...state.vault.values()].length).toBe(1);
});

// ── Connect / collapse / Card Scout — run at desktop AND iPhone 15 width ────
const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'iPhone 15', viewport: devices['iPhone 15'].viewport }, // chromium engine, phone-width layout
];

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: vp.viewport });

    test('a NOT-connected app shows its full form, expanded by default', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'fsa.html');
      await expect(t.locator('.tw-tool-status')).toContainText('not connected');
      await expect(t.locator('.tw-tool-form')).toBeVisible();       // expanded, no click needed
      await expect(t.locator('.tw-sync')).toBeVisible();
      await expect(t.locator('.tw-pass')).toHaveCount(1);           // app-kind has a passphrase field
      await expect(t.locator('.tw-reconnect')).toHaveCount(0);      // nothing to reconnect yet
    });

    test('a CONNECTED app renders as a quiet collapsed line — fields are NOT in the DOM', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolFsaConnectedAndOpen(page, state);
      const t = tool(page, 'fsa.html');
      await expect(t.locator('.tw-tool-status')).toContainText('Connected');
      await expect(t.locator('.tw-sync')).toHaveCount(0);           // form absent from the DOM
      await expect(t.locator('.tw-pass')).toHaveCount(0);
      const rc = t.locator('.tw-reconnect');
      await expect(rc).toBeVisible();
      await expect(rc).toHaveText('Reconnect');
      await expect(rc).toHaveAttribute('aria-expanded', 'false');
    });

    test('Reconnect expands the row in place (fields appear, first focused), then re-collapses and clears', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolFsaConnectedAndOpen(page, state);
      const t = tool(page, 'fsa.html');
      const rc = t.locator('.tw-reconnect');
      await rc.click();
      await expect(t.locator('.tw-sync')).toBeVisible();
      await expect(rc).toHaveAttribute('aria-expanded', 'true');
      await expect(t.locator('.tw-sync')).toBeFocused();            // first field focused on expand
      await t.locator('.tw-sync').fill('typed-value');
      await rc.click();                                             // collapse again
      await expect(t.locator('.tw-sync')).toHaveCount(0);           // fields (and the typed value) removed from the DOM
      await expect(rc).toHaveAttribute('aria-expanded', 'false');
      await rc.click();                                             // re-expand: the field is empty, not the stale value
      await expect(t.locator('.tw-sync')).toHaveValue('');
    });

    test('Card Scout row: sync-id field ONLY (no passphrase input)', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'card-scout.html');
      await expect(t.locator('.tw-tool-form')).toBeVisible();
      await expect(t.locator('.tw-sync')).toHaveCount(1);
      await expect(t.locator('.tw-pass')).toHaveCount(0);           // NO passphrase input for card-scout
    });

    test('Card Scout: a WRONG sync id (200 + zero rows) is rejected with the plain-language message; nothing stored', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'card-scout.html');
      await t.locator('.tw-sync').fill(CARD_WRONG);
      await t.locator('.tw-verify').click();
      await expect(t.locator('.tw-tool-msg')).toContainText("doesn't open Card Scout's deals");
      await expect(t.locator('.tw-tool-msg')).not.toContainText('Connected');
      const kr = await page.evaluate(() => window.PressVault.loadSession().keyring.apps['card-scout.html']);
      expect(kr).toEqual({ sync_id: '' });                          // unchanged — never store an unverified key
    });

    test('Card Scout: a CORRECT sync id connects; keyring holds sync_id + inert gate sentinel pass; row collapses', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'card-scout.html');
      await t.locator('.tw-sync').fill(CARD_SYNC);
      await t.locator('.tw-verify').click();
      await expect(t.locator('.tw-tool-msg')).toContainText('Connected');
      await expect(t.locator('.tw-tool-status')).toContainText('Connected');
      const kr = await page.evaluate(() => window.PressVault.loadSession().keyring.apps['card-scout.html']);
      expect(kr).toEqual({ sync_id: CARD_SYNC, pass: CARD_SCOUT_GATE_SENTINEL }); // sync_id + inert gate sentinel (satisfies the shared gate's credsFor)
      // and its connected state collapses like the others: Cancel closes it back to the quiet line
      const rc = t.locator('.tw-reconnect');
      await expect(rc).toBeVisible();
      await rc.click();
      await expect(t.locator('.tw-sync')).toHaveCount(0);
    });

    test('connect fsa: verify against real data, then seal into the keyring; status flips to Connected', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'fsa.html');
      await expect(t.locator('.tw-tool-status')).toContainText('not connected');
      await t.locator('.tw-sync').fill(SYNC);
      await t.locator('.tw-pass').fill(PASS);
      await t.locator('.tw-verify').click();
      await expect(t.locator('.tw-tool-msg')).toContainText('Connected');
      await expect(t.locator('.tw-tool-status')).toContainText('Connected');
      await expect(t.locator('.tw-dl')).toBeVisible();
      const kr = await page.evaluate(() => window.PressVault.loadSession().keyring.apps['fsa.html']);
      expect(kr).toEqual({ sync_id: SYNC, pass: PASS });
      const rows = [...state.vault.values()];
      expect(rows.length).toBe(1);
      expect(rows[0].ciphertext.length).toBeGreaterThan(244);
    });

    test('connect fsa with the WRONG passphrase: distinct message, nothing stored', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'fsa.html');
      await t.locator('.tw-sync').fill(SYNC);
      await t.locator('.tw-pass').fill('wrong-wrong-wrong-wrong');
      await t.locator('.tw-verify').click();
      await expect(t.locator('.tw-tool-msg')).toContainText('did not open the data');
      await expect(t.locator('.tw-tool-msg')).not.toContainText('Connected');
      const kr = await page.evaluate(() => window.PressVault.loadSession().keyring.apps['fsa.html']);
      expect(kr).toEqual({ sync_id: '', pass: '' });
    });

    test('connect fsa with an UNKNOWN sync id: row-not-found message, distinct from a bad passphrase', async ({ page, context }) => {
      const state = await harness(page, context);
      await enrolEmptyAndOpen(page, state);
      const t = tool(page, 'fsa.html');
      await t.locator('.tw-sync').fill('00000000000000000000000000000000');
      await t.locator('.tw-pass').fill(PASS);
      await t.locator('.tw-verify').click();
      await expect(t.locator('.tw-tool-msg')).toContainText('No data found for that sync id');
    });
  });
}
