// test/own-move.test.mjs — cardsharp own-origin-cleanup (2026-11-14): the GLOBAL "move complete" marker in the wing.
// Loads the REAL ownMoveState / sweepMovedKeyring out of index.html (no browser) with the real OWN_ORIGIN, KEYRING_ID and
// OWN_MOVE_COMPLETE, then with the marker list emptied (= a future own-origin app that has not moved yet).
//   · marker present ⇒ ownMoveState is null for EVERY state (move / finish / unlock / moved / none), any device;
//   · marker absent ⇒ today's one-time move states, unchanged;
//   · the sweep turns any non-{moved} entry of a marked app into {moved: <origin>} and touches nothing else.
// The browser twin (two wing rows, silent re-seal, no move UI at first paint) is test/own-origin.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const grab = (re, what) => { const m = idx.match(re); assert.ok(m, `index.html has ${what}`); return m[0]; };
const SRC = [
  grab(/const KEYRING_ID = [^\n]*\n/, 'KEYRING_ID'),
  grab(/const keyringId = [^\n]*\n/, 'keyringId'),
  grab(/const OWN_ORIGIN = [^\n]*\n/, 'OWN_ORIGIN'),
  grab(/const OWN_MOVE_COMPLETE = [^\n]*\n/, 'OWN_MOVE_COMPLETE'),
  grab(/const ownMoveDone = [^\n]*\n/, 'ownMoveDone'),
  grab(/function ownMoveState\(f, v, movedHere\)\{[\s\S]*?\n\}\n/, 'ownMoveState'),
  grab(/function sweepMovedKeyring\(k0\)\{[\s\S]*?\n\}\n/, 'sweepMovedKeyring'),
].join('');
const load = (src) => new Function(src + '; return { ownMoveState, sweepMovedKeyring, OWN_MOVE_COMPLETE };')();
const marked = load(SRC);
const unmarked = load(SRC.replace(/const OWN_MOVE_COMPLETE = \[[^\]]*\];/, 'const OWN_MOVE_COMPLETE = [];'));
const APP_ORIGIN = 'https://schnubsy-cardsharp.github.io';
const CREDS = { sync_id: 'c0ffee00c0ffee00c0ffee00c0ffee00', pass: 'test-only-pass' };
const STATES = [
  ['creds (move)', CREDS, false],
  ['creds, this device moved it (finish)', CREDS, true],
  ['redacted stub (unlock)', { sync_id: '', pass: '', redacted: true }, false],
  ['redacted stub, moved here', { sync_id: '', pass: '', redacted: true }, true],
  ['{moved}', { moved: APP_ORIGIN }, false],
  ['absent', undefined, true],
];

test('the real wing marks Cardsharp moved', () => {
  assert.deepEqual([...marked.OWN_MOVE_COMPLETE], ['cardsharp.html']);
});

test('marker present ⇒ ownMoveState is null for every state, on every device', () => {
  for (const [name, v, here] of STATES) assert.equal(marked.ownMoveState('cardsharp.html', v, here), null, name);
});

test('marker absent ⇒ today\'s one-time move (a future app still gets it)', () => {
  const want = ['move', 'finish', 'unlock', 'unlock', null, null];
  STATES.forEach(([name, v, here], i) => assert.equal(unmarked.ownMoveState('cardsharp.html', v, here), want[i], name));
  assert.equal(unmarked.ownMoveState('fsa.html', CREDS, false), null, 'not an own-origin app');
});

test('sweep: a marked app\'s creds or stub become {moved}; other apps and an already-moved entry are untouched', () => {
  const kr = { v: 1, apps: { 'cardsharp.html': CREDS, 'fsa.html': { sync_id: 'a'.repeat(32), pass: 'fsa' }, 'card-scout.html': { sync_id: 'b'.repeat(32), pass: 's' } } };
  const { kr: out, changed } = marked.sweepMovedKeyring(kr);
  assert.deepEqual(changed, ['cardsharp.html']);
  assert.deepEqual(out.apps['cardsharp.html'], { moved: APP_ORIGIN });
  assert.deepEqual(out.apps['fsa.html'], kr.apps['fsa.html']);
  assert.deepEqual(out.apps['card-scout.html'], kr.apps['card-scout.html']);
  assert.deepEqual(kr.apps['cardsharp.html'], CREDS, 'pure: the input is not mutated');
  assert.equal(JSON.stringify(out).includes(CREDS.pass), false);
  assert.deepEqual(marked.sweepMovedKeyring({ v: 1, apps: { 'cardsharp.html': { sync_id: '', pass: '', redacted: true } } }).kr.apps['cardsharp.html'], { moved: APP_ORIGIN });
  assert.deepEqual(marked.sweepMovedKeyring(out).changed, [], 'idempotent');
  assert.deepEqual(marked.sweepMovedKeyring({ v: 1, apps: {} }).changed, [], 'never connected: nothing to add');
  assert.deepEqual(unmarked.sweepMovedKeyring(kr).changed, [], 'marker absent: the sweep never fires');
});

test('every wing unlock goes through wingUnlock (unlock → silent sweep); add-device sweeps the new row', () => {
  assert.equal((idx.match(/PressVault\.unlock\(\)/g) || []).length, 1, 'the only direct unlock is inside wingUnlock');
  assert.match(idx, /async function wingUnlock\(\)\{ const r = await PressVault\.unlock\(\); await sweepMovedCreds\(\); return r; \}/);
  assert.match(idx, /await PressVault\.addPasskey\(\{label: deviceLabel\(\)\}\); await sweepMovedCreds\(\);/);
});
