// arc/wings-polish slice 1 — the private-wing TTL moved to 7 days, fixed from unlock.
//
// Per Mark's ratified scope (Option 2): the shared source (src/vault.js → index.html +
// src/gate.js) is bumped THIS arc; the four PUBLISHED tenant pages keep their inlined 8h
// constant until each source repo re-vendors and re-releases (numbered HANDOFF follow-ups).
//
// The safety property that makes that deferral correct: a session is created ONCE, at the
// portal, and the tenant pages ADOPT it — they READ `expiresAt` from localStorage, they do
// NOT recompute it from their own TTL_MS. So a 7-day session minted at the portal is honoured
// in full by fsa/giving/retirement/card-scout even while their own constant still reads 8h.
// This spec proves that on the pages exactly as published (no edits).
import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TENANTS = ['fsa.html', 'giving.html', 'retirement.html', 'card-scout.html'];
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
const EIGHT_HOURS = 8 * 60 * 60 * 1000;

// A portal-minted 7-day session: unlocked now, expiring one week out — well beyond the 8h
// window a page would use if it (wrongly) recomputed the expiry from its own constant.
function sevenDaySession() {
  const now = Date.now();
  return {
    keyring: { v: 1, apps: {
      'fsa.html': { sync_id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', pass: 'x' },
      'giving.html': { sync_id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', pass: 'y' },
      'retirement.html': { sync_id: 'cccccccccccccccccccccccccccccccc', pass: 'z' },
      'card-scout.html': { sync_id: 'dddddddddddddddddddddddddddddddd' },
    } },
    unlockedAt: now,
    expiresAt: now + SEVEN_DAYS,
    vaultId: 'ttl-honored-probe',
  };
}

for (const file of TENANTS) {
  test(`published ${file} honours a 7-day session expiresAt (reads it, never recomputes to 8h)`, async ({ page, context }) => {
    const html = readFileSync(join(ROOT, file), 'utf8');
    const server = createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://localhost:${server.address().port}`;

    // Keep boot hermetic: every external call returns a benign stub so the page mounts
    // without a network error. We assert nothing about the data layer — only the session TTL.
    await context.route('https://raw.githubusercontent.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await context.route('https://api.github.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await context.route('**/auth/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    await context.route('**/rest/v1/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

    const seeded = sevenDaySession();
    await context.addInitScript(s => { try { localStorage.setItem('press:vault:v1', s); } catch (e) {} },
      JSON.stringify(seeded));

    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PressVault && window.PressVault.loadSession));

    // 1) The page ADOPTS the session: loadSession returns it, non-null, un-shortened.
    const seen = await page.evaluate(() => window.PressVault.loadSession());
    expect(seen, `${file}: loadSession dropped a still-valid 7-day session`).not.toBeNull();
    expect(seen.expiresAt).toBe(seeded.expiresAt);

    // 2) The honoured window is the full 7 days — proof the page did NOT recompute it to 8h.
    expect(seen.expiresAt - seen.unlockedAt).toBe(SEVEN_DAYS);
    expect(seen.expiresAt - Date.now()).toBeGreaterThan(EIGHT_HOURS);

    // 3) Loading the page left the stored expiresAt untouched (no refresh / no reseal on boot).
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('press:vault:v1')));
    expect(stored.expiresAt).toBe(seeded.expiresAt);

    await new Promise(r => server.close(r));
  });
}
