// Shared hermetic harness for the drag-reorder specs (cardsharp Arc 10 slice 11).
// index.html is served from localhost; GitHub + Supabase are intercepted so NOTHING touches
// production. press_portal is an in-memory, STATEFUL mock (GET returns the last POSTed state),
// so "persists across reload" can be proven against the shared store, not just localStorage.
// Not a spec file (no .spec.mjs) — imported by wing-drag.spec.mjs / wing-drag-iphone.spec.mjs.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');

export const PUBLIC_FILES = ['council-guide.html', 'kayley.html', 'halvsies.html'];
export const PERSONAL_FILES = ['fsa.html', 'giving.html', 'retirement.html'];
export const FAMILY_FILES = ['remit.html', 'perth.html'];
const ALL = [...PUBLIC_FILES, ...PERSONAL_FILES, ...FAMILY_FILES];
// manifest order = oldest→newest; the public default order is newest-first
const MANIFEST = Object.fromEntries(ALL.map(f => [f, { title: f.replace(/\.html$/, '') }]));
const SPACES = { v: 2, personal: PERSONAL_FILES, family: FAMILY_FILES };
export const PKEY = 'press:portal:v1';

export async function startServer() {
  const server = createServer((req, res) => {
    if (req.url === '/' || req.url.startsWith('/index.html') || req.url.startsWith('/?')) {
      res.writeHead(200, { 'content-type': 'text/html' }); res.end(INDEX); return;
    }
    res.writeHead(404); res.end('not found');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, base: `http://localhost:${server.address().port}` };
}

// opts.portal: initial press_portal 'marquee' state (null = no row); opts.vault / opts.family seed sessions
export async function harness(context, opts = {}) {
  const state = { portal: opts.portal || null, posts: [] };
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
  await context.route('**/rest/v1/press_portal**', route => {
    const req = route.request();
    if (req.method() === 'GET') {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state.portal ? [{ state: state.portal }] : []) });
      return;
    }
    const body = JSON.parse(req.postData() || '{}');
    if (body.page === 'marquee') { state.portal = body.state; state.posts.push(body.state); }
    route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
  });
  await context.route('**/rest/v1/press_vault**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('**/rest/v1/rpc/**', route => route.fulfill({ status: 204, body: '' }));
  await context.route('**/auth/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  if (opts.vault) {
    const now = Date.now();
    const sess = { keyring: { v: 1, apps: {} }, unlockedAt: now, expiresAt: now + 7 * 864e5, vaultId: 'drag-probe' };
    await context.addInitScript(s => { try { localStorage.setItem('press:vault:v1', s); localStorage.setItem('press:vault:enrolled', '1'); } catch (e) {} }, JSON.stringify(sess));
  }
  if (opts.family) {
    // a valid, future-dated family session (normSession shape) — requireSession resolves silently
    const fam = { access_token: 'header.payload.sig', refresh_token: 'refresh-xyz', expires_at: Date.now() + 3600e3, email: 'mark@family.test', name: 'Mark' };
    await context.addInitScript(s => { try { localStorage.setItem('press:family:v1', s); } catch (e) {} }, JSON.stringify(fam));
  }
  return state;
}

export const order = page => page.locator('.tw-card').evaluateAll(cs => cs.map(c => c.dataset.file));

// drop the localStorage mirror so a reload must read the order back from the shared store
export async function reloadFromCloud(page) {
  await page.evaluate(k => localStorage.removeItem(k), PKEY);
  await page.reload();
}
