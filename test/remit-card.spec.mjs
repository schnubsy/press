// remit's Family Wing launch card (Mark, 2026-09-27): the pinkish kicker reads "Family Transfers" and the
// white title reads just "Remit". Hermetic, modelled on perth-title.spec.mjs: the REAL pages.json and
// index.html, a seeded family session, GitHub + Supabase routed.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'pages.json'), 'utf8'));
const SPACES = { v: 2, personal: ['fsa.html'], family: ['remit.html', 'perth.html'] };
const FAM_SESSION = { access_token: 'header.payload.sig', refresh_token: 'refresh-xyz', expires_at: Date.now() + 3600 * 1000, email: 'brandon@family.test', name: 'Brandon' };

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/index.html') || req.url.startsWith('/?')) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); return; }
    res.writeHead(404); res.end('not found');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

test('pages.json titles remit.html "Remit"', () => {
  expect(PAGES['remit.html'].title).toBe('Remit');
});

test('the Family Wing card: kicker "Family Transfers", title "Remit", banknote icon kept', async ({ page, context }) => {
  await context.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('https://raw.githubusercontent.com/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAGES) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/press_portal**', (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.addInitScript((s) => { try { localStorage.setItem('press:family:v1', s); } catch (e) {} }, JSON.stringify(FAM_SESSION));

  await page.goto(base + '/?view=family');
  const card = page.locator('a[href="remit.html"], a[href$="/remit.html"]').first();
  await expect(card.locator('.k')).toHaveText(/^Family Transfers/i);
  await expect(card.locator('h3')).toHaveText('Remit');
  await expect(card.locator('svg rect[width="20"][height="12"]')).toHaveCount(1);   // the banknote glyph, not the generic Page
  await expect(page.locator('body')).not.toContainText('Family transfers · ');
  await expect(page.locator('body')).not.toContainText('remit · Family transfers');
  if (process.env.PRESS_SHOT) await card.screenshot({ path: process.env.PRESS_SHOT });
});
