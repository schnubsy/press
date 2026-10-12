// test/steward.spec.mjs — steward.html (private wing, arc/steward-report) outcome tests.
// Hermetic: the press root is served from localhost; the `steward-reports` Edge Function is intercepted by a mock that
// runs the function's REAL gate + shaping (supabase/functions/steward-reports/core.mjs) over an in-memory
// press_deals capability and the slice-1 fixture row — so "ungated gets no rows" is the shipped logic, not a stub.
import { test, expect, devices } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { authorize, shape } from '../supabase/functions/steward-reports/core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARD_SYNC = 'c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6';  // throwaway card-scout capability the mock accepts
const SENTINEL = 'not-a-secret:card-scout-has-no-passphrase:sentinel-only-to-satisfy-credsFor';
const NOW = Date.now();
const iso = (daysAgo) => new Date(NOW - daysAgo * 864e5).toISOString();
// the page buckets by LOCAL Monday-start calendar week; build history relative to this week's Monday 00:00
const weekStart = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const MON = weekStart(NOW);
// The slice-1 fixture row (newest) + older history: weekly dots and one monthly ring.
const ROWS = [
  { id: 1, run_at: new Date(NOW - 60000).toISOString(), cadence: 'weekly', headline: '🟡', summary: 'FIXTURE — arc/steward-report S1 read-back',
    sections: { needs_you: ['Fixture: sign in to 1Password CLI'], fixed_for_you: ['Fixture: re-pointed a stale path'], cost_moves: [], all_clear: 'Everything else held.' },
    model: 'sonnet', cost_usd: '0.0123' },
  { id: 0, run_at: new Date(MON - 3 * 864e5).toISOString(), cadence: 'weekly', headline: '🟢', summary: 'quiet', sections: {} },
  { id: -1, run_at: new Date(MON - 10 * 864e5).toISOString(), cadence: 'monthly', headline: '🔴', summary: 'audit', sections: {} },
];

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
    const f = join(ROOT, p || 'steward.html');
    if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
    res.end(readFileSync(f));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
});
test.afterAll(async () => { if (server) await new Promise((r) => server.close(r)); });

async function harness(context, rows = ROWS) {
  const state = { posts: 0, planIds: [] };
  // the live RPC: true iff the presented id equals the server-held press_deals.sync_id default (CARD_SYNC here)
  const deals = async (path, init) => {
    const p = path === 'rpc/press_steward_capability_ok' ? JSON.parse((init && init.body) || '{}').p : null;
    return { ok: true, status: 200, json: async () => p === CARD_SYNC };
  };
  await context.route('**/functions/v1/steward-reports', async (route) => {
    const req = route.request();
    const cors = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'content-type, x-plan-id, apikey, authorization', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    state.posts++;
    const pid = req.headers()['x-plan-id'] || null;
    state.planIds.push(pid);
    const a = await authorize(pid, deals);
    if (!a.ok) return route.fulfill({ status: a.status, headers: cors, contentType: 'application/json', body: JSON.stringify({ error: 'unauthorized' }) });
    return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(shape(rows)) });
  });
  // any other Supabase call (the gate's vault probe) gets nothing — no data path besides the function
  await context.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  return state;
}
function session(syncId) {
  const now = Date.now();
  return JSON.stringify({ keyring: { v: 1, apps: { 'card-scout.html': { sync_id: syncId, pass: SENTINEL } } },
    unlockedAt: now, expiresAt: now + 7 * 864e5, vaultId: 'steward-spec' });
}
async function seed(context, sess) {
  await context.addInitScript((s) => { try { localStorage.setItem('press:vault:enrolled', '1'); if (s) localStorage.setItem('press:vault:v1', s); } catch (e) {} }, sess);
}

test.describe('mobile 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });

  test('past the gate, Mark sees the headline and the Needs-you lines + a 12-week strip', async ({ page, context }) => {
    const st = await harness(context);
    await seed(context, session(CARD_SYNC));
    await page.goto(base + '/steward.html');
    await expect(page.locator('#press-gate')).toHaveCount(0);
    await expect(page.locator('#headline')).toHaveText('🟡');
    await expect(page.locator('#summary')).toContainText('FIXTURE — arc/steward-report S1 read-back');
    await expect(page.locator('.sec.needs li')).toHaveText(['Fixture: sign in to 1Password CLI']);
    await expect(page.locator('.sec.fixed li')).toHaveText(['Fixture: re-pointed a stale path']);
    await expect(page.locator('.sec.cost .none')).toHaveText('No cost moved.');
    await expect(page.locator('.clear')).toHaveText('Everything else held.');
    await expect(page.locator('#strip .wk')).toHaveCount(12);
    await expect(page.locator('#strip .dot')).toHaveCount(3);
    await expect(page.locator('#strip .dot.m.r')).toHaveCount(1);      // the monthly audit ring
    await expect(page.locator('#strip .wk').nth(11).locator('.dot.y')).toHaveCount(1); // this week = the fixture
    await expect(page.locator('#strip .wk').nth(10).locator('.dot.g')).toHaveCount(1);  // last calendar week
    await expect(page.locator('#strip .wk').nth(9).locator('.dot.m.r')).toHaveCount(1); // two weeks back
    expect(st.planIds).toEqual([CARD_SYNC]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: join(ROOT, 'docs/evidence/steward-report-slice-2-mobile.png'), fullPage: true });
  });

  test('no wing session: the passkey gate shows and NO request reaches the reports', async ({ page, context }) => {
    const st = await harness(context);
    await seed(context, null);
    await page.goto(base + '/steward.html');
    await expect(page.locator('#press-gate')).toBeVisible();
    await expect(page.locator('#latest')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(st.posts).toBe(0);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('app')).visibility)).toBe('hidden');
  });

  test('an ungated request (no x-plan-id) gets 401 and no rows', async ({ page, context }) => {
    await harness(context);
    await seed(context, null);
    await page.goto(base + '/steward.html');
    const out = await page.evaluate(async () => {
      const r = await fetch('https://eepjhpyziczrxvirczio.supabase.co/functions/v1/steward-reports', { method: 'POST' });
      return { status: r.status, body: await r.json() };
    });
    expect(out.status).toBe(401);
    expect(out.body.latest).toBeUndefined();
    expect(out.body.history).toBeUndefined();
  });

  test('a wrong key is refused: the denied state, no report', async ({ page, context }) => {
    await harness(context);
    await seed(context, session('0'.repeat(32)));
    await page.goto(base + '/steward.html');
    await expect(page.locator('#st-denied')).toBeVisible();
    await expect(page.locator('#latest')).toHaveCount(0);
  });

  test('report text is rendered as text, never markup (XSS)', async ({ page, context }) => {
    const evil = '<img src=x onerror="window.__pwn=1">"\'&';
    await harness(context, [{ id: 9, run_at: iso(0.1), cadence: 'monthly', headline: '<b>🔴</b>', summary: evil,
      sections: { needs_you: [evil, { text: evil, action: evil }], fixed_for_you: [evil], cost_moves: [evil],
        ledger: [{ service: evil, plan: evil, per_month: evil, trend: evil }, evil], all_clear: evil } }]);
    await seed(context, session(CARD_SYNC));
    await page.goto(base + '/steward.html');
    await expect(page.locator('#summary')).toHaveText(evil);
    await expect(page.locator('.sec.needs li').first()).toHaveText(evil);
    expect(await page.locator('#app img').count()).toBe(0);
    expect(await page.evaluate(() => window.__pwn)).toBeUndefined();
  });

  test('a lock after unlock blanks the report and brings the gate back', async ({ page, context }) => {
    await harness(context);
    await seed(context, session(CARD_SYNC));
    await page.goto(base + '/steward.html');
    await expect(page.locator('#headline')).toHaveText('🟡');
    await page.evaluate(() => window.PressVault.lock());
    await expect(page.locator('#press-gate')).toBeVisible();
    await expect(page.locator('#latest')).toHaveCount(0);
    expect(await page.evaluate(() => getComputedStyle(document.getElementById('app')).visibility)).toBe('hidden');
  });

  test('no reports yet: an honest empty state', async ({ page, context }) => {
    await harness(context, []);
    await seed(context, session(CARD_SYNC));
    await page.goto(base + '/steward.html');
    await expect(page.locator('#st-empty')).toBeVisible();
  });
});

test('desktop 1280: the report renders', async ({ page, context }) => {
  await harness(context);
  await seed(context, session(CARD_SYNC));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + '/steward.html');
  await expect(page.locator('#headline')).toHaveText('🟡');
  await page.screenshot({ path: join(ROOT, 'docs/evidence/steward-report-slice-2-desktop.png'), fullPage: true });
});
