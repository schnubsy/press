// wings-fail-closed (2026-11-20) — the lobby must NEVER paint a private- or family-wing page as a public card.
// Regression: on plane Wi-Fi api.github.com answered but raw.githubusercontent.com/spaces.json did not; loadSpaces()
// returned null, normSpaces(null) emptied both wings and every wing page rendered on the public lobby ("0 tools"),
// and the empty split was then cached in press:marquee:v3. Hermetic: GitHub + Supabase are intercepted.

import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const REAL = JSON.parse(readFileSync(join(ROOT, 'spaces.json'), 'utf8'));      // the live tier truth
const PUBLIC_FILES = ['council-guide.html', 'kayley.html', 'eagle-path.html', 'halvsies.html', 'agent-health.html'];
const WING_FILES = [...REAL.personal, ...REAL.family];
const ALL = [...PUBLIC_FILES, ...WING_FILES, 'index.html'];

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

// spacesMode: 'ok' | 'abort' | '404' | 'html' | 'empty'  — read from a mutable holder so one test can flip it
async function harness(context, holder) {
  await context.route('https://api.github.com/**', route => {
    const url = route.request().url();
    if (url.includes('/contents/archive')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ALL.map(name => ({ type: 'file', name }))) });
  });
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) {
      switch (holder.mode) {
        case 'ok':    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(REAL) });
        case 'abort': return route.abort('internetdisconnected');
        case '404':   return route.fulfill({ status: 404, body: 'nf' });
        case 'html':  return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Sign in to in-flight Wi-Fi</html>' });
        case 'empty': return route.fulfill({ status: 200, contentType: 'application/json', body: '{"v":2,"personal":[],"family":[]}' });
      }
    }
    if (url.endsWith('/pages.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

async function cardFiles(page) {
  return page.locator('.tw-card').evaluateAll(els => els.map(e => e.dataset.file).filter(Boolean));
}
async function expectNoWingCards(page) {
  const fns = await cardFiles(page);
  for (const f of WING_FILES) expect(fns, `${f} must never be a public card`).not.toContain(f);
}

for (const mode of ['abort', '404', 'html', 'empty']) {
  test(`spaces.json ${mode}, no cache → error screen, no wing page on the lobby`, async ({ page, context }) => {
    await harness(context, { mode });
    await page.goto(base + '/');
    await expect(page.locator('.tw-error')).toBeVisible();
    await expect(page.locator('.tw-error h3')).toHaveText("Couldn't reach the marquee");
    await expectNoWingCards(page);
    expect(await page.evaluate(() => localStorage.getItem('press:marquee:v4'))).toBeNull();   // a bad read is never cached
  });
}

test('good load, then spaces.json fails → the cached split still hides every wing page', async ({ page, context }) => {
  const holder = { mode: 'ok' };
  await harness(context, holder);
  await page.goto(base + '/');
  await expect(page.locator('.tw-secure')).toBeVisible();
  await expectNoWingCards(page);
  expect(await cardFiles(page)).toEqual(expect.arrayContaining(PUBLIC_FILES));
  holder.mode = 'abort';
  await page.reload();
  await expect(page.locator('.tw-secure')).toBeVisible();     // painted from the good cache
  await expect(page.locator('.tw-error')).toHaveCount(0);
  await expectNoWingCards(page);
  const lock = await page.locator('.tw-secure .lockline').textContent();
  expect(lock).not.toMatch(/^\s*0 tools/);
});

test('a poisoned v3 cache (empty wings) is never used; it is dropped', async ({ page, context }) => {
  await harness(context, { mode: 'abort' });
  await context.addInitScript(([all]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('press:marquee:v3', JSON.stringify({ files: all.filter(f => f !== 'index.html'), man: {}, spaces: { personal: [], family: [] } }));
      sessionStorage.setItem('seeded', '1');
    }
  }, [ALL]);
  await page.goto(base + '/');
  await expect(page.locator('.tw-error')).toBeVisible();
  await expectNoWingCards(page);
  expect(await page.evaluate(() => localStorage.getItem('press:marquee:v3'))).toBeNull();
});

test('archive view with spaces.json down → error, no wing page listed', async ({ page, context }) => {
  await harness(context, { mode: 'abort' });
  await page.goto(base + '/?view=archive');
  await expect(page.locator('.tw-error h3')).toHaveText("Couldn't reach the archive");
  await expectNoWingCards(page);
});
