// arc/wings-polish slice 2 — the lobby wing cards on phone width.
// Hermetic (index.html served locally; GitHub + Supabase intercepted). Proves:
//   • at iPhone-15 width each wing heading renders ONE WORD PER LINE (explicit per-word blocks,
//     not natural wrap) — three words, three lines, three distinct top offsets, display:block;
//   • the lockline on BOTH cards is a plain tool COUNT ("2 tools" / "1 tool") — no lock state,
//     no wall clock, no "tap to unlock", no "sign in with a code";
//   • the first-run exception: with no passkey enrolled the private card still says
//     "Set up the private wing";
//   • at desktop width the heading words are inline (display:inline) — desktop layout unchanged.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const EVID = join(ROOT, 'docs', 'evidence');

const PUBLIC_FILES = ['council-guide.html', 'kayley.html', 'halvsies.html'];
const PERSONAL_FILES = ['fsa.html', 'giving.html'];           // -> "2 tools"
const FAMILY_FILES = ['remit.html'];                          // -> "1 tool"
const ALL = [...PUBLIC_FILES, ...PERSONAL_FILES, ...FAMILY_FILES];
const MANIFEST = Object.fromEntries(ALL.map(f => [f, { title: f.replace(/\.html$/, '') }]));
const SPACES = { v: 2, personal: PERSONAL_FILES, family: FAMILY_FILES };

let server, base;
test.beforeAll(async () => {
  mkdirSync(EVID, { recursive: true });
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

async function harness(page, context, { enrolled } = {}) {
  await context.route('https://api.github.com/**', route => {
    const url = route.request().url();
    if (url.includes('/contents/archive')) { route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }); return; }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([...ALL, 'index.html'].map(name => ({ type: 'file', name }))) });
  });
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/press_portal**', route => route.fulfill({ status: route.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', route => route.fulfill({ status: 500, body: '{}' }));
  await context.route('**/rest/v1/press_vault**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  if (enrolled) await context.addInitScript(() => { try { localStorage.setItem('press:vault:enrolled', '1'); } catch (e) {} });
}

// tops(): the distinct rounded top offsets of a heading's word-spans (one per rendered line).
async function spanInfo(page, sel) {
  return page.$eval(sel, h => {
    const spans = Array.from(h.querySelectorAll('span'));
    return {
      count: spans.length,
      distinctTops: new Set(spans.map(s => Math.round(s.getBoundingClientRect().top))).size,
      display: spans.length ? getComputedStyle(spans[0]).display : null,
      text: h.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
}

test('iPhone-15: both wing headings render one word per line; locklines are plain counts', async ({ page, context }) => {
  await harness(page, context, { enrolled: true });
  await page.setViewportSize({ width: 393, height: 852 });   // iPhone 15 logical viewport
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure')).toBeVisible();
  await expect(page.locator('.tw-family')).toBeVisible();

  for (const [card, name] of [['.tw-secure', 'The Private Wing'], ['.tw-family', 'The Family Wing']]) {
    const info = await spanInfo(page, `${card} h3.tw-wordlines`);
    expect(info.count, `${card}: three word-spans`).toBe(3);
    expect(info.distinctTops, `${card}: three lines (one word each)`).toBe(3);
    expect(info.display, `${card}: spans are block at phone width`).toBe('block');
    expect(info.text, `${card}: heading text unchanged`).toBe(name);   // h3-name contract intact
  }

  // locklines: plain counts, nothing else
  await expect(page.locator('.tw-secure .lockline')).toHaveText('2 tools');
  await expect(page.locator('.tw-family .lockline')).toHaveText('1 tool');
  for (const gone of ['Unlocked', 'until', 'tap to unlock', 'sign in with a code', 'Locked']) {
    await expect(page.locator('.tw-wings')).not.toContainText(gone);
  }

  await page.locator('.tw-wings').screenshot({ path: join(EVID, 'wings-polish-slice-2-cards-iphone15.png') });
});

test('iPhone-15 first run (no passkey): private card invites setup, family stays a count', async ({ page, context }) => {
  await harness(page, context, { enrolled: false });
  await page.setViewportSize({ width: 393, height: 852 });
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure .lockline')).toHaveText('Set up the private wing');
  await expect(page.locator('.tw-family .lockline')).toHaveText('1 tool');
});

test('desktop: heading words are inline (layout unchanged); screenshot captured', async ({ page, context }) => {
  await harness(page, context, { enrolled: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure')).toBeVisible();
  for (const card of ['.tw-secure', '.tw-family']) {
    const info = await spanInfo(page, `${card} h3.tw-wordlines`);
    expect(info.display, `${card}: spans inline on desktop`).toBe('inline');
  }
  // lockline copy is identical across widths (the count is width-independent)
  await expect(page.locator('.tw-secure .lockline')).toHaveText('2 tools');
  await expect(page.locator('.tw-family .lockline')).toHaveText('1 tool');
  await page.locator('.tw-wings').screenshot({ path: join(EVID, 'wings-polish-slice-2-cards-desktop.png') });
});
