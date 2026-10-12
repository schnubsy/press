// arc marquee-wings-monitor slice 4 — Agent Monitor (agent-health.html), hermetic.
// Fake Supabase answers for the two public views prove the page:
//   • lands as one dot per agent, grouped by app (worst app first), with one "last real work" line each;
//   • expands a dot into its detail card on click (and collapses it again);
//   • keeps switched-off agents in a collapsed <details> at the bottom;
//   • shows server status only (an unknown status is never painted green);
//   • hides Retry with no admin session, and shows it — and POSTs agent-fix with the admin JWT — when the
//     Family Wing session in localStorage belongs to an admin.
// Writes the slice evidence screenshots (desktop + mobile: landing, expanded, off section).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = readFileSync(join(ROOT, 'agent-health.html'), 'utf8');
const LIB = readFileSync(join(ROOT, 'src', 'agent-monitor.js'), 'utf8');
const EV = join(ROOT, 'docs', 'evidence');
const SHOT = (name) => join(EV, `marquee-wings-slice-4-${name}.png`);

const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString();
const links = (fn) => [{ label: 'Function logs', url: `https://supabase.com/dashboard/project/x/functions/${fn}/logs` }];
const ROWS = [
  { id: 'card-scout', app_label: 'Card Scout', label: 'Deal judge', what: 'Judges gift-card deals 3× a day.', kind: 'edge-cron', enabled: true,
    sched: { daily: ['07:00', '12:00', '18:00'] }, sort: 10, status: 'healthy', status_reason: 'Working',
    last_real_work_at: iso(200), last_seen_at: iso(200), last_failed_at: null, last_output_note: '5 deals judged/updated',
    next_due_at: iso(-90), cost_mtd: 0.2981, cost_projected: 0.5730, cost_tracked: true,
    fix_hint: 'Open the function logs.', fix_links: links('card-scout'), retry_available: true },
  { id: 'card-scout-weekly-store-check', app_label: 'Card Scout', label: 'Weekly store check', what: 'Cloud scheduled task.', kind: 'browser-task', enabled: true,
    sched: { weekly: { dow: 3, at: '12:00' } }, sort: 12, status: 'late', status_reason: 'Missed the run due Wed Oct 7, 12:00 PM CT',
    last_real_work_at: iso(60 * 24 * 9), last_seen_at: null, last_failed_at: null, last_output_note: 'Checked 6 stores',
    next_due_at: iso(60 * 24 * 5), cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'Open Scheduled tasks on claude.ai and run it now.', fix_links: [{ label: 'Scheduled tasks', url: 'https://claude.ai/code/scheduled' }], retry_available: false },
  { id: 'fsa-capture', app_label: 'FSA Claims Tracker', label: 'Receipt capture inlet', what: 'Gmail inlet every 10 minutes.', kind: 'inlet', enabled: true,
    sched: { every: 10 }, sort: 40, status: 'failed', status_reason: 'Has never run',
    last_real_work_at: null, last_seen_at: null, last_failed_at: null, last_output_note: null,
    next_due_at: null, cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'The Gmail Apps Script trigger is not set up.', fix_links: [{ label: 'Apps Script', url: 'https://script.google.com/home' }], retry_available: false },
  { id: 'planner-calendar-sync', app_label: 'Optimo', label: 'Calendar sync', what: 'pg_cron job every 15 minutes.', kind: 'pg-cron', enabled: true,
    sched: { every: 15 }, sort: 32, status: 'failed', status_reason: 'Last attempt failed',
    last_real_work_at: iso(50), last_seen_at: iso(5), last_failed_at: iso(5), last_output_note: 'Called its function (HTTP request queued)',
    next_due_at: iso(35), cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'Check the cron history.', fix_links: links('calendar-sync'), retry_available: true },
  { id: 'plan-day', app_label: 'Optimo', label: 'Day planner AI', what: 'On demand.', kind: 'edge-on-demand', enabled: true,
    sched: null, sort: 30, status: 'no-data', status_reason: 'Not instrumented yet — nothing records its runs',
    last_real_work_at: null, last_seen_at: null, last_failed_at: null, last_output_note: null,
    next_due_at: null, cost_mtd: null, cost_projected: null, cost_tracked: false, fix_hint: null, fix_links: links('plan-day'), retry_available: false },
  { id: 'weird', app_label: 'Marquee', label: 'Odd one', what: 'Unknown status from the server.', kind: 'inlet', enabled: true,
    sched: null, sort: 99, status: 'skipped', status_reason: 'whatever', last_real_work_at: null, fix_links: [], retry_available: false },
  { id: 'ynab-sync', app_label: 'Giving Tracker', label: 'Nightly YNAB sync', what: 'Switched off.', kind: 'pg-cron', enabled: false,
    sched: { every: 1440 }, sort: 54, status: 'off', status_reason: 'Switched off',
    last_real_work_at: iso(60 * 24 * 31), last_output_note: 'Called its function (HTTP request queued)', next_due_at: null,
    cost_mtd: null, cost_projected: null, cost_tracked: false, fix_hint: 'Switched off on purpose.', fix_links: [], retry_available: false },
];
// daily strip rows: Card Scout three real runs a day + quiet ticks, CT day keys
function ctKey(ms) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const DAILY = [];
for (let i = 0; i < 14; i++) {
  const day = ctKey(Date.now() - i * 86400000);
  DAILY.push({ id: 'card-scout', day, real_n: i === 0 ? 1 : 3, quiet_n: 26, failed_n: 0, cost_usd: 0.014 });
  DAILY.push({ id: 'planner-calendar-sync', day, real_n: 96, quiet_n: 0, failed_n: i === 0 ? 1 : 0, cost_usd: 0 });
}

let server, base;
test.beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url.split('?')[0];
    if (url === '/agent-health.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); return; }
    if (url === '/src/agent-monitor.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(LIB); return; }
    res.writeHead(404); res.end('nf');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}`;
  mkdirSync(EV, { recursive: true });
});
test.afterAll(async () => { await new Promise((r) => server.close(r)); });

async function backend(context, { admin = false } = {}) {
  const calls = { fix: [], adminCheck: 0 };
  await context.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await context.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await context.route('**/rest/v1/press_agent_monitor_public**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ROWS) }));
  await context.route('**/rest/v1/press_agent_monitor_daily_public**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DAILY) }));
  await context.route('**/rest/v1/rpc/press_access_is_admin', (r) => {
    calls.adminCheck++;
    const auth = r.request().headers()['authorization'] || '';
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(admin && auth === 'Bearer admin.jwt.sig') });
  });
  await context.route('**/auth/v1/**', (r) => r.fulfill({ status: 400, contentType: 'application/json', body: '{}' }));
  await context.route('**/functions/v1/agent-fix', (r) => {
    calls.fix.push({ auth: r.request().headers()['authorization'], body: r.request().postDataJSON() });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, result: 'Re-ran scheduled job planner_calendar_sync' }) });
  });
  if (admin) {
    await context.addInitScript((s) => { try { localStorage.setItem('press:family:v1', s); } catch (e) {} },
      JSON.stringify({ access_token: 'admin.jwt.sig', refresh_token: 'r1', expires_at: Date.now() + 3600e3, email: 'mark@fam.test', name: 'Mark' }));
  }
  return calls;
}

test('landing: one dot per agent, grouped by app, worst app first; off section collapsed', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const calls = await backend(context);
  await page.goto(base + '/agent-health.html');
  await expect(page.locator('#verdict')).toContainText('need');
  await expect(page.locator('#verdict')).toHaveClass(/red/);

  const apps = await page.locator('section.app').evaluateAll((els) => els.map((e) => e.dataset.app));
  expect(apps[0]).toMatch(/FSA Claims Tracker|Optimo/);           // a failed app leads
  expect(apps).toEqual(expect.arrayContaining(['Card Scout', 'Optimo', 'FSA Claims Tracker', 'Marquee']));
  expect(apps).not.toContain('Giving Tracker');                    // its only agent is switched off

  const scout = page.locator('#a-card-scout');
  await expect(scout.locator('.sdot')).toHaveClass(/ok/);
  await expect(scout).toContainText('Last real work');
  await expect(scout).toContainText('5 deals judged/updated');
  await expect(page.locator('#a-fsa-capture .sdot')).toHaveClass(/bad/);
  await expect(page.locator('#a-card-scout-weekly-store-check .sdot')).toHaveClass(/warn/);
  await expect(page.locator('#a-plan-day .sdot')).toHaveClass(/none/);
  await expect(page.locator('#a-weird .sdot')).not.toHaveClass(/\bok\b/);   // never green for an unknown status

  const off = page.locator('details#offsec');
  await expect(off).not.toHaveAttribute('open', '');
  await expect(off.locator('#a-ynab-sync')).toBeHidden();
  await expect(page.locator('#cost-mtd')).toHaveText('$0.30');
  await expect(page.locator('.detail:not([hidden])')).toHaveCount(0);
  expect(calls.adminCheck).toBe(0);                                 // no session → no auth traffic at all
  await page.screenshot({ path: SHOT('desktop-landing'), fullPage: true });

  await off.locator('summary').click();
  await expect(off.locator('#a-ynab-sync')).toBeVisible();
  await expect(off.locator('#a-ynab-sync .sdot')).toHaveClass(/off/);
  await page.screenshot({ path: SHOT('desktop-off'), fullPage: true });
});

test('click a dot → the detail card; click again → collapsed. Retry hidden without an admin session', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const calls = await backend(context);
  await page.goto(base + '/agent-health.html');
  const row = page.locator('#a-planner-calendar-sync');
  await row.locator('.row').click();
  await expect(row.locator('.row')).toHaveAttribute('aria-expanded', 'true');
  const d = row.locator('.detail');
  await expect(d).toBeVisible();
  await expect(d).toContainText('Failed — Last attempt failed');
  await expect(d).toContainText('How to fix');
  await expect(d.locator('a.lnk')).toHaveAttribute('href', /calendar-sync\/logs/);
  await expect(d.locator('.bars .bar')).toHaveCount(14);
  await expect(d.locator('.retry')).toHaveCount(0);
  await page.locator('#a-card-scout .row').click();
  await expect(page.locator('#d-card-scout')).toContainText('Projected full month');
  await expect(page.locator('#d-card-scout')).toContainText('$0.57');
  await page.screenshot({ path: SHOT('desktop-expanded'), fullPage: true });
  await row.locator('.row').click();
  await expect(d).toBeHidden();
  expect(calls.fix.length).toBe(0);
});

test('admin session present → Retry shown on retry-able agents and posts agent-fix with the admin JWT', async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const calls = await backend(context, { admin: true });
  await page.goto(base + '/agent-health.html');
  await expect(page.locator('#admin')).toContainText('Admin');
  await page.locator('#a-planner-calendar-sync .row').click();
  const btn = page.locator('#d-planner-calendar-sync .retry');
  await expect(btn).toHaveText('Retry now');
  await page.locator('#a-fsa-capture .row').click();
  await expect(page.locator('#d-fsa-capture .retry')).toHaveCount(0);   // no allowlisted retry → links only
  await btn.click();
  await expect(page.locator('#msg-planner-calendar-sync')).toContainText('Re-ran scheduled job');
  expect(calls.fix).toEqual([{ auth: 'Bearer admin.jwt.sig', body: { agent: 'planner-calendar-sync' } }]);
});

test('a non-admin family session never sees Retry', async ({ page, context }) => {
  const calls = await backend(context, { admin: false });
  await context.addInitScript((s) => { try { localStorage.setItem('press:family:v1', s); } catch (e) {} },
    JSON.stringify({ access_token: 'cousin.jwt.sig', refresh_token: 'r2', expires_at: Date.now() + 3600e3, email: 'c@fam.test' }));
  await page.goto(base + '/agent-health.html');
  await page.locator('#a-planner-calendar-sync .row').click();
  await expect(page.locator('#d-planner-calendar-sync')).toContainText('How to fix');
  await expect(page.locator('#d-planner-calendar-sync .retry')).toHaveCount(0);
  await expect(page.locator('#admin')).toHaveText('');
  expect(calls.adminCheck).toBe(1);
});

test('status service down → honest "can’t check", never green', async ({ page, context }) => {
  await context.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await context.route('**/rest/v1/**', (r) => r.fulfill({ status: 503, body: 'down' }));
  await page.goto(base + '/agent-health.html');
  await expect(page.locator('#root')).toContainText('Can’t check the agents right now');
  await expect(page.locator('.verdict.green')).toHaveCount(0);
});

test('mobile 390px: landing, expanded and off section fit without horizontal scroll', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await backend(context);
  await page.goto(base + '/agent-health.html');
  await expect(page.locator('#a-card-scout')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({ path: SHOT('mobile-landing'), fullPage: true });
  await page.locator('#a-fsa-capture .row').click();
  await expect(page.locator('#d-fsa-capture')).toContainText('Apps Script');
  const overflow2 = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow2).toBeLessThanOrEqual(0);
  await page.locator('#d-fsa-capture').screenshot({ path: SHOT('mobile-expanded') });
  await page.locator('details#offsec summary').click();
  await page.locator('details#offsec').screenshot({ path: SHOT('mobile-off') });
});

test('deep link #id opens that agent (alert links land on it)', async ({ page, context }) => {
  await backend(context);
  await page.goto(base + '/agent-health.html#fsa-capture');
  await expect(page.locator('#d-fsa-capture')).toBeVisible();
  await expect(page.locator('#d-fsa-capture')).toContainText('Has never run');
});
