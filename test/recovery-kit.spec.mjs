// arc/wings-polish slice 5 — the private-wing printable recovery kit.
// Hermetic. Proves: the unlocked wing offers "Recovery kit"; clicking it renders every keyring
// entry (app name, sync ID, passphrase) + the restore steps, built in-browser from the unlocked
// keyring (no network); card-scout shows "no passphrase" and never leaks its inert sentinel; and
// the kit is ABSENT when the wing is locked. A print-media screenshot lands in evidence.
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const EVID = join(ROOT, 'docs', 'evidence');

const PERSONAL = ['fsa.html', 'giving.html', 'retirement.html', 'card-scout.html'];
const MANIFEST = {
  'fsa.html': { title: 'FSA Claims' }, 'giving.html': { title: 'Giving' },
  'retirement.html': { title: 'Retirement' }, 'card-scout.html': { title: 'Card Scout' },
};
const SPACES = { v: 2, personal: PERSONAL, family: [] };
const SENTINEL = 'not-a-secret:card-scout-has-no-passphrase:sentinel-only-to-satisfy-credsFor';

// A populated, UNLOCKED vault session (localStorage press:vault:v1). card-scout carries only a
// sync_id + the inert gate sentinel (never a real passphrase).
function unlockedSession() {
  const now = Date.now();
  return {
    keyring: { v: 1, apps: {
      'fsa.html': { sync_id: 'fsa-sync-1111', pass: 'fsa-pass-ALPHA' },
      'giving.html': { sync_id: 'giving-sync-2222', pass: 'giving-pass-BETA' },
      'retirement.html': { sync_id: 'retire-sync-3333', pass: 'retire-pass-GAMMA' },
      'card-scout.html': { sync_id: 'cardscout-sync-4444', pass: SENTINEL },
    } },
    unlockedAt: now, expiresAt: now + 7 * 24 * 60 * 60 * 1000, vaultId: 'kit-probe',
  };
}

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

async function routes(context) {
  await context.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('https://raw.githubusercontent.com/**', route => {
    const url = route.request().url();
    if (url.endsWith('/spaces.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SPACES) }); return; }
    if (url.endsWith('/pages.json')) { route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MANIFEST) }); return; }
    route.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/**', r => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

test('unlocked wing renders the recovery kit — every keyring entry + restore steps, no sentinel', async ({ page, context }) => {
  await routes(context);
  const sess = unlockedSession();
  await context.addInitScript(s => { try { localStorage.setItem('press:vault:v1', s); localStorage.setItem('press:vault:enrolled', '1'); } catch (e) {} }, JSON.stringify(sess));
  await page.goto(base + '/?view=personal');

  const kitBtn = page.locator('#kitBtn');
  await expect(kitBtn).toBeVisible();
  await expect(page.locator('#recoveryKit')).toBeHidden();     // hidden until asked for

  await kitBtn.click();
  const kit = page.locator('#recoveryKit');
  await expect(kit).toBeVisible();

  // every tool: title, sync ID, and passphrase (card-scout: no passphrase, and NEVER the sentinel)
  for (const [title, sync, pass] of [
    ['FSA Claims', 'fsa-sync-1111', 'fsa-pass-ALPHA'],
    ['Giving', 'giving-sync-2222', 'giving-pass-BETA'],
    ['Retirement', 'retire-sync-3333', 'retire-pass-GAMMA'],
  ]) {
    await expect(kit).toContainText(title);
    await expect(kit).toContainText(sync);
    await expect(kit).toContainText(pass);
  }
  await expect(kit).toContainText('Card Scout');
  await expect(kit).toContainText('cardscout-sync-4444');
  await expect(kit).toContainText('no passphrase');
  await expect(kit).not.toContainText(SENTINEL);   // the inert sentinel is never printed

  // restore steps + generated date + the "no email reset" claim
  await expect(kit).toContainText('Set up the private wing');
  await expect(kit).toContainText('Connect your tools');
  await expect(kit).toContainText('Re-enter each app');
  await expect(kit).toContainText('Generated');
  await expect(kit).toContainText('no email reset');

  // print-media capture for evidence
  await page.emulateMedia({ media: 'print' });
  await kit.screenshot({ path: join(EVID, 'wings-polish-slice-5-recovery-kit-print.png') });
  await page.emulateMedia({ media: 'screen' });
});

test('locked wing shows NO recovery kit', async ({ page, context }) => {
  await routes(context);
  // no session seeded -> the wing paints its locked unlock screen
  await page.goto(base + '/?view=personal');
  await expect(page.locator('.tw-unlock')).toBeVisible();
  await expect(page.locator('#kitBtn')).toHaveCount(0);
  await expect(page.locator('#recoveryKit')).toHaveCount(0);
});
