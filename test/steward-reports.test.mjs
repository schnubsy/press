// test/steward-reports.test.mjs — the steward-reports Edge Function's pure core (auth gate + shaping).
// The gate must FAIL CLOSED: an ungated / malformed / wrong capability never reaches the report rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPlanId, authorize, reportsPath, shape, HISTORY_DAYS } from '../supabase/functions/steward-reports/core.mjs';

const GOOD = 'c1a2b3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // throwaway
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function fakeDb(validId) {
  const calls = [];
  const db = async (path) => {
    calls.push(path);
    const m = path.match(/sync_id=eq\.([^&]+)/);
    return res(200, m && m[1] === validId ? [{ item_id: 'x' }] : []);
  };
  return { db, calls };
}

test('cleanPlanId accepts only 32 lowercase-hex (trimmed, case-folded)', () => {
  assert.equal(cleanPlanId(GOOD), GOOD);
  assert.equal(cleanPlanId('  ' + GOOD.toUpperCase() + ' '), GOOD);
  for (const bad of [null, undefined, '', 'abc', GOOD + '0', GOOD.slice(1) + 'g', GOOD + '&page=eq.x', 'eq.' + GOOD]) {
    assert.equal(cleanPlanId(bad), null, String(bad));
  }
});

test('ungated request (no x-plan-id) → 401 with NO lookup', async () => {
  const { db, calls } = fakeDb(GOOD);
  assert.deepEqual(await authorize(null, db), { ok: false, status: 401 });
  assert.deepEqual(await authorize('', db), { ok: false, status: 401 });
  assert.equal(calls.length, 0);
});

test('malformed id (filter-injection shape) → 401 with NO lookup', async () => {
  const { db, calls } = fakeDb(GOOD);
  assert.deepEqual(await authorize(GOOD + '&page=eq.cardsharp', db), { ok: false, status: 401 });
  assert.equal(calls.length, 0);
});

test('wrong capability → 401 (zero rows is NOT a pass)', async () => {
  const { db, calls } = fakeDb(GOOD);
  assert.deepEqual(await authorize('0'.repeat(32), db), { ok: false, status: 401 });
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^press_deals\?page=eq\.card-scout&sync_id=eq\.0{32}&select=item_id&limit=1$/);
});

test('right capability → ok; lookup is pinned to the card-scout page', async () => {
  const { db, calls } = fakeDb(GOOD);
  assert.deepEqual(await authorize(GOOD, db), { ok: true, status: 200 });
  assert.ok(calls[0].includes('page=eq.card-scout'));
});

test('lookup failures fail closed (503, never ok)', async () => {
  assert.deepEqual(await authorize(GOOD, async () => { throw new Error('net'); }), { ok: false, status: 503 });
  assert.deepEqual(await authorize(GOOD, async () => res(500, null)), { ok: false, status: 503 });
  assert.deepEqual(await authorize(GOOD, async () => ({ ok: true, status: 200, json: async () => { throw new Error('x'); } })), { ok: false, status: 503 });
  assert.deepEqual(await authorize(GOOD, async () => res(200, { not: 'an array' })), { ok: false, status: 401 });
});

test('reportsPath reads 12 weeks, newest first, bounded', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  const p = reportsPath(now);
  assert.ok(p.startsWith('press_steward_reports?select='));
  assert.ok(p.includes('order=run_at.desc'));
  assert.ok(p.includes('limit=60'));
  const since = decodeURIComponent(p.match(/run_at=gte\.([^&]+)/)[1]);
  assert.equal(Date.parse(since), now - HISTORY_DAYS * 86400000);
  assert.equal(HISTORY_DAYS, 84);
});

test('shape: latest in full, history light (no sections), empty-safe', () => {
  const rows = [
    { id: 3, run_at: '2026-10-12T13:47:00Z', cadence: 'weekly', headline: '🟡', summary: 's', sections: { needs_you: ['a'] } },
    { id: 2, run_at: '2026-10-01T13:47:00Z', cadence: 'monthly', headline: '🟢', summary: 't', sections: {} },
  ];
  const b = shape(rows);
  assert.equal(b.latest.id, 3);
  assert.deepEqual(b.latest.sections.needs_you, ['a']);
  assert.equal(b.history.length, 2);
  assert.equal('sections' in b.history[0], false);
  assert.deepEqual(shape([]), { latest: null, history: [] });
  assert.deepEqual(shape(null), { latest: null, history: [] });
});
