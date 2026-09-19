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
