// Agent Monitor (arc marquee-wings-monitor, slice 4) — pure helpers + watcher logic.
//   • month projection = MTD + avg(last 7 COMPLETE America/Chicago days) × remaining CT days (fractional)
//   • CT day keys (not UTC) for the strip
//   • status → dot/verdict mapping and app grouping (the page never computes health itself)
//   • the watcher alerts only on changes that matter; the GH notifier run maps to real work
import { test } from 'node:test';
import assert from 'node:assert/strict';

await import('../src/agent-monitor.js');
const AM = globalThis.AgentMonitor;
const W = await import('../supabase/functions/agent-watch/watch-core.mjs');

const at = (iso) => new Date(iso).getTime();

test('CT day keys: 03:00 UTC on Oct 13 is still Oct 12 in Chicago', () => {
  assert.equal(AM.ctDayKey(at('2026-10-13T03:00:00Z')), '2026-10-12');
  assert.equal(AM.ctDayKey(at('2026-10-13T05:30:00Z')), '2026-10-13');
});

test('CT midnight handles CDT and CST', () => {
  assert.equal(new Date(AM.ctMidnight(2026, 10, 12)).toISOString(), '2026-10-12T05:00:00.000Z'); // CDT
  assert.equal(new Date(AM.ctMidnight(2026, 12, 1)).toISOString(), '2026-12-01T06:00:00.000Z');  // CST
  assert.equal(new Date(AM.ctMidnight(2026, 13, 1)).toISOString(), '2027-01-01T06:00:00.000Z');  // month 13 rolls
});

test('last 7 complete CT days exclude today', () => {
  const days = AM.lastCompleteDays(at('2026-10-12T15:00:00Z'), 7);
  assert.deepEqual(days, ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11']);
});

test('remaining days are fractional to the next CT month start', () => {
  // Oct 12 10:00 CDT → Nov 1 00:00 CDT = 19 days 14 hours
  const r = AM.remainingDaysInMonth(at('2026-10-12T15:00:00Z'));
  assert.ok(Math.abs(r - (19 + 14 / 24)) < 1e-9, String(r));
});

test('projection = MTD + avg(last 7 complete days) × remaining days', () => {
  const now = at('2026-10-12T15:00:00Z');
  const daily = { '2026-10-05': 0.02, '2026-10-06': 0.02, '2026-10-07': 0.02, '2026-10-08': 0.02,
                  '2026-10-09': 0.02, '2026-10-10': 0.02, '2026-10-11': 0.02, '2026-10-12': 5 /* today: ignored */ };
  const p = AM.projectMonth(0.80, daily, now);
  assert.ok(Math.abs(p.avg7 - 0.02) < 1e-12);
  assert.ok(Math.abs(p.projected - (0.80 + 0.02 * (19 + 14 / 24))) < 1e-9);
  // the OLD formula (mtd / dayOfMonth × daysInMonth) would say 0.80/12*31 = 2.07 — not what we get
  assert.ok(Math.abs(p.projected - 2.0667) > 0.5);
});

test('projection: a quiet week projects only what is already spent', () => {
  const p = AM.projectMonth(1.25, {}, at('2026-10-20T15:00:00Z'));
  assert.equal(p.projected, 1.25);
});

test('status mapping: server status → dot; unknown never shows green', () => {
  assert.equal(AM.statusMeta('healthy').dot, 'ok');
  assert.equal(AM.statusMeta('late').dot, 'warn');
  assert.equal(AM.statusMeta('failed').dot, 'bad');
  assert.equal(AM.statusMeta('off').dot, 'off');
  assert.equal(AM.statusMeta('no-data').dot, 'none');
  assert.equal(AM.statusMeta('skipped').dot, 'none');   // anything unexpected is "No data", not healthy
  assert.equal(AM.needsFix({ status: 'late' }), true);
  assert.equal(AM.needsFix({ status: 'healthy' }), false);
});

test('overall verdict: failed → red, late → amber, otherwise green; off rows ignored', () => {
  const rows = (s) => s.map((status, i) => ({ id: 'a' + i, status }));
  assert.equal(AM.overallVerdict(rows(['healthy', 'failed', 'late'])).cls, 'red');
  assert.equal(AM.overallVerdict(rows(['healthy', 'late'])).cls, 'amber');
  assert.equal(AM.overallVerdict(rows(['healthy', 'no-data', 'off'])).cls, 'green');
  assert.equal(AM.overallVerdict(rows(['off'])).cls, 'grey');
  assert.match(AM.overallVerdict(rows(['healthy', 'no-data'])).sub, /1 with no data yet/);
});

test('groupByApp: worst app first, off rows set aside', () => {
  const g = AM.groupByApp([
    { id: 'x', app_label: 'Optimo', label: 'X', status: 'healthy', sort: 1 },
    { id: 'y', app_label: 'Card Scout', label: 'Y', status: 'failed', sort: 2 },
    { id: 'z', app_label: 'Card Scout', label: 'Z', status: 'healthy', sort: 1 },
    { id: 'o', app_label: 'Giving Tracker', label: 'O', status: 'off', sort: 1 },
  ]);
  assert.deepEqual(g.groups.map((x) => x.app), ['Card Scout', 'Optimo']);
  assert.deepEqual(g.groups[0].items.map((x) => x.id), ['z', 'y']);
  assert.equal(g.groups[0].worst, 'failed');
  assert.deepEqual(g.off.map((x) => x.id), ['o']);
});

test('schedule words', () => {
  assert.equal(AM.schedText(null), 'On demand');
  assert.equal(AM.schedText({ every: 15 }), 'Every 15 minutes');
  assert.equal(AM.schedText({ every: 1440 }), 'Daily');
  assert.equal(AM.schedText({ daily: ['07:00', '18:00'] }), 'Daily at 7:00 AM, 6:00 PM CT');
  assert.equal(AM.schedText({ weekly: { dow: 3, at: '12:00' } }), 'Every Wednesday at 12:00 PM CT');
  assert.equal(AM.schedText({ monthly: { dom: 2, at: '09:00' } }), 'Monthly on the 2nd at 9:00 AM CT');
});

test('admin session: reads press:family:v1, rejects junk', () => {
  const store = (v) => ({ getItem: () => v });
  const good = JSON.stringify({ access_token: 'a.b.c', refresh_token: 'r', expires_at: 2e12, email: 'M@X.test' });
  assert.equal(AM.readSession(store(good)).email, 'm@x.test');
  assert.equal(AM.readSession(store('{"access_token":"x"}')), null);
  assert.equal(AM.readSession(store('not json')), null);
  assert.equal(AM.readSession(null), null);
  assert.equal(AM.sessionFresh({ expires_at: 1000 + 120000 }, 1000), true);
  assert.equal(AM.sessionFresh({ expires_at: 1000 + 30000 }, 1000), false);
});

test('watcher: alerts into trouble, escalation and recovery only', () => {
  assert.equal(W.isAlertingChange(null, 'failed'), true);     // first sight of a broken thing
  assert.equal(W.isAlertingChange(null, 'healthy'), false);
  assert.equal(W.isAlertingChange('healthy', 'late'), true);
  assert.equal(W.isAlertingChange('late', 'failed'), true);
  assert.equal(W.isAlertingChange('failed', 'late'), false);
  assert.equal(W.isAlertingChange('failed', 'healthy'), true);
  assert.equal(W.isAlertingChange('late', 'off'), false);
  assert.equal(W.isAlertingChange('healthy', 'no-data'), false);
  assert.equal(W.isAlertingChange('failed', 'failed'), false);
});

test('watcher: diff stores every change, alerts only the ones that matter', () => {
  const rows = [
    { id: 'a', label: 'A', app_label: 'App', status: 'failed', status_reason: 'Has never run', fix_hint: 'Set it up' },
    { id: 'b', label: 'B', app_label: 'App', status: 'healthy' },
    { id: 'c', label: 'C', app_label: 'App', status: 'no-data' },
  ];
  const { upserts, alerts } = W.diffStates(rows, { b: { status: 'healthy' }, c: { status: 'healthy' } }, 'T');
  assert.deepEqual(upserts.map((u) => u.id), ['a', 'c']);
  assert.deepEqual(alerts.map((a) => a.id), ['a']);
  const msg = W.formatAlert(alerts, 0, 'https://x/agent-health.html');
  assert.equal(msg.push.title, 'App · A FAILED');
  assert.match(msg.push.body, /Fix: Set it up/);
  assert.equal(msg.push.priority, 1);
  assert.match(msg.mail.text, /agent-health\.html/);
});

test('watcher: notices its own gap', () => {
  assert.equal(W.selfGapMinutes(null, 0), 0);
  assert.equal(W.selfGapMinutes(new Date(0).toISOString(), 20 * 60000), 0);
  assert.equal(W.selfGapMinutes(new Date(0).toISOString(), 90 * 60000), 90);
});

test('GH notifier runs: a run that flagged a problem still did its job', () => {
  assert.equal(W.ghRunToRow({ id: 1, conclusion: 'failure', updated_at: 'u', run_started_at: 's' }).outcome, 'ok');
  assert.equal(W.ghRunToRow({ id: 2, conclusion: 'success', updated_at: 'u' }).outcome, 'ok');
  assert.equal(W.ghRunToRow({ id: 3, conclusion: 'cancelled', updated_at: 'u' }).outcome, 'error');
  assert.equal(W.ghRunToRow({ id: 4, conclusion: 'success', updated_at: 'u' }).run_id, 'gh:4');
});

const GH = await import('../.github/scripts/agent-health-check.mjs');
const NOW = at('2026-10-12T15:30:00Z');
const watchRow = (minAgo) => ({ id: 'agent-watch', enabled: true, status: 'healthy', last_real_work_at: new Date(NOW - minAgo * 60000).toISOString() });

test('GH watcher-of-the-watcher: a stale or missing agent-watch fails the job', () => {
  assert.equal(GH.assess([watchRow(10)], NOW).errors.length, 0);
  assert.match(GH.assess([watchRow(60)], NOW).errors[0], /last ran 60 minutes ago/);
  assert.match(GH.assess([{ id: 'agent-watch', enabled: true, status: 'no-data', last_real_work_at: null }], NOW).errors[0], /never run/);
  assert.match(GH.assess([], NOW).errors[0], /missing/);
});

test('GH watcher: alerted problems warn (no hourly duplicate email); undeliverable alerts fail; STRICT fails all', () => {
  const bad = { id: 'fsa-capture', app_label: 'FSA', label: 'Inlet', enabled: true, status: 'failed', status_reason: 'Has never run',
                watch_status: 'failed', watch_since: '2026-10-12T15:30:03Z', watch_notified_at: '2026-10-12T15:30:03Z' };
  let r = GH.assess([watchRow(5), bad], NOW);
  assert.equal(r.errors.length, 0); assert.match(r.warnings[0], /already alerted/);
  r = GH.assess([watchRow(5), { ...bad, watch_notified_at: null }], NOW);
  assert.match(r.errors[0], /could not deliver/);
  r = GH.assess([watchRow(5), { ...bad, watch_status: 'healthy' }], NOW);
  assert.equal(r.errors.length, 0); assert.match(r.warnings[0], /new since/);
  r = GH.assess([watchRow(5), bad], NOW, { strict: true });
  assert.equal(r.errors.length, 1);
  r = GH.assess([watchRow(5), { ...bad, enabled: false }], NOW, { strict: true });
  assert.equal(r.errors.length, 0);
});
