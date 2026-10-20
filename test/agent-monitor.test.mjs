// Agent Monitor (arc marquee-wings-monitor, slice 4) — pure helpers + watcher logic.
//   • month projection = MTD + avg(last 7 COMPLETE America/Chicago days) × remaining CT days (fractional)
//   • CT day keys (not UTC) for the strip
//   • status → dot/verdict mapping and app grouping (the page never computes health itself)
//   • the watcher alerts only on changes that matter; the GH notifier run maps to real work
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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

const T0 = '2026-10-12T12:00:00.000Z';
const plus = (h) => new Date(at(T0) + h * 3600000).toISOString();
const row = (status, extra = {}) => ({ id: 'a', label: 'A', app_label: 'App', status, status_reason: 'Has never run', fix_hint: 'Set it up', ...extra });

test('watcher (quiet-alerts): a blip under 24h is stored silently, never alerted', () => {
  let r = W.diffStates([row('late')], { a: { status: 'healthy', since: T0 } }, plus(1));
  assert.equal(r.alerts.length, 0);
  assert.deepEqual(r.upserts[0], { id: 'a', status: 'late', since: plus(1), bad_since: plus(1), down_alerted: false });
  // late → failed keeps the same episode start and still stays quiet under 24h
  r = W.diffStates([row('failed')], { a: { status: 'late', since: plus(1), bad_since: plus(1), down_alerted: false } }, plus(5));
  assert.equal(r.alerts.length, 0); assert.equal(r.upserts[0].bad_since, plus(1));
  // recovers inside the day → silent, episode cleared
  r = W.diffStates([row('healthy')], { a: { status: 'failed', since: plus(5), bad_since: plus(1), down_alerted: false } }, plus(6));
  assert.equal(r.alerts.length, 0); assert.equal(r.upserts[0].bad_since, null);
  // first sight of a broken thing is quiet too
  r = W.diffStates([row('failed')], {}, plus(0));
  assert.equal(r.alerts.length, 0);
});

test('watcher (quiet-alerts): down 24h+ alerts once, then one "working again" note', () => {
  const prev = { a: { status: 'late', since: plus(0), bad_since: plus(0), down_alerted: false } };
  assert.equal(W.diffStates([row('late')], prev, plus(23.9)).alerts.length, 0);
  let r = W.diffStates([row('late')], prev, plus(24));
  assert.equal(r.alerts.length, 1); assert.equal(r.alerts[0].kind, 'down');
  assert.equal(r.upserts[0].down_alerted, true); assert.equal(r.upserts[0].since, plus(0));
  const msg = W.formatAlert(r.alerts, 0, 'https://x/agent-health.html');
  assert.equal(msg.push.title, 'App · A has been down 24 hours');
  assert.match(msg.push.body, /Fix: Set it up/);
  assert.equal(msg.push.priority, 0);
  assert.match(msg.mail.text, /agent-health\.html/);
  // already alerted → no repeat, nothing to store
  r = W.diffStates([row('failed')], { a: { status: 'late', since: plus(0), bad_since: plus(0), down_alerted: true } }, plus(30));
  assert.equal(r.alerts.length, 0); assert.equal(r.upserts[0].down_alerted, true);
  r = W.diffStates([row('failed')], { a: { status: 'failed', since: plus(30), bad_since: plus(0), down_alerted: true } }, plus(31));
  assert.equal(r.alerts.length, 0); assert.equal(r.upserts.length, 0);
  // back to healthy after an alert → one quiet "working again"
  r = W.diffStates([row('healthy')], { a: { status: 'failed', since: plus(30), bad_since: plus(0), down_alerted: true } }, plus(40));
  assert.equal(r.alerts.length, 1); assert.equal(r.alerts[0].kind, 'fixed');
  const fixed = W.formatAlert(r.alerts, 0, 'u');
  assert.equal(fixed.push.title, 'App · A is working again'); assert.equal(fixed.push.priority, -1);
  // switched off while down → silent
  r = W.diffStates([row('off')], { a: { status: 'late', since: plus(0), bad_since: plus(0), down_alerted: true } }, plus(40));
  assert.equal(r.alerts.length, 0);
});

test('watcher (quiet nights): a push 22:00–07:00 America/Chicago goes out at -1; daytime unchanged; DST-safe', () => {
  const at = (iso) => new Date(iso);
  // CDT (UTC-5): 21:59 / 22:00 / 06:59 / 07:00
  assert.equal(W.nightPriority(0, at('2026-10-20T02:59:00Z')), 0);
  assert.equal(W.nightPriority(0, at('2026-10-20T03:00:00Z')), -1);
  assert.equal(W.nightPriority(0, at('2026-10-20T11:59:00Z')), -1);
  assert.equal(W.nightPriority(0, at('2026-10-20T12:00:00Z')), 0);
  // CST (UTC-6), winter: 21:59 / 22:00 / 06:59 / 07:00
  assert.equal(W.nightPriority(0, at('2026-01-15T03:59:00Z')), 0);
  assert.equal(W.nightPriority(0, at('2026-01-15T04:00:00Z')), -1);
  assert.equal(W.nightPriority(0, at('2026-01-15T12:59:00Z')), -1);
  assert.equal(W.nightPriority(0, at('2026-01-15T13:00:00Z')), 0);
  // DST ends 2026-11-01 02:00 CDT → 01:00 CST: 06:59 / 07:00 CST that morning
  assert.equal(W.nightPriority(0, at('2026-11-01T12:59:00Z')), -1);
  assert.equal(W.nightPriority(0, at('2026-11-01T13:00:00Z')), 0);
  // DST starts 2026-03-08 02:00 CST → 03:00 CDT: 06:59 / 07:00 CDT that morning (12:00Z would be 06:00 under CST)
  assert.equal(W.nightPriority(0, at('2026-03-08T11:59:00Z')), -1);
  assert.equal(W.nightPriority(0, at('2026-03-08T12:00:00Z')), 0);
  // already quiet stays as it is; anything louder is demoted at night only
  assert.equal(W.nightPriority(-1, at('2026-10-20T06:00:00Z')), -1);
  assert.equal(W.nightPriority(-2, at('2026-10-20T06:00:00Z')), -2);
  assert.equal(W.nightPriority(1, at('2026-10-20T06:00:00Z')), -1);
  assert.equal(W.nightPriority(1, at('2026-10-20T18:00:00Z')), 1);
  assert.equal(W.nightPriority(undefined, at('2026-10-20T18:00:00Z')), 0);
  // agent-watch applies it to the one push it sends (email untouched)
  const ix = readFileSync(new URL('../supabase/functions/agent-watch/index.ts', import.meta.url), 'utf8');
  assert.match(ix, /msg\.push\.priority = nightPriority\(msg\.push\.priority, started\)/);
});

test('watcher: notices its own gap only after a day', () => {
  assert.equal(W.selfGapMinutes(null, 0), 0);
  assert.equal(W.selfGapMinutes(new Date(0).toISOString(), 90 * 60000), 0);
  assert.equal(W.selfGapMinutes(new Date(0).toISOString(), 1500 * 60000), 1500);
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

test('GH watcher-of-the-watcher: a watcher silent for a day (or missing) fails the job', () => {
  assert.equal(GH.assess([watchRow(10)], NOW).errors.length, 0);
  assert.equal(GH.assess([watchRow(600)], NOW).errors.length, 0);           // a few hours is not worth an email
  assert.match(GH.assess([watchRow(1500)], NOW).errors[0], /last ran 1500 minutes ago/);
  assert.match(GH.assess([{ id: 'agent-watch', enabled: true, status: 'no-data', last_real_work_at: null }], NOW).errors[0], /never run/);
  assert.match(GH.assess([], NOW).errors[0], /missing/);
});

test('GH watcher: late/failed agents only warn (the watcher alerts after a day); STRICT fails all', () => {
  const bad = { id: 'fsa-capture', app_label: 'FSA', label: 'Inlet', enabled: true, status: 'failed', status_reason: 'Has never run',
                watch_status: 'failed', watch_since: '2026-10-12T15:30:03Z', watch_notified_at: null };
  let r = GH.assess([watchRow(5), bad], NOW);
  assert.equal(r.errors.length, 0); assert.equal(r.warnings.length, 1);
  r = GH.assess([watchRow(5), bad], NOW, { strict: true });
  assert.equal(r.errors.length, 1);
  r = GH.assess([watchRow(5), { ...bad, enabled: false }], NOW, { strict: true });
  assert.equal(r.errors.length, 0);
});
