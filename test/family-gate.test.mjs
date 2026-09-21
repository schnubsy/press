// family-gate.js — pure-helper + decision unit tests (node --test). No browser, no network:
// the fetch and store seams are injected via FamilyGate.cfg().
import { test } from 'node:test';
import assert from 'node:assert/strict';

// import for its side effect: assigns globalThis.FamilyGate
await import('../src/family-gate.js');
const G = globalThis.FamilyGate;

function memStore() {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}
// a router-style fake fetch: routes is [{ test:(url,opts)=>bool, reply:()=>({ok,status,json}) }]
function fakeFetch(routes) {
  return async (url, opts) => {
    for (const r of routes) if (r.test(url, opts || {})) return r.reply(url, opts || {});
    return { ok: false, status: 404, json: async () => ({}) };
  };
}
const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });

test('gatedDecision — the fail-closed union', () => {
  assert.equal(G.gatedDecision({ spacesOk: false }), true, 'spaces unreadable -> gate');
  assert.equal(G.gatedDecision({ spacesOk: true, inSpacesFamily: true }), true, 'in family -> gate');
  assert.equal(G.gatedDecision({ spacesOk: true, inSpacesFamily: false, appsOk: false }), true, 'apps unreadable -> gate');
  assert.equal(G.gatedDecision({ spacesOk: true, inSpacesFamily: false, appsOk: true, appsGated: true }), true, 'db gated -> gate');
  assert.equal(G.gatedDecision({ spacesOk: true, inSpacesFamily: false, appsOk: true, appsGated: false }), false, 'public -> open');
});

test('sessionFromToken — expires_in seconds and expires_at epoch seconds', () => {
  const a = G.sessionFromToken({ access_token: 'a', refresh_token: 'r', expires_in: 3600, user: { email: 'M@X.com', user_metadata: { name: 'Mark' } } });
  assert.equal(a.email, 'm@x.com');
  assert.equal(a.name, 'Mark');
  assert.ok(a.expires_at > Date.now() + 3000 * 1000);
  const b = G.sessionFromToken({ access_token: 'a', refresh_token: 'r', expires_at: 2000000000, user: { email: 'x@y.z' } });
  assert.equal(b.expires_at, 2000000000 * 1000, 'epoch seconds -> ms');
  assert.equal(G.sessionFromToken({ access_token: 'a' }), null, 'missing refresh -> null');
  assert.equal(G.sessionFromToken(null), null);
});

test('normSession — rejects malformed, round-trips good', () => {
  assert.equal(G.normSession({}), null);
  assert.equal(G.normSession({ access_token: 'a', refresh_token: 'r' }), null, 'no expires_at');
  const s = G.normSession({ access_token: 'a', refresh_token: 'r', expires_at: 123, email: 'A@B.c', name: 'A' });
  assert.deepEqual(s, { access_token: 'a', refresh_token: 'r', expires_at: 123, email: 'a@b.c', name: 'A' });
});

test('isExpired — honours the skew', () => {
  const now = 1_000_000;
  assert.equal(G.isExpired({ expires_at: now + 120000 }, now, 60000), false);
  assert.equal(G.isExpired({ expires_at: now + 30000 }, now, 60000), true, 'inside the skew window -> expired');
  assert.equal(G.isExpired(null, now), true);
});

test('isGated — spaces.family short-circuits before any apps read', async () => {
  let appsHit = 0;
  G.cfg({ store: memStore(), fetch: fakeFetch([
    { test: u => /spaces\.json$/.test(u), reply: () => json({ v: 2, family: ['remit.html'] }) },
    { test: u => /press_access_apps/.test(u), reply: () => { appsHit++; return json([], 401); } },
  ]) });
  assert.equal(await G.isGated('remit.html'), true);
  assert.equal(appsHit, 0, 'family page must not need an apps read');
});

test('isGated — not in family: apps 401 fails closed, apps gated:false opens', async () => {
  G.cfg({ store: memStore(), fetch: fakeFetch([
    { test: u => /spaces\.json$/.test(u), reply: () => json({ v: 2, family: ['remit.html'] }) },
    { test: u => /press_access_apps/.test(u), reply: () => json([], 401) },
  ]) });
  assert.equal(await G.isGated('other.html'), true, 'anon apps read fails -> gate');

  G.cfg({ store: memStore(), fetch: fakeFetch([
    { test: u => /spaces\.json$/.test(u), reply: () => json({ v: 2, family: ['remit.html'] }) },
    { test: u => /press_access_apps/.test(u), reply: () => json([{ page: 'other.html', gated: false }]) },
  ]) });
  assert.equal(await G.isGated('other.html'), false, 'apps gated:false -> open');
});

test('isGated — spaces.json unreadable fails closed', async () => {
  G.cfg({ store: memStore(), fetch: fakeFetch([{ test: () => true, reply: () => json({}, 500) }]) });
  assert.equal(await G.isGated('remit.html'), true);
});

test('ensureFresh — valid stays, expired refreshes, failed refresh clears', async () => {
  // valid session: returned untouched, no refresh call
  let refreshHit = 0;
  const store1 = memStore();
  store1.setItem(G.SESSION_KEY, JSON.stringify({ access_token: 'a', refresh_token: 'r', expires_at: Date.now() + 3600_000, email: 'm@x.com' }));
  G.cfg({ store: store1, fetch: fakeFetch([{ test: u => /token/.test(u), reply: () => { refreshHit++; return json({}); } }]) });
  let s = await G.ensureFresh();
  assert.equal(s.email, 'm@x.com'); assert.equal(refreshHit, 0);

  // expired session: refresh succeeds, new session saved
  const store2 = memStore();
  store2.setItem(G.SESSION_KEY, JSON.stringify({ access_token: 'old', refresh_token: 'r', expires_at: Date.now() - 1000, email: 'm@x.com' }));
  G.cfg({ store: store2, fetch: fakeFetch([
    { test: u => /token/.test(u), reply: () => json({ access_token: 'new', refresh_token: 'r2', expires_in: 3600, user: { email: 'm@x.com' } }) },
  ]) });
  s = await G.ensureFresh();
  assert.equal(s.access_token, 'new');
  assert.equal(G.loadSession().access_token, 'new', 'refreshed session persisted');

  // expired session: refresh fails -> null and cleared
  const store3 = memStore();
  store3.setItem(G.SESSION_KEY, JSON.stringify({ access_token: 'old', refresh_token: 'r', expires_at: Date.now() - 1000, email: 'm@x.com' }));
  G.cfg({ store: store3, fetch: fakeFetch([{ test: u => /token/.test(u), reply: () => json({}, 400) }]) });
  s = await G.ensureFresh();
  assert.equal(s, null);
  assert.equal(G.loadSession(), null, 'failed refresh clears the session');
});
