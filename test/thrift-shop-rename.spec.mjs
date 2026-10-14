// test/thrift-shop-rename.spec.mjs — the Card Scout → Thrift Shop rename (thrift-shop arc/thrift-shop-rename, 2026-10-14).
// Hermetic: the REAL press root (index.html, thrift-shop.html, the card-scout.html stub, steward.html) is served from
// localhost; GitHub + Supabase are intercepted. Proves the slice-2 done-criteria:
//   (a) the portal shows a "Thrift Shop" card linking to thrift-shop.html — and the card-scout.html stub is never a card;
//   (b) a session whose keyring holds apps["card-scout.html"] (the real enrolled shape) shows Thrift Shop CONNECTED in
//       the wing and opens thrift-shop.html unlocked (no re-enrolment) — the alias is load-bearing;
//   (c) /card-scout.html#sources lands on /thrift-shop.html#sources;
//   (d) steward.html (borrows the same capability) still unlocks.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { shape } from '../supabase/functions/steward-reports/core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'pages.json'), 'utf8'));
const SPACES = JSON.parse(readFileSync(join(ROOT, 'spaces.json'), 'utf8'));
const SYNC = 'c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6';   // throwaway capability the mocks accept
const SENTINEL = 'not-a-secret:card-scout-has-no-passphrase:sentinel-only-to-satisfy-credsFor';

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') || 'index.html';
    const f = join(ROOT, p);
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': f.endsWith('.js') || f.endsWith('.mjs') ? 'text/javascript' : 'text/html' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise((r) => server.close(r)); });

// the real enrolled shape: the keyring entry is still keyed "card-scout.html"
function session(apps) {
  const now = Date.now();
  return JSON.stringify({ keyring: { v: 1, apps }, unlockedAt: now, expiresAt: now + 7 * 864e5, vaultId: 'rename-spec' });
}
async function routes(context, sess) {
  await context.route('https://api.github.com/**', (route) => {
    if (route.request().url().includes('/contents/archive')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    // the repo root as GitHub lists it after the publish: every page + the card-scout.html redirect stub + index.html
    const body = [...Object.keys(PAGES), 'card-scout.html', 'index.html'].map((name) => ({ type: 'file', name }));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await context.route('https://raw.githubusercontent.com/**', (route) => {
    const u = route.request().url();
    if (u.endsWith('/spaces.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) });
    if (u.endsWith('/pages.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAGES) });
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/**', (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/functions/v1/**', (route) => {
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'content-type, x-plan-id, apikey, authorization, x-card-scout-secret', 'access-control-allow-methods': 'POST, GET, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const ok = (route.request().headers()['x-plan-id'] || '') === SYNC;
    if (route.request().url().includes('steward-reports')) {
      return route.fulfill({ status: ok ? 200 : 401, headers: cors, contentType: 'application/json', body: JSON.stringify(ok ? shape([]) : { error: 'unauthorized' }) });
    }
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '{}' });
  });
  await context.addInitScript((s) => { try { localStorage.setItem('press:vault:enrolled', '1'); if (s) localStorage.setItem('press:vault:v1', s); } catch (e) {} }, sess || null);
}

test('(a) the landing never shows the card-scout.html stub; the Private Wing card is "Thrift Shop" → thrift-shop.html', async ({ page, context }) => {
  await routes(context, session({ 'card-scout.html': { sync_id: SYNC, pass: SENTINEL } }));
  await page.goto(base + '/');
  await expect(page.locator('.tw-card').first()).toBeVisible();
  await expect(page.locator('.tw-card[data-file="card-scout.html"]')).toHaveCount(0);   // a redirect stub is not a page
  await expect(page.locator('body')).not.toContainText('Card Scout');
  await page.goto(base + '/?view=personal');
  const card = page.locator('.tw-card[data-file="thrift-shop.html"]');
  await expect(card.locator('h3')).toHaveText('Thrift Shop');
  await expect(card.locator('.k')).toHaveText(/^Deals(\s*new)?$/);
  await expect(card).toHaveAttribute('href', 'thrift-shop.html');
  await expect(page.locator('.tw-card[data-file="card-scout.html"]')).toHaveCount(0);
  await expect(page.locator('.tw-card')).toHaveCount(SPACES.personal.length);
  await expect(card.locator('.ticon svg path')).toHaveCount(3);                          // the Drop Bag glyph
});

test('(b) keyring apps["card-scout.html"] = Thrift Shop CONNECTED in the wing, and thrift-shop.html opens unlocked', async ({ page, context }) => {
  await routes(context, session({ 'card-scout.html': { sync_id: SYNC, pass: SENTINEL }, 'fsa.html': { sync_id: '', pass: '' } }));
  await page.goto(base + '/?view=personal');
  const row = page.locator('.tw-tool[data-f="thrift-shop.html"]');
  await expect(row.locator('.tw-tool-name')).toHaveText('Thrift Shop');
  await expect(row.locator('.tw-tool-status')).toHaveText('● Connected');
  await expect(row.locator('.tw-sync')).toHaveCount(0);                                  // connected rows sit quiet
  await expect(page.locator('.tw-tool[data-f="card-scout.html"]')).toHaveCount(0);
  // tap the card → the app, past the gate on the same keyring entry (no re-enrol)
  await page.locator('.tw-card[data-file="thrift-shop.html"]').click();
  await expect(page).toHaveURL(/\/thrift-shop\.html$/);
  await expect(page.locator('#press-gate')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Thrift Shop', level: 1 })).toBeVisible();
});

test('(b′) the alias is load-bearing: a keyring keyed only "thrift-shop.html" is NOT connected and the app stays gated', async ({ page, context }) => {
  await routes(context, session({ 'thrift-shop.html': { sync_id: SYNC, pass: SENTINEL }, 'fsa.html': { sync_id: '', pass: '' } }));
  await page.goto(base + '/?view=personal');
  await expect(page.locator('.tw-tool[data-f="thrift-shop.html"] .tw-tool-status')).toHaveText('○ not connected');
  await page.goto(base + '/thrift-shop.html');
  await expect(page.locator('#press-gate')).toBeVisible();
});

test('(b″) connecting from the wing seals under the enrolled keyring id card-scout.html', async ({ page, context }) => {
  await routes(context, session({ 'card-scout.html': { sync_id: '' }, 'fsa.html': { sync_id: '', pass: '' } }));
  await context.route('**/rest/v1/press_deals**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[{"item_id":"x"}]' }));
  await context.route('**/rest/v1/press_vault**', (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 204, contentType: 'application/json', body: '[]' }));
  await page.goto(base + '/?view=personal');
  await page.waitForFunction(() => !!(window.PressVault && window.PressVault.updateKeyring));
  // keep the vault write local: the spec proves WHICH keyring key is written, not the sealing (connect.spec covers that)
  await page.evaluate(() => { window.PressVault.updateKeyring = async (kr) => { const s = window.PressVault.loadSession(); s.keyring = kr; localStorage.setItem('press:vault:v1', JSON.stringify(s)); }; });
  const row = page.locator('.tw-tool[data-f="thrift-shop.html"]');
  await expect(row.locator('.tw-sync')).toHaveAttribute('placeholder', 'Thrift Shop sync id');
  await row.locator('.tw-sync').fill(SYNC);
  await row.locator('.tw-verify').click();
  await expect(row.locator('.tw-tool-msg')).toContainText('Connected');
  const apps = await page.evaluate(() => window.PressVault.loadSession().keyring.apps);
  expect(apps['card-scout.html']).toEqual({ sync_id: SYNC, pass: SENTINEL });
  expect(apps['thrift-shop.html']).toBeUndefined();
});

test('(c) /card-scout.html#sources lands on /thrift-shop.html#sources', async ({ page, context }) => {
  await routes(context, session({ 'card-scout.html': { sync_id: SYNC, pass: SENTINEL } }));
  await page.goto(base + '/card-scout.html#sources');
  await expect(page).toHaveURL(base + '/thrift-shop.html#sources');
  await expect(page.locator('#press-gate')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Thrift Shop', level: 1 })).toBeVisible();
});

test('(d) steward.html still unlocks on the card-scout.html capability', async ({ page, context }) => {
  await routes(context, session({ 'card-scout.html': { sync_id: SYNC, pass: SENTINEL } }));
  await page.goto(base + '/steward.html');
  await expect(page.locator('#press-gate')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('Reconnect Thrift Shop');
  await expect(page.locator('body')).not.toContainText('Card Scout');
});
