// test/own-move.test.mjs — the wing's silent sweep of leftover own-origin creds (marquee-move-cleanup, 2026-11-15: the
// one-time move is retired; an app in OWN_ORIGIN simply lives at its own address).
// Loads the REAL sweepMovedKeyring out of index.html (no browser) with the real OWN_ORIGIN and KEYRING_ID:
//   · the sweep turns any non-{moved} entry of an own-origin app into {moved: <origin>} and touches nothing else;
//   · every wing unlock (and add-device) runs it.
// The browser twin (two wing rows, silent re-seal, no move UI) is test/own-origin.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const grab = (re, what) => { const m = idx.match(re); assert.ok(m, `index.html has ${what}`); return m[0]; };
const SRC = [
  grab(/const KEYRING_ID = [^\n]*\n/, 'KEYRING_ID'),
  grab(/const keyringId = [^\n]*\n/, 'keyringId'),
  grab(/const OWN_ORIGIN = [^\n]*\n/, 'OWN_ORIGIN'),
  grab(/function sweepMovedKeyring\(k0\)\{[\s\S]*?\n\}\n/, 'sweepMovedKeyring'),
].join('');
const load = (src) => new Function(src + '; return { sweepMovedKeyring, OWN_ORIGIN };')();
const real = load(SRC);
const none = load(SRC.replace(/const OWN_ORIGIN = \{[^}]*\};/, 'const OWN_ORIGIN = {};'));
const APP_ORIGIN = 'https://schnubsy-cardsharp.github.io';
const CREDS = { sync_id: 'c0ffee00c0ffee00c0ffee00c0ffee00', pass: 'test-only-pass' };

test('the real wing puts Cardsharp at its own origin', () => {
  assert.deepEqual({ ...real.OWN_ORIGIN }, { 'cardsharp.html': APP_ORIGIN + '/' });
});

test('sweep: an own-origin app\'s creds or stub become {moved}; other apps and an already-moved entry are untouched', () => {
  const kr = { v: 1, apps: { 'cardsharp.html': CREDS, 'fsa.html': { sync_id: 'a'.repeat(32), pass: 'fsa' }, 'card-scout.html': { sync_id: 'b'.repeat(32), pass: 's' } } };
  const { kr: out, changed } = real.sweepMovedKeyring(kr);
  assert.deepEqual(changed, ['cardsharp.html']);
  assert.deepEqual(out.apps['cardsharp.html'], { moved: APP_ORIGIN });
  assert.deepEqual(out.apps['fsa.html'], kr.apps['fsa.html']);
  assert.deepEqual(out.apps['card-scout.html'], kr.apps['card-scout.html']);
  assert.deepEqual(kr.apps['cardsharp.html'], CREDS, 'pure: the input is not mutated');
  assert.equal(JSON.stringify(out).includes(CREDS.pass), false);
  assert.deepEqual(real.sweepMovedKeyring({ v: 1, apps: { 'cardsharp.html': { sync_id: '', pass: '', redacted: true } } }).kr.apps['cardsharp.html'], { moved: APP_ORIGIN });
  assert.deepEqual(real.sweepMovedKeyring(out).changed, [], 'idempotent');
  assert.deepEqual(real.sweepMovedKeyring({ v: 1, apps: {} }).changed, [], 'never connected: nothing to add');
  assert.deepEqual(none.sweepMovedKeyring(kr).changed, [], 'no own-origin app: the sweep never fires');
});

test('every wing unlock goes through wingUnlock (unlock → silent sweep); add-device sweeps the new row', () => {
  assert.equal((idx.match(/PressVault\.unlock\(\)/g) || []).length, 1, 'the only direct unlock is inside wingUnlock');
  assert.match(idx, /async function wingUnlock\(\)\{ const r = await PressVault\.unlock\(\); await sweepMovedCreds\(\); return r; \}/);
  assert.match(idx, /await PressVault\.addPasskey\(\{label: deviceLabel\(\)\}\); await sweepMovedCreds\(\);/);
});
