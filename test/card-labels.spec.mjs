// arc/marquee-wings-monitor slice 1 — the marquee owns card naming (RULE, Mark 2026-10-12).
// Hermetic. Serves the REAL index.html with the REAL pages.json + spaces.json and proves, on every
// surface a card shows (public landing, unlocked private wing, signed-in family wing):
//   • each card's pink kicker (.k) + white title (h3) come from the LABELS map — the ten renamed pairs
//     render exactly, and pages.json titles (tab titles) never override them;
//   • the filename line is gone (no .fn anywhere);
//   • every served page wears its own glyph (no two cards share an icon).
// PRESS_SHOT_DIR=<dir> also writes landing/private/family screenshots at 1280 + 390 (slice evidence).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'pages.json'), 'utf8'));
const SPACES = JSON.parse(readFileSync(join(ROOT, 'spaces.json'), 'utf8'));

// The ten renamed cards (Mark, 2026-10-12) — kicker / title — plus the four kept as they were.
const WANT = {
  'optimo.html':        ['Day planner', 'Optimo'],
  'perth.html':         ['Moving to Perth', 'The Runway'],
  'halvsies.html':      ['Splitting the Bill', 'Halvsies'],
  'cardsharp.html':     ['Gift Card Tracker', 'Cardsharp'],
  'card-scout.html':    ['Sales Finder', 'Card Scout'],
  'access.html':        ['UAM', 'Family Wing Access'],
  'retirement.html':    ['Financial Planning', 'Retirement Projector'],
  'giving.html':        ['Charitable Donations', 'Giving Tracker'],
  'fsa.html':           ['Medical Expenses', 'FSA Claims Tracker'],
  'council-guide.html': ['Agentic Capabilities Prospectus', 'The Council'],
  'remit.html':         ['Family Transfers', 'Remit'],
  'kayley.html':        ['Checklist', 'Kayley · 2-Week Upskilling Plan'],
  'eagle-path.html':    ['Checklist', "Brandon's Eagle Path · Saturday Check-In"],
  'agent-health.html':  ['Monitor', 'Agent Health'],
};
const personal = SPACES.personal || [], family = SPACES.family || [];
const PUBLIC = Object.keys(PAGES).filter((f) => !personal.includes(f) && !family.includes(f));

const now = Date.now();
const VAULT = { keyring: { v: 1, apps: {} }, unlockedAt: now, expiresAt: now + 7 * 864e5, vaultId: 'labels-probe' };
const FAM = { access_token: 'header.payload.sig', refresh_token: 'refresh-xyz', expires_at: now + 3600e3, email: 'brandon@family.test', name: 'Brandon' };

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

async function routes(context) {
  await context.route('https://api.github.com/**', (route) => {
    if (route.request().url().includes('/contents/archive')) return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    const body = [...Object.keys(PAGES), 'index.html'].map((name) => ({ type: 'file', name }));
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
  await context.addInitScript(([v, f]) => {
    try { localStorage.setItem('press:vault:v1', v); localStorage.setItem('press:vault:enrolled', '1'); localStorage.setItem('press:family:v1', f); } catch (e) {}
  }, [JSON.stringify(VAULT), JSON.stringify(FAM)]);
}

const VIEWS = [
  { name: 'landing', url: '/', files: PUBLIC },
  { name: 'private', url: '/?view=personal', files: personal },
  { name: 'family', url: '/?view=family', files: family },
];

for (const v of VIEWS) {
  test(`${v.name}: every card shows its LABELS kicker + title, no filename line`, async ({ page, context }) => {
    await routes(context);
    await page.goto(base + v.url);
    await expect(page.locator('.tw-card')).toHaveCount(v.files.length);
    for (const f of v.files) {
      const [kicker, title] = WANT[f];
      const card = page.locator(`.tw-card[data-file="${f}"]`);
      const re = new RegExp('^' + kicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s*new)?$');   // the newest card also carries the "new" pill
      await expect(card.locator('.k'), `${f} kicker`).toHaveText(re);
      await expect(card.locator('h3'), `${f} title`).toHaveText(title);
    }
    await expect(page.locator('.fn')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('.html');   // no filename anywhere on the surface
  });
}

test('the ten renamed pairs are exactly the served set, and every served page has its own icon', async ({ page, context }) => {
  await routes(context);
  expect(Object.keys(WANT).sort()).toEqual(Object.keys(PAGES).sort());   // one label per served page
  const icons = {};
  for (const v of VIEWS) {
    await page.goto(base + v.url);
    await expect(page.locator('.tw-card')).toHaveCount(v.files.length);
    for (const f of v.files) icons[f] = await page.locator(`.tw-card[data-file="${f}"] .ticon`).innerHTML();
  }
  const generic = await page.evaluate(() => ICONS['Page']);
  for (const [f, svg] of Object.entries(icons)) expect(svg, `${f} uses the generic page glyph`).not.toBe(generic);
  expect(new Set(Object.values(icons)).size, 'two cards share an icon').toBe(Object.keys(icons).length);
});

test('pages.json titles stay tab titles — they never reach a card the label map names', async ({ page, context }) => {
  await routes(context);
  await page.goto(base + '/?view=family');
  await expect(page.locator('.tw-card[data-file="optimo.html"] h3')).toHaveText('Optimo');
  await expect(page.locator('body')).not.toContainText(PAGES['optimo.html'].title);   // "optimo · Day planner"
  await expect(page.locator('body')).not.toContainText(PAGES['perth.html'].title);    // "The Runway — Perth"
});

if (process.env.PRESS_SHOT_DIR) {
  for (const vp of [{ n: 'desktop', w: 1280, h: 900 }, { n: 'mobile', w: 390, h: 844 }]) {
    test(`evidence screenshots (${vp.n})`, async ({ page, context }) => {
      await routes(context);
      await page.setViewportSize({ width: vp.w, height: vp.h });
      for (const v of VIEWS) {
        await page.goto(base + v.url);
        await expect(page.locator('.tw-card')).toHaveCount(v.files.length);
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(process.env.PRESS_SHOT_DIR, `marquee-wings-slice-1-${v.name}-${vp.n}.png`), fullPage: true });
      }
    });
  }
}
