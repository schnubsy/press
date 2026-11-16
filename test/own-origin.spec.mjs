// own-origin pilot (cardsharp, 2026-11-13) — the REAL wing (index.html) with an app on its OWN origin, end to end.
// Replaces sealed-unlock.spec.mjs: the 7-day seal is retired (src/vault.js purgeSeal). Proves, in a real browser:
//   · the wing's Cardsharp card links to https://schnubsy-cardsharp.github.io/ and navigation is seamless both ways
//     (card → app → ← Private Wing → Back → Forward) — desktop + iphone-webkit;
//   · no move UI ever (the one-time move is retired, marquee-move-cleanup 2026-11-15): a wing row that still holds
//     Cardsharp's creds is silently re-sealed with only {moved} on its next unlock; Connect says "At its own address",
//     the recovery kit names the new address — and no creds in storage;
//   · the retired seal: one wing visit deletes an older page's IndexedDB `press:vault:seal` + the session's .seal, and a
//     wing unlock creates neither.
// Hermetic: both prod hosts are ROUTED inside the browser (real origins → real rpIds and postMessage origins); GitHub and
// Supabase intercepted; press_vault is an in-memory RLS-gated mock; CDP virtual authenticators (PRF) per tab.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');
const GATE = readFileSync(join(ROOT, 'src', 'gate.js'), 'utf8');
const WING_ORIGIN = 'https://schnubsy.github.io', APP_ORIGIN = 'https://schnubsy-cardsharp.github.io';
const WING = WING_ORIGIN + '/press/index.html?view=personal', APP = APP_ORIGIN + '/';
const SYNC = 'c0ffee00c0ffee00c0ffee00c0ffee00'; // hermetic test-only values
const PASS = 'test-only-pass-phrase-cardsharp';
const APP_PAGE = `<!doctype html><meta charset="utf-8"><title>Cardsharp</title><body><main id="app" hidden><p>open</p></main>
<script>${GATE.replace(/<\/script/gi, '<\\/script')}</script>
<script>
PressGate.guardOwn({ page: 'cardsharp.html', name: 'Cardsharp', wing: ${JSON.stringify(WING)},
  onUnlock: function (c) { document.getElementById('app').hidden = false; document.body.dataset.unlocked = (c && c.syncId === ${JSON.stringify(SYNC)}) ? 'yes' : 'wrong'; },
  onLock: function () { document.getElementById('app').hidden = true; delete document.body.dataset.unlocked; } });
</script>`;

async function routes(context, { vault = new Map() } = {}) {
  await context.route('https://api.github.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: r.request().url().includes('/contents/archive') ? '[]' : JSON.stringify(['fsa.html', 'cardsharp.html', 'index.html'].map((name) => ({ type: 'file', name }))) }));
  await context.route('https://raw.githubusercontent.com/**', (r) => {
    const u = r.request().url();
    if (u.endsWith('/spaces.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 1, personal: ['fsa.html', 'cardsharp.html'] }) });
    if (u.endsWith('/pages.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ 'fsa.html': { title: 'fsa' }, 'cardsharp.html': { title: 'Cardsharp' } }) });
    return r.fulfill({ status: 404, body: 'nf' });
  });
  await context.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await context.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await context.route('**/rest/v1/press_vault**', (route) => {
    const req = route.request(); const vid = req.headers()['x-vault-id'] || '';
    if (req.method() === 'GET') { const row = vault.get(vid); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [row] : []) }); }
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      if (body.id !== vid) return route.fulfill({ status: 401, body: '{}' });
      vault.set(vid, body); return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([body]) });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await context.route(WING_ORIGIN + '/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    if (p === '/press/' || p === '/press/index.html') return r.fulfill({ status: 200, contentType: 'text/html', body: INDEX });
    if (p === '/press/blank.html') return r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>blank</title>' });
    return r.fulfill({ status: 404, body: 'nf' });
  });
  await context.route(APP_ORIGIN + '/**', (r) => {
    const p = new URL(r.request().url()).pathname;
    return p === '/' ? r.fulfill({ status: 200, contentType: 'text/html', body: APP_PAGE }) : r.fulfill({ status: 404, body: 'nf' });
  });
  return vault;
}
async function authenticator(context, page) {
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal',
    hasResidentKey: true, hasUserVerification: true, hasPrf: true, isUserVerified: true, automaticPresenceSimulation: true } });
}
const lsDump = (page) => page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
const idbNames = (page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
const KEYRING = { v: 1, apps: { 'cardsharp.html': { sync_id: SYNC, pass: PASS }, 'fsa.html': { sync_id: 'a'.repeat(32), pass: 'fsa-test-pass' } } };
const cardsharpCard = (page) => page.locator('#root a.tw-card[data-file="cardsharp.html"], a.tw-card[data-file="cardsharp.html"]').first();

test('the wing card opens Cardsharp at its own address; ← Private Wing, Back and Forward all land right (Chromium + iPhone WebKit)', async ({ page, context }) => {
  await routes(context);
  await page.goto(WING);
  await page.evaluate((kr) => { PressVault.saveSession(kr, 'nav-vid'); }, KEYRING); // an unlocked wing (no passkey needed to navigate)
  await page.reload();
  const card = cardsharpCard(page);
  await expect(card).toHaveAttribute('href', APP);
  await card.click();
  await expect(page).toHaveURL(APP);
  await expect(page.locator('#press-gate')).toBeVisible();
  await expect(page.locator('#press-gate .pg-back')).toHaveAttribute('href', WING);
  await page.locator('#press-gate .pg-back').click();
  await expect(page).toHaveURL(WING);
  await expect(cardsharpCard(page)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(APP);
  await expect(page.locator('#press-gate')).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(WING);
  await expect(cardsharpCard(page)).toBeVisible();
});

test.describe('needs a passkey (CDP virtual authenticator — desktop Chromium)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'CDP virtual authenticator');

  // Two devices = two virtual authenticators = two wing rows in ONE press_vault. Device A's row holds {moved}; device B's
  // row still holds Cardsharp's creds (a leftover from before the move). Device B never paints move UI — not on a restored
  // session, not locked, not after unlock — its ordinary unlock re-seals its own row without Cardsharp (one passkey prompt
  // total, no toast), the card opens the own origin, and nothing unlock-capable is left in storage.
  test('own origin: device B with a stale row — no move UI ever painted; its normal unlock silently drops Cardsharp from its row', async ({ browser }) => {
    const vault = new Map();
    const watch = () => { // records every passkey call + any move UI ever painted (from the first byte of every load)
      window.__calls = { get: 0, create: 0 }; window.__moveUI = [];
      const c = navigator.credentials, g = c.get.bind(c), cr = c.create.bind(c);
      c.get = (o) => { window.__calls.get++; return g(o); };
      c.create = (o) => { window.__calls.create++; return cr(o); };
      const seen = () => { const el = document.querySelector('.tw-move, .tw-move-btn'); if (el) window.__moveUI.push(el.textContent.trim());
        if (/move Cardsharp|Finish moving|Unlock to move/i.test((document.body && document.body.innerText) || '')) window.__moveUI.push('text'); };
      new MutationObserver(seen).observe(document, { childList: true, subtree: true, characterData: true });
    };
    const device = async () => {
      const context = await browser.newContext();
      await routes(context, { vault });
      await context.addInitScript(watch);
      const page = await context.newPage();
      await authenticator(context, page);
      return { context, page };
    };
    // device A moved Cardsharp: its row keeps only {moved}
    const A = await device();
    await A.page.goto(WING);
    await A.page.evaluate(async (kr) => { await PressVault.enrol({ label: 'device-a', keyring: kr }); },
      { v: 1, apps: { 'cardsharp.html': { moved: APP_ORIGIN }, 'fsa.html': KEYRING.apps['fsa.html'] } });
    const rowA = JSON.stringify([...vault.values()][0]);
    // device B: its own passkey row still holds the creds, and it remembers an old per-device "moved" mark
    const B = await device();
    await B.page.goto(WING);
    await B.page.evaluate(async (kr) => { localStorage.setItem('press:own:moved', JSON.stringify(['cardsharp.html'])); await PressVault.enrol({ label: 'device-b', keyring: kr }); }, KEYRING);
    expect(vault.size).toBe(2);
    const idB = [...vault.keys()].find((k) => JSON.stringify(vault.get(k)) !== rowA);
    const rowBefore = JSON.stringify(vault.get(idB));
    // 1) a restored session (redacted Cardsharp stub — the iPhone's "Unlock to move" state): first paint has no move UI
    await B.page.reload();
    await expect(cardsharpCard(B.page)).toBeVisible();
    await expect(B.page.locator('.tw-move')).toHaveCount(0);
    await expect(B.page.locator('.tw-tool[data-f="cardsharp.html"] .tw-tool-status')).toHaveText('● At its own address');
    expect(await B.page.evaluate(() => localStorage.getItem('press:own:moved'))).toBeNull(); // the retired per-device mark is gone
    await B.page.locator('#kitBtn').click(); // the not-yet-swept row: the kit names the address, never asks to unlock for it
    await expect(B.page.locator('#recoveryKit')).toContainText('moved to its own address (' + APP_ORIGIN + ')');
    await expect(B.page.locator('#recoveryKit')).not.toContainText(PASS);
    await B.page.locator('#kitDone').click();
    // 2) locked → the ordinary wing unlock
    await B.page.evaluate(() => PressVault.lock());
    await B.page.reload();
    await expect(B.page.locator('#unlockBtn')).toBeVisible();
    await B.page.locator('#unlockBtn').click();
    await expect(cardsharpCard(B.page)).toBeVisible();
    await expect.poll(() => JSON.stringify(vault.get(idB))).not.toBe(rowBefore); // row B re-sealed
    await expect(B.page.locator('.tw-move')).toHaveCount(0);
    expect(await B.page.evaluate(() => window.__calls)).toEqual({ get: 1, create: 0 }); // one tap: the unlock itself
    expect(await B.page.evaluate(() => window.__moveUI)).toEqual([]);
    // 3) re-read row B from the vault in a FRESH tab memory: no Cardsharp sync_id / pass, fsa intact
    await B.page.evaluate(() => PressVault.lock());
    const apps = await B.page.evaluate(async () => (await PressVault.unlock()).keyring.apps);
    expect(apps['cardsharp.html']).toEqual({ moved: APP_ORIGIN });
    expect(apps['fsa.html'].pass).toBe('fsa-test-pass');
    expect(JSON.stringify(vault.get(idB))).not.toContain(PASS);
    expect(JSON.stringify(vault.get([...vault.keys()].find((k) => k !== idB)))).toBe(rowA); // row A untouched
    // 4) nothing unlock-capable persisted on either device (key scan), no move UI on A either
    for (const p of [A.page, B.page]) for (const [k, v] of Object.entries(await lsDump(p))) { expect(v, k).not.toContain(PASS); expect(v, k).not.toContain(SYNC); }
    await A.page.reload();
    await expect(A.page.locator('.tw-move')).toHaveCount(0);
    expect(await A.page.evaluate(() => window.__moveUI)).toEqual([]);
    // 5) the card opens the own origin
    await expect(cardsharpCard(B.page)).toHaveAttribute('href', APP);
    await B.page.reload();
    await cardsharpCard(B.page).click();
    await expect(B.page).toHaveURL(APP);
    await A.context.close(); await B.context.close();
  });

  test('the retired seal: one wing visit empties an older page\'s IndexedDB key store into a v2 tombstone (old code cannot reopen it) + drops the session .seal; a wing unlock creates neither', async ({ page, context }) => {
    await routes(context);
    await authenticator(context, page);
    await page.goto(WING_ORIGIN + '/press/blank.html');
    await page.evaluate(async () => {
      await new Promise((ok) => { const o = indexedDB.open('press:vault:seal', 1); o.onupgradeneeded = () => o.result.createObjectStore('keys');
        o.onsuccess = () => { const t = o.result.transaction('keys', 'readwrite'); t.objectStore('keys').put({ key: 'x', at: 1 }, 'cardsharp.html'); t.oncomplete = () => { o.result.close(); ok(); }; }; });
      localStorage.setItem('press:vault:v1', JSON.stringify({ keyring: { v: 1, apps: {} }, unlockedAt: 1, expiresAt: Date.now() + 864e5, vaultId: 'v', seal: { 'cardsharp.html': { ct: 'AA', iv: 'BB', at: 1, exp: 2 } } }));
    });
    expect(await idbNames(page)).toContain('press:vault:seal');
    await page.goto(WING);
    const stores = () => page.evaluate(() => new Promise((ok) => { const o = indexedDB.open('press:vault:seal'); o.onsuccess = () => { const r = { version: o.result.version, stores: [...o.result.objectStoreNames] }; o.result.close(); ok(r); }; }));
    await expect.poll(stores).toEqual({ version: 2, stores: [] }); // emptied → a tombstone
    const oldOpen = () => page.evaluate(() => new Promise((ok) => { const o = indexedDB.open('press:vault:seal', 1); o.onsuccess = () => { o.result.close(); ok('ok'); }; o.onerror = () => ok(o.error && o.error.name); }));
    expect(await oldOpen()).toBe('VersionError'); // a page with the OLD vault (thrift-shop.html until re-vendored) cannot seal
    expect('seal' in JSON.parse(await page.evaluate(() => localStorage.getItem('press:vault:v1')))).toBe(false);
    await page.evaluate(async (kr) => { PressVault.lock(); await PressVault.enrol({ label: 'w', keyring: kr }); PressVault.lock(); await PressVault.unlock(); }, KEYRING);
    expect(await stores()).toEqual({ version: 2, stores: [] });
    expect(JSON.parse(await page.evaluate(() => localStorage.getItem('press:vault:v1'))).seal).toBeUndefined();
  });
});
