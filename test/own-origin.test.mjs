// own-origin pilot (cardsharp, 2026-11-13) — the vault core's OWN-ORIGIN half + the retired seal (node --test).
// enrolOwn / unlockOwn (an app's own passkey on its own host, creds returned to the caller, nothing unlock-capable
// persisted), the one-time move (moveOut → moveIn: exact origin, exact window, nonce) and purgeSeal (the 7-day seal is
// gone). Hermetic: a fake WebAuthn (fixed PRF per credential), an in-memory press_vault behind fetch, fake windows.
// The same file runs in cardsharp against its vendored gate (test/own-origin.test.mjs there) — keep them in step.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

class MemStore {
  constructor() { this.m = new Map(); }
  get length() { return this.m.size; }
  key(i) { return [...this.m.keys()][i] ?? null; }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
globalThis.localStorage = new MemStore();
// a seal an OLDER page left: the session's .seal + the IndexedDB key store — the module deletes both at load
globalThis.localStorage.setItem('press:vault:v1', JSON.stringify({ keyring: { v: 1, apps: {} }, unlockedAt: 1, expiresAt: Date.now() + 1e9, vaultId: 'x', seal: { 'cardsharp.html': { ct: 'AAAA', iv: 'BBBB', at: 1, exp: 2 } } }));
const opens = []; // D1 round 1: the seal store is re-created as a version-2 TOMBSTONE; any other open (an old seal) throws
globalThis.indexedDB = { open(name, v) { opens.push([name, v]); if (v !== 2) throw new Error('nothing may open the seal store below v2'); return {}; } };
// window-ish event plumbing for the move (Node's globalThis has no addEventListener)
const listeners = new Set();
globalThis.addEventListener = (t, fn) => { if (t === 'message') listeners.add(fn); };
globalThis.removeEventListener = (t, fn) => { if (t === 'message') listeners.delete(fn); };
const deliver = (ev) => { for (const fn of [...listeners]) fn(ev); };

// --- fake WebAuthn: each credential has a fixed 32-byte PRF; get() answers with `pick` ---------------------------
const creds = new Map(); // b64(rawId) -> prf
let pick = null, lastCreate = null, lastGet = null;
const prfOf = (seed) => new TextEncoder().encode(seed.padEnd(32, '.').slice(0, 32));
Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: {
  credentials: {
    async create(o) {
      lastCreate = o;
      const rawId = new Uint8Array(16); crypto.getRandomValues(rawId);
      const prf = prfOf('prf-' + creds.size);
      creds.set(Buffer.from(rawId).toString('base64'), prf);
      pick = rawId;
      return { rawId: rawId.buffer, getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: prf.buffer.slice(0) } } }) };
    },
    async get(o) {
      lastGet = o;
      if (!pick) { const e = new Error('no passkey'); e.name = 'NotAllowedError'; throw e; }
      const prf = creds.get(Buffer.from(pick).toString('base64')) || prfOf('stranger');
      return { rawId: pick.buffer.slice(0), getClientExtensionResults: () => ({ prf: { results: { first: prf.buffer.slice(0) } } }) };
    },
  },
} });
// --- in-memory press_vault (RLS: x-vault-id == id) -----------------------------------------------------------------
const rows = new Map();
let tamper = null, failGet = false; const posts = []; // cardsharp-outstanding S5: every POST's headers; a failing read
globalThis.fetch = async (url, init = {}) => {
  const vid = (init.headers || {})['x-vault-id'];
  const method = init.method || 'GET';
  if (method === 'POST') posts.push(init.headers || {});
  if (method !== 'POST' && failGet) return { ok: false, json: async () => [] };
  if (method === 'POST') { const b = JSON.parse(init.body); if (b.id !== vid) return { ok: false, json: async () => [] }; rows.set(b.id, b); return { ok: true, json: async () => [b] }; }
  const r = rows.get(vid);
  return { ok: true, json: async () => (r ? [tamper ? tamper(r) : r] : []) };
};

const PATH = '../src/vault.js'; // cardsharp runs this same file against its vendored gate (src/vendor/press-gate.js)
await import(PATH);
const V = globalThis.PressVault;
const PAGE = 'cardsharp.html';
const C = { syncId: 'c0ffee00c0ffee00c0ffee00c0ffee00', passphrase: 'test-only-pass-phrase-own' };

beforeEach(() => { pick = null; tamper = null; failGet = false; posts.length = 0; lastCreate = lastGet = null; });
const storageHas = (needle) => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (String(localStorage.getItem(k)).includes(needle) || k.includes(needle)) return k; } return null; };

test('the retired seal: loading the module tombstoned the IndexedDB store (v2) and stripped the session .seal', () => {
  assert.deepEqual(opens, [['press:vault:seal', 2]]);
  assert.equal(V.SEAL_TOMBSTONE, 2);
  const s = JSON.parse(localStorage.getItem('press:vault:v1'));
  assert.equal('seal' in s, false);
  assert.equal(typeof V.sealPage, 'undefined'); assert.equal(typeof V.sealMemoryOnly, 'undefined');
  localStorage.clear();
});

test('enrolOwn: own rpId, platform + client-device hints, PRF; the row reads back; only the hint flag persists', async () => {
  const r = await V.enrolOwn({ page: PAGE, creds: C, name: 'Cardsharp', label: 'cardsharp-own-origin' });
  assert.match(r.vaultId, /^[0-9a-f]{64}$/);
  assert.deepEqual(r.creds, C);
  const pk = lastCreate.publicKey;
  assert.equal(pk.rp.id, V.RP_ID);
  assert.equal(pk.authenticatorSelection.authenticatorAttachment, 'platform');
  assert.equal(pk.authenticatorSelection.userVerification, 'required');
  assert.deepEqual(pk.hints, ['client-device']);
  assert.ok(pk.extensions.prf);
  const row = rows.get(r.vaultId);
  assert.ok(row && row.ciphertext && !row.ciphertext.includes(C.syncId) && row.label === 'cardsharp-own-origin');
  // nothing unlock-capable in storage: no session, no creds — only the non-secret flag
  assert.deepEqual([...Array(localStorage.length).keys()].map((i) => localStorage.key(i)), ['press:own:enrolled']);
  assert.equal(storageHas(C.syncId), null); assert.equal(storageHas(C.passphrase), null);
  assert.equal(V.loadSession(), null);
});

test('unlockOwn: the same passkey opens the creds; nothing new persists', async () => {
  const { vaultId } = await V.enrolOwn({ page: PAGE, creds: C, name: 'Cardsharp' });
  const r = await V.unlockOwn(PAGE);
  assert.equal(r.vaultId, vaultId);
  assert.deepEqual(r.creds, C);
  assert.equal(lastGet.publicKey.rpId, V.RP_ID);
  assert.deepEqual(lastGet.publicKey.hints, ['client-device']);
  assert.equal(storageHas(C.syncId), null); assert.equal(storageHas(C.passphrase), null);
  assert.equal(V.loadSession(), null);
});

test('unlockOwn fails CLOSED: wrong key, tampered row, no row, another page', async () => {
  const { vaultId } = await V.enrolOwn({ page: PAGE, creds: C });
  // wrong key: this credential's row, sealed under another credential's PRF
  const other = await V.enrolOwn({ page: PAGE, creds: C });
  const saved = rows.get(vaultId); rows.set(vaultId, { ...rows.get(other.vaultId), id: vaultId });
  const raw = [...creds.keys()][creds.size - 2];
  pick = new Uint8Array(Buffer.from(raw, 'base64'));
  await assert.rejects(V.unlockOwn(PAGE), /Could not open/);
  rows.set(vaultId, saved);
  tamper = (r) => ({ ...r, ciphertext: r.ciphertext.slice(0, -4) + 'AAAA' });
  await assert.rejects(V.unlockOwn(PAGE), /Could not open/);
  tamper = null;
  await assert.rejects(V.unlockOwn('fsa.html'), /No credentials stored/);
  rows.delete(vaultId);
  await assert.rejects(V.unlockOwn(PAGE), /No enrolled passkey/);
});

// cardsharp-outstanding S5: the move ADOPTS an orphan — a passkey of this origin whose row was never written (an enrolOwn
// that died after create()) — instead of failing on every tap: insert-only, read back, only when the row is provably
// absent; without `adopt` (the plain gate) nothing changes; a row that exists is never overwritten
test('unlockOwn(page, adopt): an orphan passkey gets its row (insert-only, read back, flag set); never on a read error or over a row', async () => {
  localStorage.clear();
  await navigator.credentials.create({ publicKey: {} }); // the orphan: a credential, no row
  await assert.rejects(V.unlockOwn(PAGE), /No enrolled passkey/, 'the plain gate never adopts');
  assert.equal(posts.length, 0);
  failGet = true;
  await assert.rejects(V.unlockOwn(PAGE, { creds: C, label: 'cardsharp-own-origin' }), /No enrolled passkey/, 'a failed read is not "absent"');
  assert.equal(posts.length, 0, 'nothing written on a read error');
  failGet = false;
  const r = await V.unlockOwn(PAGE, { creds: C, label: 'cardsharp-own-origin' });
  assert.deepEqual(r.creds, C);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].Prefer, 'return=representation', 'insert-only: no merge-duplicates');
  assert.equal(rows.get(r.vaultId).label, 'cardsharp-own-origin');
  assert.equal(V.ownEnrolled(), true);
  assert.deepEqual((await V.unlockOwn(PAGE)).creds, C, 'the adopted row now opens with the plain gate');
  // a passkey WITH a row: adopt is ignored — its stored creds come back, the row is untouched
  const other = { syncId: 'ab'.repeat(16), passphrase: 'another-test-only-pass' };
  const before = JSON.stringify(rows.get(r.vaultId));
  assert.deepEqual((await V.unlockOwn(PAGE, { creds: other })).creds, C);
  assert.equal(JSON.stringify(rows.get(r.vaultId)), before);
  assert.equal(posts.length, 1);
});

test('enrolOwn refuses a row that does not read back as these creds (no flag set)', async () => {
  localStorage.clear();
  tamper = (r) => ({ ...r, ciphertext: r.ciphertext.slice(0, -4) + 'AAAA' });
  await assert.rejects(V.enrolOwn({ page: PAGE, creds: C }), /Could not save/);
  assert.equal(V.ownEnrolled(), false);
  await assert.rejects(V.enrolOwn({ page: PAGE, creds: { syncId: C.syncId } }), /needs a page/);
});

test('wing unlock() no longer seals anything (no IndexedDB open, no .seal)', async () => {
  localStorage.clear();
  const kr = { v: 1, apps: { [PAGE]: { sync_id: C.syncId, pass: C.passphrase } } };
  await V.enrol({ label: 't', keyring: kr }); // the wing's own enrol (rpId = this host)
  V.lock();
  await V.unlock(); // indexedDB.open throws if anything tries to seal
  const s = V.loadSession();
  assert.equal(s.seal, undefined);
  assert.deepEqual(s.keyring.apps[PAGE], { sync_id: '', pass: '', redacted: true });
  V.lock();
});

// --- the one-time move ---------------------------------------------------------------------------------------------
const WING = 'https://schnubsy.github.io';
const APP = 'https://schnubsy-cardsharp.github.io';
function fakeWin(origin) { return { origin, closed: false, sent: [], postMessage(data, target) { this.sent.push({ data, target }); } }; }

test('moveOut: answers only the opened window at its exact origin, after READY; resolves on DONE with the same nonce', async () => {
  const child = fakeWin(APP);
  const p = V.moveOut({ page: PAGE, origin: APP + '/', url: APP + '/?move=1', creds: C, win: child, timeoutMs: 5000 });
  const nonce = 'ab'.repeat(16);
  deliver({ origin: 'https://evil.example', source: child, data: { t: V.MOVE.ready, page: PAGE, nonce } }); // wrong origin
  deliver({ origin: APP, source: fakeWin(APP), data: { t: V.MOVE.ready, page: PAGE, nonce } });           // wrong window
  deliver({ origin: APP, source: child, data: { t: V.MOVE.ready, page: 'fsa.html', nonce } });            // wrong page
  deliver({ origin: APP, source: child, data: { t: V.MOVE.ready, page: PAGE, nonce: 'short' } });         // bad nonce
  assert.equal(child.sent.length, 0, 'no creds before a valid READY');
  deliver({ origin: APP, source: child, data: { t: V.MOVE.ready, page: PAGE, nonce } });
  assert.equal(child.sent.length, 1);
  assert.equal(child.sent[0].target, APP, 'exact targetOrigin');
  assert.deepEqual(child.sent[0].data, { t: V.MOVE.creds, page: PAGE, nonce, sync_id: C.syncId, pass: C.passphrase });
  deliver({ origin: APP, source: child, data: { t: V.MOVE.ready, page: PAGE, nonce: 'cd'.repeat(16) } });
  assert.equal(child.sent.length, 1, 'creds go once per move');
  deliver({ origin: APP, source: child, data: { t: V.MOVE.done, page: PAGE, nonce: 'cd'.repeat(16) } }); // wrong nonce: ignored
  let done = false; p.then(() => { done = true; });
  await new Promise((r) => setTimeout(r, 5)); assert.equal(done, false);
  deliver({ origin: APP, source: child, data: { t: V.MOVE.done, page: PAGE, nonce } });
  assert.deepEqual(await p, { page: PAGE });
  assert.equal(listeners.size, 0, 'listener removed');
});

test('moveOut: a closed tab rejects (nothing changed); bad args reject; a blocked popup rejects', async () => {
  const child = fakeWin(APP);
  const p = V.moveOut({ page: PAGE, origin: APP, url: APP + '/?move=1', creds: C, win: child });
  child.closed = true;
  await assert.rejects(p, /closed before it finished/);
  await assert.rejects(V.moveOut({ page: PAGE, origin: APP, url: 'https://evil.example/?move=1', creds: C, win: child }), /needs a page/);
  globalThis.open = () => null;
  await assert.rejects(V.moveOut({ page: PAGE, origin: APP, url: APP + '/', creds: C }), /blocked/);
  delete globalThis.open;
  assert.equal(listeners.size, 0);
});

test('moveIn: READY to the wing\'s exact origin; accepts creds only from the opener at that origin with its nonce', async () => {
  const opener = fakeWin(WING);
  globalThis.opener = opener;
  const mv = V.moveIn({ page: PAGE, wingOrigin: WING + '/press/index.html?view=personal' });
  const ready = opener.sent[0];
  assert.equal(ready.target, WING);
  assert.equal(ready.data.t, V.MOVE.ready); assert.equal(ready.data.page, PAGE);
  assert.match(ready.data.nonce, /^[0-9a-f]{32}$/);
  const nonce = ready.data.nonce;
  let got = null; mv.creds.then((c) => { got = c; });
  const msg = { t: V.MOVE.creds, page: PAGE, nonce, sync_id: C.syncId, pass: C.passphrase };
  deliver({ origin: 'https://evil.example', source: opener, data: msg });
  deliver({ origin: WING, source: fakeWin(WING), data: msg });
  deliver({ origin: WING, source: opener, data: { ...msg, nonce: 'ef'.repeat(16) } });
  deliver({ origin: WING, source: opener, data: { ...msg, sync_id: '' } });
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(got, null, 'every forged / mismatched hand-over is ignored');
  deliver({ origin: WING, source: opener, data: msg });
  assert.deepEqual(await mv.creds, C);
  assert.equal(mv.done(), true);
  const done = opener.sent.at(-1);
  assert.equal(done.target, WING);
  assert.deepEqual(done.data, { t: V.MOVE.done, page: PAGE, nonce });
  assert.equal(storageHas(C.syncId), null);
  delete globalThis.opener;
  assert.equal(V.moveIn({ page: PAGE, wingOrigin: WING }), null, 'not opened by the wing ⇒ no move');
});
