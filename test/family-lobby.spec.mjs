// The Family Wing lobby door — hermetic. Proves the contract from docs/access-framework.md §1.1:
//   • the door renders from spaces.json ALONE (v2 family key), shows a COUNT and no page names
//   • the lobby makes ZERO Supabase-auth and ZERO vault calls on load (recorded as a trace)
//   • remit.html is filtered out of the public cards
//   • ?view=family is a GATED door — with no session it shows the sign-in and leaks no tool,
//     still with zero auth calls until the user acts
// GitHub + Supabase are intercepted so nothing touches production.

import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');

const PUBLIC_FILES = ['council-guide.html', 'kayley.html', 'halvsies.html'];
const PERSONAL_FILES = ['fsa.html', 'giving.html'];
const FAMILY_FILES = ['remit.html'];
const ALL = [...PUBLIC_FILES, ...PERSONAL_FILES, ...FAMILY_FILES];
const MANIFEST = Object.fromEntries(ALL.map(f => [f, { title: f.replace(/\.html$/, '') }]));
const SPACES = { v: 2, personal: PERSONAL_FILES, family: FAMILY_FILES };

let server, base;

test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/index.html') || req.url.startsWith('/?')) {
      res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); return;
    }
    res.writeHead(404); res.end('not found');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { await new Promise(r => server.close(r)); });

async function harness(page, context) {
  const state = { authCalls: 0, vaultCalls: 0, requests: [] };
  page.on('request', r => state.requests.push(r.url()));

  await context.route('https://api.github.com/**', route => {
    const url = route.request().url();
    if (url.includes('/contents/archive')) { route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    const body = [...ALL, 'index.html'].map(name => ({ type: 'file', name }));
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
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
  // any Supabase auth call is a CONTRACT VIOLATION on the lobby — count it (and let it 500 so a
  // real call would also visibly fail the flow).
  await context.route('**/auth/v1/**', route => { state.authCalls++; route.fulfill({ status: 500, body: '{}' }); });
  await context.route('**/rest/v1/press_vault**', route => { state.vaultCalls++; route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); });
  return state;
}

test('the family door renders from spaces.json alone — count only, zero auth/vault calls', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/');

  const door = page.locator('.tw-family');
  await expect(door).toBeVisible();
  await expect(door.locator('h3')).toHaveText('The Family Wing');   // marquee-polish: big text = the wing NAME
  await expect(door.locator('.k')).toContainText('a safe space');   // the short tagline now labels the kicker line
  // a COUNT, and NO page names (the public lobby does not enumerate a private space)
  await expect(door.locator('.lockline')).toContainText('1 tool');
  await expect(door).not.toContainText('remit');
  // links to the wing, not to the page
  await expect(door).toHaveAttribute('href', './?view=family');

  // remit.html is not among the public cards
  const fns = await page.locator('.tw-card .fn').allTextContents();
  expect(fns).not.toContain('remit.html');
  for (const p of PUBLIC_FILES) expect(fns).toContain(p);
  // public count excludes personal AND family
  await expect(page.locator('.tw-top span').last()).toContainText(`${PUBLIC_FILES.length} showing`);

  expect(state.authCalls, 'lobby made a Supabase auth call').toBe(0);
  expect(state.vaultCalls, 'lobby made a vault call').toBe(0);

  // record the network trace the arc asks for
  const evDir = join(ROOT, 'docs', 'evidence');
  mkdirSync(evDir, { recursive: true });
  writeFileSync(join(evDir, 'family-lobby-trace.txt'),
    `Family Wing lobby load — network trace (hermetic test)\n` +
    `Generated by test/family-lobby.spec.mjs\n\n` +
    `Supabase auth calls: ${state.authCalls}\nvault calls: ${state.vaultCalls}\n\n` +
    `All requests during lobby load + open family wing:\n` +
    state.requests.map(u => '  ' + u).join('\n') + '\n');
});

// marquee-polish slice 3: the two wing squares must be flush with the full-width cards below —
// family (left) left-edge == card left-edge, private (right) right-edge == card right-edge, within 1px.
for (const vp of [{ n: 'desktop', w: 1024, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
  test(`wing squares are edge-aligned with the cards below (${vp.n})`, async ({ page, context }) => {
    await harness(page, context);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.goto(base + '/');
    await page.locator('.tw-wings').waitFor();
    const fam = await page.locator('.tw-family').boundingBox();
    const sec = await page.locator('.tw-secure').boundingBox();
    const card = await page.locator('.tw-card').first().boundingBox();
    // family LEFT, private RIGHT
    expect(fam.x, 'family is the left square').toBeLessThan(sec.x);
    // left edge of the family square == left edge of a normal card (≤1px)
    expect(Math.abs(fam.x - card.x), 'family left edge vs card left edge').toBeLessThanOrEqual(1);
    // right edge of the private square == right edge of a normal card (≤1px)
    expect(Math.abs((sec.x + sec.width) - (card.x + card.width)), 'private right edge vs card right edge').toBeLessThanOrEqual(1);
  });
}

test('opening the family wing gates on a live session — the sign-in shows, no tool leaks, zero auth calls until the user acts', async ({ page, context }) => {
  const state = await harness(page, context);
  await page.goto(base + '/?view=family');
  // the entrance gate (family-gate sign-in overlay) is up
  const gate = page.locator('#family-gate');
  await expect(gate).toBeVisible();
  await expect(gate).toContainText('The Family Wing');
  // the tool is NOT rendered behind the gate — no directory leak before sign-in
  await expect(page.locator('.tw-card[href="remit.html"]')).toHaveCount(0);
  // and NOTHING was called: no session means the gate is a pure localStorage read
  expect(state.authCalls, 'family wing entrance made a Supabase auth call before the user acted').toBe(0);
  expect(state.vaultCalls).toBe(0);
});

test('a v1 spaces file (no family key) renders no family door — nothing breaks pre-v2', async ({ page, context }) => {
  const state = await harness(page, context);
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 1, personal: PERSONAL_FILES }) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure')).toBeVisible();      // private wing still there
  await expect(page.locator('.tw-family')).toHaveCount(0);      // no family door on v1
  // remit.html has no family key so it falls back to a PUBLIC card (as it would pre-v2)
  const fns = await page.locator('.tw-card .fn').allTextContents();
  expect(fns).toContain('remit.html');
  expect(state.authCalls).toBe(0);
});
