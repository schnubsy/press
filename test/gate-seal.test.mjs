// cardsharp Arc 7 slice 6 — the gate's SEALED 7-day unlock for MEMORY_ONLY pages (node --test).
// Loads src/gate.js (vault region + gate) in Node with a localStorage polyfill, a tiny in-memory IndexedDB
// (values kept by reference, as structured clone keeps a CryptoKey) and a minimal document stub.
// Hermetic test-only values; nothing here touches the network.
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
// minimal async IndexedDB: open → (upgradeneeded) → success; one object store; put/get/delete by key
function fakeIDB() {
  const dbs = new Map();
  return {
    dbs,
    open(name) {
      const req = {};
      setTimeout(() => {
        const fresh = !dbs.has(name);
        if (fresh) dbs.set(name, new Map());
        const stores = dbs.get(name);
        const db = {
          createObjectStore(s) { stores.set(s, new Map()); },
          transaction(s) {
            const m = stores.get(s); const t = {};
            t.objectStore = () => ({
              put(v, k) { m.set(k, v); return {}; },
              get(k) { return { result: m.get(k) }; },
              delete(k) { m.delete(k); return {}; },
            });
            setTimeout(() => t.oncomplete && t.oncomplete());
            return t;
          },
          close() {},
        };
        req.result = db;
        if (fresh && req.onupgradeneeded) req.onupgradeneeded();
        req.onsuccess();
      });
      return req;
    },
  };
}
function fakeDocument() {
  const nodes = new Map();
  const el = () => ({ id: '', className: '', textContent: '', disabled: false, setAttribute() {}, addEventListener() {},
    querySelector: () => el(), parentNode: null });
  return {
    nodes,
    getElementById: (id) => nodes.get(id) || null,
    createElement: () => el(),
    head: { appendChild() {} },
    body: { appendChild(n) { n.parentNode = { removeChild: () => nodes.delete(n.id) }; nodes.set(n.id, n); } },
  };
}

globalThis.localStorage = new MemStore();
globalThis.indexedDB = fakeIDB();
globalThis.document = fakeDocument();
await import('../src/gate.js');
const V = globalThis.PressVault;
const G = globalThis.PressGate;

const PAGE = 'cardsharp.html';
const SYNC = 'c0ffee00c0ffee00c0ffee00c0ffee00';
const PASS = 'test-only-pass-phrase-cardsharp';
const CREDS = { syncId: SYNC, passphrase: PASS };
const keyring = () => ({ v: 1, apps: { [PAGE]: { sync_id: SYNC, pass: PASS }, 'fsa.html': { sync_id: 'a'.repeat(32), pass: 'x' } } });
const idbKeys = () => globalThis.indexedDB.dbs.get(G.SEAL_DB)?.get('keys') || new Map();
const sess = () => JSON.parse(localStorage.getItem(V.SESSION_KEY));
const tick = () => new Promise((r) => setTimeout(r, 5));
// a NEW page load: this module's memory (_mem/_un) is gone, the persisted session stays
function freshPage() { const keep = localStorage.getItem(V.SESSION_KEY); V.lock(); if (keep) localStorage.setItem(V.SESSION_KEY, keep); }

beforeEach(() => {
  localStorage.clear();
  idbKeys().clear();
  globalThis.document = fakeDocument();
  if (!globalThis.indexedDB) globalThis.indexedDB = fakeIDB();
});

test('seal: ciphertext rides inside the session, bound to its unlockedAt/expiresAt; key is non-extractable', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  const s = sess();
  const x = s.seal[PAGE];
  assert.ok(x.ct && x.iv);
  assert.equal(x.at, s.unlockedAt);
  assert.equal(x.exp, s.expiresAt);
  assert.equal(s.expiresAt - s.unlockedAt, V.TTL_MS); // the SAME fixed 7-day expiry
  const rec = idbKeys().get(PAGE);
  assert.equal(rec.at, s.unlockedAt);
  assert.equal(rec.key.extractable, false);
  assert.deepEqual([...rec.key.usages].sort(), ['decrypt', 'encrypt']);
  await assert.rejects(crypto.subtle.exportKey('raw', rec.key));
  const dump = JSON.stringify(Object.fromEntries(localStorage.m)) + JSON.stringify([...idbKeys().entries()]);
  assert.ok(!dump.includes(SYNC) && !dump.includes(PASS), 'no plaintext sync id / pass anywhere');
});

test('unseal: a fresh page (no memory) gets the creds back', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  freshPage();
  assert.deepEqual(await G.unseal(PAGE), CREDS);
});

test('a NEW session (new unlockedAt) invalidates an old seal', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  const old = sess().seal;
  await new Promise((r) => setTimeout(r, 3));
  V.saveSession(keyring(), 'vid-1'); // a re-unlock (wing or another tab)
  const s = sess(); s.seal = old; localStorage.setItem(V.SESSION_KEY, JSON.stringify(s)); // even if the old blob survived
  assert.equal(await G.unseal(PAGE), null);
});

test('tampering fails closed: an extended expiresAt (AAD) or a swapped key → null', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  const s = sess(); s.expiresAt += 86400000; s.seal[PAGE].exp = s.expiresAt;
  localStorage.setItem(V.SESSION_KEY, JSON.stringify(s));
  assert.equal(await G.unseal(PAGE), null, 'a stretched expiry cannot be decrypted');
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  const rec = idbKeys().get(PAGE);
  rec.key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  assert.equal(await G.unseal(PAGE), null, 'a different key cannot decrypt');
});

test('lock (or expiry) → the ciphertext is gone with the session; unseal null', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  V.lock();
  assert.equal(localStorage.getItem(V.SESSION_KEY), null);
  assert.equal(await G.unseal(PAGE), null);
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  const s = sess(); s.expiresAt = Date.now() - 1; localStorage.setItem(V.SESSION_KEY, JSON.stringify(s));
  assert.equal(await G.unseal(PAGE), null);
  assert.equal(localStorage.getItem(V.SESSION_KEY), null, 'the expired session (and its seal) is dropped');
});

test('guard: a sealed session releases the page with no gate (async), then a lock brings the gate back', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  freshPage();
  let got = null, locked = 0;
  const r = G.guard({ page: PAGE, onUnlock: (c) => { got = c; }, onLock: () => { locked++; } });
  assert.deepEqual(r, { gated: false, pending: true });
  assert.equal(document.getElementById('press-gate'), null, 'no gate flash while unsealing');
  await tick(); await tick();
  assert.deepEqual(got, CREDS);
  assert.deepEqual(G.credsFor(PAGE), CREDS);
  V.lock(); // no `storage` event in Node: run the gate's watcher path by re-guarding a fresh page
  assert.equal(G.credsFor(PAGE), null, 'memory copy dropped once the session is gone');
  const r2 = G.guard({ page: PAGE, onUnlock: () => { throw new Error('must not unlock'); } });
  assert.deepEqual(r2, { gated: true });
  assert.ok(document.getElementById('press-gate'));
  await tick();
  assert.equal(idbKeys().has(PAGE), false, 'the orphaned IDB key is deleted');
});

test('guard: a seal from an older session → gate, and the stale key is removed', async () => {
  V.saveSession(keyring(), 'vid-1');
  await G.seal(PAGE, CREDS);
  const old = sess();
  V.lock(); // a fresh page: no memory
  // a NEWER session (re-unlocked elsewhere) that still carries the old blob → the binding no longer matches
  localStorage.setItem(V.SESSION_KEY, JSON.stringify({ ...old, unlockedAt: old.unlockedAt + 5, expiresAt: old.expiresAt + 5 }));
  const r = G.guard({ page: PAGE, onUnlock: () => { throw new Error('must not unlock'); } });
  assert.deepEqual(r, { gated: true });
  await tick();
  assert.equal(idbKeys().has(PAGE), false);
});

test('no IndexedDB (private mode) → memory only, exactly as before: no seal written, gate on a new page', async () => {
  const saved = globalThis.indexedDB; delete globalThis.indexedDB;
  try {
    V.saveSession(keyring(), 'vid-1');
    let got = null;
    G.guard({ page: PAGE, onUnlock: (c) => { got = c; } }); // this "tab" unlocked → creds from memory
    assert.deepEqual(got, CREDS);
    await tick();
    assert.equal(sess().seal, undefined, 'nothing sealed');
    V.saveSession({ v: 1, apps: {} }, 'vid-1'); // simulate a new page: memory gone (keyring has no creds)
    assert.deepEqual(G.guard({ page: PAGE, onUnlock: () => { throw new Error('no'); } }), { gated: true });
  } finally { globalThis.indexedDB = saved; }
});

test('other tenants unchanged: fsa.html releases from the session, nothing is sealed, no IDB key', async () => {
  V.saveSession(keyring(), 'vid-1');
  V.lock(); // drop this module's _mem (cardsharp) …
  const s = { keyring: keyring(), unlockedAt: Date.now(), expiresAt: Date.now() + V.TTL_MS, vaultId: 'vid-1' };
  s.keyring.apps[PAGE] = { sync_id: '', pass: '', redacted: true };
  localStorage.setItem(V.SESSION_KEY, JSON.stringify(s));
  let got = null;
  assert.deepEqual(G.guard({ page: 'fsa.html', onUnlock: (c) => { got = c; } }), { gated: false });
  assert.equal(got.syncId, 'a'.repeat(32));
  await tick();
  assert.equal(sess().seal, undefined);
  assert.equal(idbKeys().size, 0);
});

// the gate arms a 7-day expiry timer for an unlocked MEMORY_ONLY page; a non-memory page's check clears it so
// the test process can exit
after(() => {
  localStorage.setItem(V.SESSION_KEY, JSON.stringify({ keyring: keyring(), unlockedAt: Date.now(), expiresAt: Date.now() + V.TTL_MS, vaultId: 'v' }));
  G.guard({ page: 'fsa.html' });
});
