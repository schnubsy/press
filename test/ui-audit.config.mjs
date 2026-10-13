// test/ui-audit.config.mjs — press's iPhone UI-audit config (council instruments/ui-audit; arc/safari-ui, 2026-10-12).
// Run: node test/ui-audit/run.mjs test/ui-audit.config.mjs --evidence docs/evidence/safari-ui-audit
//
// Scope: the marquee shell + every PRESS-NATIVE page — index.html (lobby, archive, private wing incl. its passkey
// gate states, family wing incl. its email-code gate states), steward.html, agent-health.html, access.html.
// Tenant pages (fsa/giving/remit/…) are audited in their own repos. The passkey gate is press-owned, so its locked /
// first-time / unlocked states ARE in scope: the gate is seeded past-lock through its localStorage test hook
// (`press:vault:enrolled` + a `press:vault:v1` session) exactly as the Playwright specs do — never real credentials.
// Hermetic: the press root is served from 127.0.0.1; GitHub, Google Fonts and Supabase are answered by in-memory
// fakes (no egress needed beyond the WebKit download).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, extname } from 'node:path';
import { shape } from '../supabase/functions/steward-reports/core.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = JSON.parse(readFileSync(join(ROOT, 'pages.json'), 'utf8'));
const SPACES = JSON.parse(readFileSync(join(ROOT, 'spaces.json'), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// ── the static server (lives for the run; unref'd so it never holds the process open) ──
const server = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
  let f = join(ROOT, p || 'index.html');
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
  if (!f.startsWith(ROOT) || !existsSync(f)) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
server.unref();
const BASE = `http://127.0.0.1:${server.address().port}`;

// ── fixtures ──
const NOW = Date.now();
const iso = (minAgo) => new Date(NOW - minAgo * 60000).toISOString();
const CARD_SYNC = 'c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6';   // throwaway capability the steward fake accepts
const SENTINEL = 'not-a-secret:ui-audit-fixture';
const VAULT = JSON.stringify({ keyring: { v: 1, apps: { 'card-scout.html': { sync_id: CARD_SYNC, pass: SENTINEL } } },
  unlockedAt: NOW, expiresAt: NOW + 7 * 864e5, vaultId: 'ui-audit' });
const FAM = JSON.stringify({ access_token: 'admin.jwt.sig', refresh_token: 'r1', expires_at: NOW + 3600e3, email: 'mark@fam.test', name: 'Mark' });

const STEWARD_ROWS = [
  { id: 1, run_at: iso(1), cadence: 'weekly', headline: '🟡', summary: 'Two things need you; the rest held.',
    sections: { needs_you: ['Sign in to the 1Password CLI so the secrets check can run', 'Reload the council bundle in Desktop'],
      fixed_for_you: ['Re-pointed a stale path in the snag registry'], cost_moves: ['Card Scout model spend −12% week on week'], all_clear: 'Everything else held.' },
    model: 'sonnet', cost_usd: '0.0123' },
  { id: 0, run_at: iso(60 * 24 * 7), cadence: 'weekly', headline: '🟢', summary: 'quiet', sections: {} },
  { id: -1, run_at: iso(60 * 24 * 14), cadence: 'monthly', headline: '🔴', summary: 'audit', sections: {} },
];
const links = (fn) => [{ label: 'Function logs', url: `https://supabase.com/dashboard/project/x/functions/${fn}/logs` }];
const AGENTS = [
  { id: 'card-scout', app_label: 'Card Scout', label: 'Deal judge', what: 'Judges gift-card deals 3× a day.', kind: 'edge-cron', enabled: true,
    sched: { daily: ['07:00', '12:00', '18:00'] }, sort: 10, status: 'healthy', status_reason: 'Working',
    last_real_work_at: iso(200), last_seen_at: iso(200), last_failed_at: null, last_output_note: '5 deals judged/updated',
    next_due_at: iso(-90), cost_mtd: 0.2981, cost_projected: 0.5730, cost_tracked: true, fix_hint: 'Open the function logs.', fix_links: links('card-scout'), retry_available: true },
  { id: 'card-scout-weekly-store-check', app_label: 'Card Scout', label: 'Weekly store check', what: 'Cloud scheduled task.', kind: 'browser-task', enabled: true,
    sched: { weekly: { dow: 3, at: '12:00' } }, sort: 12, status: 'late', status_reason: 'Missed the run due Wed Oct 7, 12:00 PM CT',
    last_real_work_at: iso(60 * 24 * 9), last_seen_at: null, last_failed_at: null, last_output_note: 'Checked 6 stores',
    next_due_at: iso(60 * 24 * 5), cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'Open Scheduled tasks on claude.ai and run it now.', fix_links: [{ label: 'Scheduled tasks', url: 'https://claude.ai/code/scheduled' }], retry_available: false },
  { id: 'fsa-capture', app_label: 'FSA Claims Tracker', label: 'Receipt capture inlet', what: 'Gmail inlet every 10 minutes.', kind: 'inlet', enabled: true,
    sched: { every: 10 }, sort: 40, status: 'failed', status_reason: 'Has never run', last_real_work_at: null, last_seen_at: null, last_failed_at: null,
    last_output_note: null, next_due_at: null, cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'The Gmail Apps Script trigger is not set up.', fix_links: [{ label: 'Apps Script', url: 'https://script.google.com/home' }], retry_available: false },
  { id: 'planner-calendar-sync', app_label: 'Optimo', label: 'Calendar sync', what: 'pg_cron job every 15 minutes.', kind: 'pg-cron', enabled: true,
    sched: { every: 15 }, sort: 32, status: 'failed', status_reason: 'Last attempt failed', last_real_work_at: iso(50), last_seen_at: iso(5), last_failed_at: iso(5),
    last_output_note: 'Called its function (HTTP request queued)', next_due_at: iso(35), cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'Check the cron history.', fix_links: links('calendar-sync'), retry_available: true },
  { id: 'ynab-sync', app_label: 'Giving Tracker', label: 'Nightly YNAB sync', what: 'Switched off.', kind: 'pg-cron', enabled: false,
    sched: { every: 1440 }, sort: 54, status: 'off', status_reason: 'Switched off', last_real_work_at: iso(60 * 24 * 31),
    last_output_note: 'Called its function (HTTP request queued)', next_due_at: null, cost_mtd: null, cost_projected: null, cost_tracked: false,
    fix_hint: 'Switched off on purpose.', fix_links: [], retry_available: false },
];
const DAILY = [];
for (let i = 0; i < 14; i++) {
  const day = new Date(NOW - i * 864e5).toISOString().slice(0, 10);
  DAILY.push({ id: 'card-scout', day, real_n: 3, quiet_n: 26, failed_n: 0, cost_usd: 0.014 });
  DAILY.push({ id: 'planner-calendar-sync', day, real_n: 96, quiet_n: 0, failed_n: i === 0 ? 1 : 0, cost_usd: 0 });
}
const PEOPLE = [
  { email: 'mark@fam.test', name: 'Mark', is_admin: true, active: true, last_seen_at: iso(30) },
  { email: 'kayley.longer.address@family.test', name: 'Kayley', is_admin: false, active: true, last_seen_at: iso(60 * 24 * 3) },
  { email: 'brandon@family.test', name: 'Brandon', is_admin: false, active: true, last_seen_at: null },
];
const APPS = (SPACES.family || []).map((p) => ({ page: p, label: (PAGES[p] && PAGES[p].title) || p, gated: true }));
const REQUESTS = [{ id: 1, email: 'brandon@family.test', page: 'remit.html', requested_at: iso(90), handled_at: null }];

// ── the fake backend, per page (each state starts fresh) ──
async function backend(page, { stewardAuthorized = true } = {}) {
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('https://fonts.googleapis.com/**', (r) => r.abort());
  await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
  await page.route('https://api.github.com/**', (r) => {
    if (r.request().url().includes('/contents/archive')) return json(r, [{ type: 'file', name: 'old-plan.html' }]);
    return json(r, [...Object.keys(PAGES), 'index.html'].map((name) => ({ type: 'file', name })));
  });
  await page.route('https://raw.githubusercontent.com/**', (r) => {
    const u = r.request().url();
    if (u.endsWith('/spaces.json')) return json(r, SPACES);
    if (u.endsWith('/pages.json')) return json(r, PAGES);
    return r.fulfill({ status: 404, body: 'nf' });
  });
  await page.route('**/auth/v1/**', (r) => {
    const u = r.request().url();
    if (/\/otp/.test(u)) return json(r, {});
    return json(r, { access_token: 'admin.jwt.sig', refresh_token: 'r1', expires_in: 3600, user: { email: 'mark@fam.test', user_metadata: { name: 'Mark' } } });
  });
  // Playwright: the LAST-registered matching route wins, so the catch-all goes first
  await page.route('**/functions/v1/**', (r) => json(r, { ok: true }));
  await page.route('**/functions/v1/steward-reports', (r) => {
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors });
    if (!stewardAuthorized) return r.fulfill({ status: 401, headers: cors, contentType: 'application/json', body: '{"error":"unauthorized"}' });
    return r.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(shape(STEWARD_ROWS)) });
  });
  await page.route('**/rest/v1/**', (r) => {
    const req = r.request();
    const u = new URL(req.url());
    const path = u.pathname.replace(/^.*\/rest\/v1/, '');
    if (req.method() !== 'GET' && !path.startsWith('/rpc/')) return r.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    if (path.startsWith('/press_agent_monitor_daily_public')) return json(r, DAILY);
    if (path.startsWith('/press_agent_monitor_public')) return json(r, AGENTS);
    if (path === '/rpc/press_access_is_admin') return json(r, true);
    if (path === '/rpc/press_access_has') return json(r, true);
    if (path === '/rpc/press_steward_capability_ok') return json(r, true);
    if (path.startsWith('/rpc/')) return r.fulfill({ status: 204, body: '' });
    if (path.startsWith('/press_access_people')) return json(r, PEOPLE);
    if (path.startsWith('/press_access_apps')) return json(r, APPS);
    if (path.startsWith('/press_access_grants')) return json(r, [{ email: 'brandon@family.test', page: 'remit.html', active: false }]);
    if (path.startsWith('/press_access_requests')) return json(r, REQUESTS);
    if (path.startsWith('/press_vault')) return json(r, [{ id: 'ui-audit', label: 'iPhone', created_at: iso(60 * 24 * 20) }]);
    return json(r, []);
  });
}
// the gate's test hook: seed storage before the page's scripts run (never a real credential)
async function seed(page, { enrolled = false, vault = false, family = false } = {}) {
  await page.addInitScript(([e, v, f]) => {
    try {
      if (e) localStorage.setItem('press:vault:enrolled', '1');
      if (v) localStorage.setItem('press:vault:v1', v);
      if (f) localStorage.setItem('press:family:v1', f);
    } catch (err) {}
  }, [enrolled, vault ? VAULT : null, family ? FAM : null]);
}
async function open(page, path, opts, ready) {
  await seed(page, opts);
  await page.goto(BASE + path, { waitUntil: 'load' });
  if (ready) await page.waitForSelector(ready, { state: 'visible', timeout: 8000 });
  await page.waitForTimeout(150);
}

export default {
  name: 'press',
  url: BASE + '/',                         // (initial) = the public lobby
  // every state starts from EMPTY storage: a context is shared across one width×scheme's states, so without this a
  // session seeded by an earlier state would leak into a later one (the first run audited access-"locked" unlocked).
  // The guard is per-tab sessionStorage, so the wipe runs once per page, before the state's own seed.
  setup: async (page) => {
    await page.addInitScript(() => { try { if (!sessionStorage.getItem('__ui_audit')) { localStorage.clear(); sessionStorage.setItem('__ui_audit', '1'); } } catch (e) {} });
    await backend(page);
  },
  states: [
    { name: 'lobby-ready', run: (p) => open(p, '/', {}, '.tw-card') },
    { name: 'archive', run: (p) => open(p, '/?view=archive', {}, '.tw-card') },
    // ── the private wing + its passkey gate (press-owned) ──
    { name: 'private-first-time', run: (p) => open(p, '/?view=personal', {}, '#unlockBtn') },
    { name: 'private-locked', run: (p) => open(p, '/?view=personal', { enrolled: true }, '#unlockBtn') },
    { name: 'private-unlocked', run: (p) => open(p, '/?view=personal', { enrolled: true, vault: true }, '.tw-card') },
    { name: 'private-devices', run: async (p) => { await open(p, '/?view=personal', { enrolled: true, vault: true }, '#devBtn'); await p.click('#devBtn'); await p.waitForSelector('#revBtn'); } },
    { name: 'private-recovery-kit', run: async (p) => { await open(p, '/?view=personal', { enrolled: true, vault: true }, '#kitBtn'); await p.click('#kitBtn'); await p.waitForSelector('#recoveryKit', { state: 'visible' }); } },
    // ── the family wing + its email-code gate ──
    { name: 'family-signin', run: (p) => open(p, '/?view=family', {}, '#fg-email') },
    { name: 'family-code', run: async (p) => { await open(p, '/?view=family', {}, '#fg-email'); await p.fill('#fg-email', 'mark@fam.test'); await p.click('#fg-send'); await p.waitForSelector('#fg-code', { state: 'visible' }); } },
    { name: 'family-signed-in', run: (p) => open(p, '/?view=family', { family: true }, '.tw-card') },
    // ── steward.html (private wing) ──
    { name: 'steward-locked', run: (p) => open(p, '/steward.html', { enrolled: true }, '#press-gate') },
    { name: 'steward-report', run: (p) => open(p, '/steward.html', { enrolled: true, vault: true }, '#latest') },
    { name: 'steward-denied', run: async (p) => {   // a key the server refuses → the honest denied state
      await p.route('**/functions/v1/steward-reports', (r) => r.request().method() === 'OPTIONS'
        ? r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })
        : r.fulfill({ status: 401, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"error":"unauthorized"}' }));
      await open(p, '/steward.html', { enrolled: true, vault: true }, '#st-denied');
    } },
    // ── agent-health.html (public monitor; admin Retry) ──
    { name: 'monitor', run: (p) => open(p, '/agent-health.html', {}, '#verdict') },
    { name: 'monitor-detail', run: (p) => open(p, '/agent-health.html#fsa-capture', {}, '.agent.open') },
    { name: 'monitor-admin', run: (p) => open(p, '/agent-health.html#planner-calendar-sync', { family: true }, '.agent.open .retry') },
    // ── access.html (private wing; admin) ──
    { name: 'access-locked', run: (p) => open(p, '/access.html', { enrolled: true }, '#pk') },
    { name: 'access-signin', run: (p) => open(p, '/access.html', { enrolled: true, vault: true }, '#em') },
    { name: 'access-admin', run: (p) => open(p, '/access.html', { enrolled: true, vault: true, family: true }, '#reqs') },
  ],
  probe: {
    surfaces: '#family-gate, #recoveryKit:not([hidden]), dialog[open], [aria-modal="true"]:not([hidden])',
    main: 'body',
    // press's pill links + text links are single-line controls too (the default set covers button / [role=button])
    oneLine: '.tw-back, .fg-back, .pg-back, a.back, .lnk',
    wrapOk: '.row .line',
  },
  exceptions: [
    '.row .line (agent-health.html) — an agent row is one <button> (tap to expand), so the probe reads its status line as a '
      + 'button label; it is server copy of variable length ("Missed the run due Wed Oct 7, 12:00 PM CT · last real work 9 days ago") '
      + 'that must wrap at phone width — truncating it would hide the reason the agent needs attention. The row title (.name) stays gated.',
  ],
};
