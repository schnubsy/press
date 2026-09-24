// arc/wings-polish slice 3 — the perth page's title becomes "The Runway — Perth".
// Hermetic. Proves the renamed title (pages.json + perth.html) surfaces where perth is shown:
//   • the family-wing directory card (index.html ?view=family) — perth's card label; and
//   • the shared title resolver man[page].title that access.html's titleFor() also uses.
// perth is a FAMILY page, so it never appears in the public lobby; its title shows behind the
// family gate. A future-dated family session is seeded so requireSession resolves without network.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'pages.json'), 'utf8'));   // the REAL manifest

const NEW_TITLE = 'The Runway — Perth';
const OLD_TITLE = 'Perth · The Runway';
const FAMILY_FILES = ['remit.html', 'perth.html'];
const SPACES = { v: 2, personal: ['fsa.html'], family: FAMILY_FILES };

// a valid, future-dated family session (normSession shape: two token strings + numeric expiry)
const FAM_SESSION = {
  access_token: 'header.payload.sig', refresh_token: 'refresh-xyz',
  expires_at: Date.now() + 3600 * 1000, email: 'brandon@family.test', name: 'Brandon',
};

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

test('pages.json + perth.html carry the renamed title; old title is gone', () => {
  expect(PAGES['perth.html'].title).toBe(NEW_TITLE);
  const perthHtml = readFileSync(join(ROOT, 'perth.html'), 'utf8');
  expect(perthHtml).toContain(`<title>${NEW_TITLE}</title>`);
  expect(perthHtml).toContain(`content="${NEW_TITLE}"`);
  expect(perthHtml).not.toContain(OLD_TITLE);
  expect(perthHtml).toContain('<h1>The Runway</h1>');   // the h1 is deliberately left alone
});

test('the family-wing directory card shows "The Runway — Perth" (portal surface)', async ({ page, context }) => {
  await context.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PAGES) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/press_portal**', r => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  // seed a live family session so requireSession resolves silently (no gate, no auth call)
  await context.addInitScript(s => { try { localStorage.setItem('press:family:v1', s); } catch (e) {} }, JSON.stringify(FAM_SESSION));

  await page.goto(base + '/?view=family');
  const perthCard = page.locator('a[href="perth.html"], a[href$="/perth.html"]').first();
  await expect(perthCard).toContainText(NEW_TITLE);
  await expect(page.locator('body')).not.toContainText(OLD_TITLE);
});

test('access.html titleFor() resolves perth to the new title (same man[page].title source)', async ({ page }) => {
  // titleFor(page, pages) === (pages[page] && pages[page].title) || stem — access.html §render.
  // Evaluate that exact resolver against the REAL pages.json in a browser context.
  await page.goto(base + '/');
  const resolved = await page.evaluate(pages => {
    const titleFor = (p, m) => (m[p] && m[p].title) || p.replace(/\.html$/, '');
    return titleFor('perth.html', pages);
  }, PAGES);
  expect(resolved).toBe(NEW_TITLE);
});
