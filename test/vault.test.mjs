// SLICE 2 — vault module unit tests (node --test).
// Loads src/vault.js as a side-effect module; it populates globalThis.PressVault —
// the same global the browser gets. Crypto keys are non-extractable by design, so
// key identity is proven via encrypt/decrypt behaviour, exactly as the browser uses it.

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal localStorage polyfill BEFORE importing the module (the module reads
// globalThis.localStorage lazily, so this is enough to exercise the session paths).
class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
globalThis.localStorage = new MemStore();

await import('../src/vault.js');
const V = globalThis.PressVault;

const enc = (s) => new TextEncoder().encode(s);
const PRF_A = enc('prf-output-AAAAAAAAAAAAAAAAAAAAAAA'); // 32 bytes
const PRF_B = enc('prf-output-BBBBBBBBBBBBBBBBBBBBBBB'); // 32 bytes, different
const SALT1 = V.randomBytes(32);

beforeEach(() => { globalThis.localStorage.clear(); });

test('vaultIdFor is 64-hex and deterministic', async () => {
  const raw = V.randomBytes(20);
  const id1 = await V.vaultIdFor(raw);
  const id2 = await V.vaultIdFor(raw);
  assert.match(id1, /^[0-9a-f]{64}$/);
  assert.equal(id1, id2);
});

test('different raw credential ids give different vault ids', async () => {
  const a = await V.vaultIdFor(V.randomBytes(20));
  const b = await V.vaultIdFor(V.randomBytes(20));
  assert.notEqual(a, b);
});

test('round-trip: seal then open with the same key returns the keyring', async () => {
  const key = await V.deriveKey(PRF_A, SALT1);
  const kr = V.emptyKeyring();
  kr.apps['fsa.html'] = { sync_id: 'sid-123', pass: 'p@ss-abc' };
  const rec = await V.sealKeyring(kr, key);
  const out = await V.openKeyring(rec, key);
  assert.deepEqual(out, kr);
});

test('the SAME PRF output + salt derives the identical key (the property the design rests on)', async () => {
  const kr = V.emptyKeyring();
  const key1 = await V.deriveKey(PRF_A, SALT1);
  const rec = await V.sealKeyring(kr, key1);
  const key2 = await V.deriveKey(PRF_A, SALT1); // derived again, independently
  const out = await V.openKeyring(rec, key2);
  assert.deepEqual(out, kr); // key2 opens what key1 sealed => identical key
});

test('two different PRF outputs derive different keys (wrong PRF => null)', async () => {
  const kr = V.emptyKeyring();
  const keyA = await V.deriveKey(PRF_A, SALT1);
  const keyB = await V.deriveKey(PRF_B, SALT1);
  const rec = await V.sealKeyring(kr, keyA);
  assert.equal(await V.openKeyring(rec, keyB), null);
});

test('a different salt derives a different key (wrong salt => null)', async () => {
  const kr = V.emptyKeyring();
  const keyA = await V.deriveKey(PRF_A, SALT1);
  const keyOtherSalt = await V.deriveKey(PRF_A, V.randomBytes(32));
  const rec = await V.sealKeyring(kr, keyA);
  assert.equal(await V.openKeyring(rec, keyOtherSalt), null);
});

test('a flipped ciphertext byte fails closed (GCM auth) => null', async () => {
  const key = await V.deriveKey(PRF_A, SALT1);
  const rec = await V.sealKeyring(V.emptyKeyring(), key);
  const bytes = V.ub64(rec.ciphertext);
  bytes[0] ^= 0x01; // flip one bit
  const tampered = { ciphertext: V.b64(bytes), iv: rec.iv };
  assert.equal(await V.openKeyring(tampered, key), null);
});

test('a truncated record (missing iv) => null', async () => {
  const key = await V.deriveKey(PRF_A, SALT1);
  const rec = await V.sealKeyring(V.emptyKeyring(), key);
  assert.equal(await V.openKeyring({ ciphertext: rec.ciphertext }, key), null);
});

test('a malformed record (garbage ciphertext) => null', async () => {
  const key = await V.deriveKey(PRF_A, SALT1);
  assert.equal(await V.openKeyring({ ciphertext: 'not-base64-@@@', iv: 'AAAAAAAAAAAAAAAA' }, key), null);
});

test('openKeyring(null) and openKeyring({}) => null (never throws)', async () => {
  const key = await V.deriveKey(PRF_A, SALT1);
  assert.equal(await V.openKeyring(null, key), null);
  assert.equal(await V.openKeyring({}, key), null);
});

test('session: save then load returns keyring + vaultId within TTL', () => {
  const kr = V.emptyKeyring();
  V.saveSession(kr, 'vault-id-xyz');
  const s = V.loadSession();
  assert.ok(s);
  assert.equal(s.vaultId, 'vault-id-xyz');
  assert.deepEqual(s.keyring, kr);
  assert.ok(s.expiresAt - s.unlockedAt === V.TTL_MS);
});

test('session: an expired session loads as null and is removed', () => {
  V.saveSession(V.emptyKeyring(), 'v1');
  // force expiry by rewriting the stored record into the past
  const raw = JSON.parse(globalThis.localStorage.getItem(V.SESSION_KEY));
  raw.expiresAt = Date.now() - 1000;
  globalThis.localStorage.setItem(V.SESSION_KEY, JSON.stringify(raw));
  assert.equal(V.loadSession(), null);
  assert.equal(globalThis.localStorage.getItem(V.SESSION_KEY), null); // dropped
});

test('lock() clears the session', () => {
  V.saveSession(V.emptyKeyring(), 'v1');
  assert.ok(V.loadSession());
  V.lock();
  assert.equal(V.loadSession(), null);
});

test('everEnrolled flag is set after a save and survives lock()', () => {
  assert.equal(V.everEnrolled(), false);
  V.saveSession(V.emptyKeyring(), 'v1');
  assert.equal(V.everEnrolled(), true);
  V.lock();
  assert.equal(V.everEnrolled(), true); // lock is secure-section only; enrolment memory persists
});

test('GUARD ON THE GUARD: the sealed record leaks ZERO keyring values; the plaintext has all', async () => {
  const key = await V.deriveKey(PRF_A, SALT1);
  const kr = V.emptyKeyring();
  const SENTINELS = ['SYNCID_fsa_7Q2', 'PASS_fsa_9Z1', 'SYNCID_giving_K3', 'PASS_ret_M8', 'SYNCID_cardscout_R4'];
  kr.apps['fsa.html'] = { sync_id: SENTINELS[0], pass: SENTINELS[1] };
  kr.apps['giving.html'] = { sync_id: SENTINELS[2], pass: 'x' };
  kr.apps['retirement.html'] = { sync_id: 'y', pass: SENTINELS[3] };
  kr.apps['card-scout.html'] = { sync_id: SENTINELS[4] };

  const plaintext = JSON.stringify(kr);
  for (const s of SENTINELS) assert.ok(plaintext.includes(s), 'plaintext must contain ' + s);

  const rec = await V.sealKeyring(kr, key);
  const blob = rec.ciphertext + '|' + rec.iv; // everything that ever touches the wire/DB
  for (const s of SENTINELS) assert.ok(!blob.includes(s), 'sealed record must NOT contain ' + s);
  // and it still opens correctly
  assert.deepEqual(await V.openKeyring(rec, key), kr);
});

// --- SHIM NORMALISATION (the 1Password crash) ------------------------------
// 1Password's navigator.credentials shim returns the PRF output as a base64url STRING,
// not an ArrayBuffer. asBytes/prfResult must normalise it to the SAME bytes the CDP
// virtual authenticator delivers, so the derived key is identical. These are the cases
// the Playwright smoke could not catch (the virtual authenticator only ever returns
// real ArrayBuffers).
const toB64url = (bytes) => V.b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

test('a base64url STRING PRF output derives the SAME key as the equivalent Uint8Array', async () => {
  const bytes = V.randomBytes(32);
  const asString = toB64url(bytes);
  const kr = V.emptyKeyring();
  const keyFromBytes = await V.deriveKey(bytes, SALT1);
  const rec = await V.sealKeyring(kr, keyFromBytes);
  const keyFromString = await V.deriveKey(asString, SALT1); // string path
  assert.deepEqual(await V.openKeyring(rec, keyFromString), kr); // string opens what bytes sealed => same key
});

test('prfResult normalises a base64url STRING to the SAME bytes as an ArrayBuffer', () => {
  const bytes = V.randomBytes(32);
  const mk = (first) => ({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });
  assert.deepEqual(V.prfResult(mk(bytes)), bytes);                       // TypedArray in -> bytes
  assert.deepEqual(V.prfResult(mk(bytes.buffer)), bytes);               // ArrayBuffer in -> bytes
  assert.deepEqual(V.prfResult(mk(toB64url(bytes))), bytes);           // base64url string in -> SAME bytes
});

test('prfResult: a zero-length or missing PRF result is treated as ABSENT (null), not success', () => {
  const mk = (first) => ({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });
  assert.equal(V.prfResult(mk(new Uint8Array(0))), null); // zero-length buffer => absent
  assert.equal(V.prfResult(mk('')), null);                // empty string => absent
  assert.equal(V.prfResult(mk(null)), null);              // explicit null => absent
  assert.equal(V.prfResult({ getClientExtensionResults: () => ({}) }), null); // no prf ext at all
});

test('prfResult: a wrong-length PRF output is REJECTED with the human message', () => {
  const mk = (first) => ({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });
  assert.throws(() => V.prfResult(mk(V.randomBytes(16))), /can.?t hold the key/i); // too short
  assert.throws(() => V.prfResult(mk(V.randomBytes(48))), /can.?t hold the key/i); // too long
  assert.throws(() => V.prfResult(mk(toB64url(V.randomBytes(16)))), /can.?t hold the key/i); // wrong-length string too
});

test('asBytes: base64url string decodes to the exact bytes; arbitrary objects still throw', () => {
  const bytes = V.randomBytes(32);
  assert.deepEqual(V.asBytes(toB64url(bytes)), bytes);
  assert.deepEqual(V.asBytes(bytes), bytes);            // TypedArray passthrough
  assert.deepEqual(V.asBytes(bytes.buffer), bytes);     // ArrayBuffer -> bytes
  assert.throws(() => V.asBytes({}), TypeError);        // NOT loosened to accept arbitrary objects
  assert.throws(() => V.asBytes(42), TypeError);
});

// --- REGRESSION: prfResult must be TOTAL (the second 1Password crash) --------
// The last hotfix left prfResult calling asBytes(first) UNGUARDED. 1Password at CREATE
// time returned a `first` that was truthy but neither a buffer nor a base64url string, so
// asBytes threw and the throw ESCAPED prfResult -> enrol's prfViaGet fallback never ran.
const mkCred = (first) => ({ getClientExtensionResults: () => ({ prf: { results: { first } } }) });

test('REGRESSION: prfResult returns null (never throws) for every unreadable shape', () => {
  const cases = {
    'empty object {}': {},
    'numeric-keyed object': { 0: 1, 1: 2, 2: 3 },      // recovers to 3 bytes -> wrong length from a shim -> null
    'non-base64 string': 'not base64 @@@ !!!',          // asBytes throws inside -> caught -> null
    'explicit null': null,
    'zero-length buffer': new Uint8Array(0),
  };
  for (const [name, first] of Object.entries(cases)) {
    let out, threw = false;
    try { out = V.prfResult(mkCred(first)); } catch (e) { threw = true; }
    assert.equal(threw, false, `prfResult must not throw for ${name}`);
    assert.equal(out, null, `prfResult must return null for ${name}`);
  }
});

test('asBytes recovers a shim that wraps bytes in an object (.buffer view-like AND numeric-keyed)', () => {
  const bytes = V.randomBytes(32);
  // ArrayBufferView-like object exposing a real .buffer
  const viewLike = { buffer: bytes.buffer, byteOffset: 0, byteLength: 32 };
  assert.deepEqual(V.asBytes(viewLike), bytes);
  // plain object with contiguous numeric keys
  const numKeyed = {}; bytes.forEach((b, i) => { numKeyed[i] = b; });
  assert.deepEqual(V.asBytes(numKeyed), bytes);
  // and a 32-byte value recovered from either shim flows through prfResult as bytes
  assert.deepEqual(V.prfResult(mkCred(viewLike)), bytes);
  assert.deepEqual(V.prfResult(mkCred(numKeyed)), bytes);
});

test('a REAL PRF container of the wrong length is still REJECTED (kept green)', () => {
  assert.throws(() => V.prfResult(mkCred(V.randomBytes(16))), /can.?t hold the key/i);   // view
  assert.throws(() => V.prfResult(mkCred(toB64url(V.randomBytes(16)))), /can.?t hold the key/i); // string
});

// --- CARD SCOUT deals-probe verification -----------------------------------
// Card Scout has a sync id and NO passphrase, so it is verified by probing press_deals
// with the entered value as the x-plan-id header. press_deals RLS is `x-plan-id = sync_id`,
// so a WRONG key returns HTTP 200 with ZERO rows — NOT an error. That silent-empty is the
// trap that emptied Card Scout's feed, so it MUST read as a wrong key, never as success.

test('dealsVerdict: a 200 with >=1 row is VERIFIED', () => {
  assert.equal(V.dealsVerdict(true, [{ item_id: 'x' }]), 'verified');
  assert.equal(V.dealsVerdict(true, [{ item_id: 'x' }, { item_id: 'y' }]), 'verified');
});

test('dealsVerdict: a 200 with ZERO rows is a WRONG key (the silent-failure trap), NOT success', () => {
  assert.equal(V.dealsVerdict(true, []), 'wrong');
});

test('dealsVerdict: a non-200 / non-array body is UNREACHABLE or wrong, never verified', () => {
  assert.equal(V.dealsVerdict(false, null), 'unreachable'); // network / non-200
  assert.equal(V.dealsVerdict(false, [{ item_id: 'x' }]), 'unreachable'); // rows ignored when !ok
  assert.equal(V.dealsVerdict(true, null), 'wrong');   // 200 but unparseable-to-array => not verified
  assert.equal(V.dealsVerdict(true, {}), 'wrong');
});

test('verifyCardScout: a correct key (200 + a row) => verified; the probe sends x-plan-id and hits press_deals', async () => {
  let seen = null;
  const fakeFetch = async (url, init) => { seen = { url, headers: init.headers }; return { ok: true, json: async () => [{ item_id: 'deal-1' }] }; };
  const verdict = await V.verifyCardScout('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6', { fetch: fakeFetch });
  assert.equal(verdict, 'verified');
  assert.match(seen.url, /\/rest\/v1\/press_deals\?/);
  assert.match(seen.url, /page=eq\.card-scout/);
  assert.match(seen.url, /limit=1/);
  assert.equal(seen.headers['x-plan-id'], 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'); // entered value carried as the gate header
});

test('verifyCardScout: 200 with ZERO rows => WRONG (must NOT be read as success)', async () => {
  const fakeFetch = async () => ({ ok: true, json: async () => [] });
  assert.equal(await V.verifyCardScout('deadbeefdeadbeefdeadbeefdeadbeef', { fetch: fakeFetch }), 'wrong');
});

test('verifyCardScout: a non-200 response => unreachable (surfaced as a plain retry, never a status code)', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, json: async () => ({ code: '42501' }) });
  assert.equal(await V.verifyCardScout('deadbeefdeadbeefdeadbeefdeadbeef', { fetch: fakeFetch }), 'unreachable');
});

test('verifyCardScout: a thrown fetch or an empty sync id => unreachable, never a crash', async () => {
  const boom = async () => { throw new Error('offline'); };
  assert.equal(await V.verifyCardScout('deadbeefdeadbeefdeadbeefdeadbeef', { fetch: boom }), 'unreachable');
  assert.equal(await V.verifyCardScout('', { fetch: async () => ({ ok: true, json: async () => [{}] }) }), 'unreachable');
});

test('REGRESSION: enrol falls through to prfViaGet when CREATE yields an unusable value, then succeeds from the assertion', async () => {
  const PRF32 = V.randomBytes(32);
  const rawId = V.randomBytes(20);
  // globalThis.navigator is a getter-only prop in Node — stub it via defineProperty and restore.
  const savedNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const savedFetch = globalThis.fetch;
  let getCalls = 0;
  globalThis.fetch = async () => ({ ok: true, json: async () => [{}] }); // putRow -> ok
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true, writable: true,
    value: {
      credentials: {
        // CREATE: 1Password shape — enabled but no usable results.first
        create: async () => ({ rawId, getClientExtensionResults: () => ({ prf: { enabled: true, results: { first: {} } } }) }),
        // ASSERTION: the real 32-byte PRF arrives here (as an ArrayBuffer)
        get: async () => { getCalls++; return { rawId, getClientExtensionResults: () => ({ prf: { results: { first: PRF32.buffer.slice(0) } } }) }; },
      },
    },
  });
  try {
    const out = await V.enrol({ label: 'unit-regression' });
    assert.ok(out && out.vaultId, 'enrol resolved with a vaultId (did not throw)');
    assert.equal(getCalls, 1, 'the assertion path (prfViaGet) was used exactly once');
    // the enrolled keyring must be openable by a key derived from the SAME 32-byte PRF
    const row = V.loadSession();
    assert.ok(row && row.keyring, 'a session keyring was saved');
    assert.equal(await V.vaultIdFor(rawId), out.vaultId, 'vaultId is derived from the credential id');
  } finally {
    if (savedNavDesc) Object.defineProperty(globalThis, 'navigator', savedNavDesc); else delete globalThis.navigator;
    globalThis.fetch = savedFetch;
  }
});
