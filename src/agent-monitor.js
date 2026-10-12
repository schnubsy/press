/* ============================================================================
 * src/agent-monitor.js — the Agent Monitor page's PURE helpers (agent-health.html loads it with a plain
 * <script src>; Node's test runner require()s it — no build step).
 *
 * The page never decides health: status comes from the server view press_agent_monitor_public (real work,
 * expected schedule, grace — never a `skipped` tick). These helpers only MAP that status to dots and words,
 * group rows by app, compute the month projection for the summary strip, label days in America/Chicago, and
 * read the admin session the Family Wing gate already stores (press:family:v1) so Retry can be offered.
 *
 * Month projection (the 2026-10-12 fix): projected = MTD + avg(cost of the last 7 COMPLETE CT days) ×
 * days remaining in the CT month (fractional, from now). The old page did mtd/dayOfMonth*daysInMonth in UTC.
 * ========================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AgentMonitor = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var TZ = 'America/Chicago';
  var DAY = 86400000;

  // ── America/Chicago calendar helpers ──────────────────────────────────────
  var _fmt = null;
  function ctParts(ms) {
    if (!_fmt) _fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' });
    var o = {};
    _fmt.formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
    return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour, mm: +o.minute, wd: o.weekday };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ctDayKey(ms) { var p = ctParts(ms); return p.y + '-' + pad(p.m) + '-' + pad(p.d); }
  // Epoch ms of 00:00 America/Chicago on calendar day y-m-d (m 1-12; m=13 rolls into next year).
  function ctMidnight(y, m, d) {
    var base = Date.UTC(y, m - 1, d);
    for (var off = 4; off <= 7; off++) {           // CDT = UTC-5, CST = UTC-6 (margin either side)
      var t = base + off * 3600000, p = ctParts(t);
      var want = new Date(base);
      if (p.hh === 0 && p.mm === 0 && p.d === want.getUTCDate() && p.m === want.getUTCMonth() + 1) return t;
    }
    return base + 6 * 3600000;
  }
  // The previous `n` complete CT days (oldest first), excluding today.
  function lastCompleteDays(nowMs, n) {
    var out = [], p = ctParts(nowMs);
    var today0 = ctMidnight(p.y, p.m, p.d);
    for (var i = n; i >= 1; i--) out.push(ctDayKey(today0 - i * DAY + 12 * 3600000));
    return out;
  }
  // The last `n` CT days INCLUDING today (oldest first) — the strip's columns.
  function stripDays(nowMs, n) {
    var out = [], p = ctParts(nowMs);
    var today0 = ctMidnight(p.y, p.m, p.d);
    for (var i = n - 1; i >= 0; i--) {
      var noon = today0 - i * DAY + 12 * 3600000, q = ctParts(noon);
      out.push({ key: ctDayKey(noon), dow: q.wd, d: q.d, m: q.m });
    }
    return out;
  }
  function remainingDaysInMonth(nowMs) {
    var p = ctParts(nowMs);
    var next = p.m === 12 ? ctMidnight(p.y + 1, 1, 1) : ctMidnight(p.y, p.m + 1, 1);
    return Math.max(0, (next - nowMs) / DAY);
  }

  // ── cost ──────────────────────────────────────────────────────────────────
  // dailyCost: { 'YYYY-MM-DD' (CT) → USD }. Missing complete days count as $0 (nothing ran = nothing spent).
  function projectMonth(mtd, dailyCost, nowMs) {
    var days = lastCompleteDays(nowMs, 7), sum = 0;
    days.forEach(function (k) { sum += Number((dailyCost || {})[k]) || 0; });
    var avg = sum / 7;
    return { mtd: Number(mtd) || 0, avg7: avg, remaining: remainingDaysInMonth(nowMs), projected: (Number(mtd) || 0) + avg * remainingDaysInMonth(nowMs) };
  }
  function money(n) {
    if (n == null || isNaN(n)) return '—';
    n = Number(n);
    if (n === 0) return '$0.00';
    if (n < 0.01) return '<$0.01';
    return '$' + n.toFixed(2);
  }

  // ── status → dot / words ──────────────────────────────────────────────────
  var STATUS = {
    healthy:  { dot: 'ok',   word: 'Working',  rank: 3 },
    late:     { dot: 'warn', word: 'Late',     rank: 1 },
    failed:   { dot: 'bad',  word: 'Failed',   rank: 0 },
    'no-data':{ dot: 'none', word: 'No data',  rank: 2 },
    off:      { dot: 'off',  word: 'Off',      rank: 4 }
  };
  function statusMeta(s) { return STATUS[s] || STATUS['no-data']; }
  function needsFix(row) { return row && (row.status === 'late' || row.status === 'failed'); }

  function overallVerdict(rows) {
    var on = (rows || []).filter(function (r) { return r.status !== 'off'; });
    var failed = on.filter(function (r) { return r.status === 'failed'; }).length;
    var late = on.filter(function (r) { return r.status === 'late'; }).length;
    var nodata = on.filter(function (r) { return r.status === 'no-data'; }).length;
    var ok = on.filter(function (r) { return r.status === 'healthy'; }).length;
    var cls, title;
    if (!on.length) { cls = 'grey'; title = 'Nothing switched on'; }
    else if (failed) { cls = 'red'; title = (failed + late) + ' need' + (failed + late === 1 ? 's' : '') + ' attention'; }
    else if (late) { cls = 'amber'; title = late + ' running late'; }
    else { cls = 'green'; title = 'Everything is working'; }
    var bits = [ok + ' working'];
    if (late) bits.push(late + ' late');
    if (failed) bits.push(failed + ' failed');
    if (nodata) bits.push(nodata + ' with no data yet');
    return { cls: cls, title: title, sub: bits.join(' · '), failed: failed, late: late, ok: ok, nodata: nodata };
  }

  // Rows → [{ app, items:[enabled rows, worst first], worst }] (apps worst first, then by name) + off rows.
  function groupByApp(rows) {
    var on = {}, off = [];
    (rows || []).forEach(function (r) {
      if (r.status === 'off') { off.push(r); return; }
      (on[r.app_label] = on[r.app_label] || []).push(r);
    });
    var groups = Object.keys(on).map(function (app) {
      var items = on[app].slice().sort(function (a, b) {
        return (a.sort || 0) - (b.sort || 0) || String(a.label).localeCompare(String(b.label));
      });
      var worst = items.reduce(function (w, r) { return statusMeta(r.status).rank < statusMeta(w).rank ? r.status : w; }, 'off');
      return { app: app, items: items, worst: worst };
    });
    groups.sort(function (a, b) {
      return statusMeta(a.worst).rank - statusMeta(b.worst).rank || a.app.localeCompare(b.app);
    });
    off.sort(function (a, b) { return String(a.app_label).localeCompare(String(b.app_label)) || String(a.label).localeCompare(String(b.label)); });
    return { groups: groups, off: off };
  }

  // ── time words ────────────────────────────────────────────────────────────
  function ago(iso, nowMs) {
    if (!iso) return null;
    var t = new Date(iso).getTime(); if (isNaN(t)) return null;
    var d = Math.max(0, nowMs - t), M = 60000, H = 3600000;
    if (d < 90 * 1000) return 'just now';
    if (d < H) return Math.round(d / M) + ' min ago';
    if (d < 2 * H) return 'about an hour ago';
    if (d < DAY) return Math.round(d / H) + ' hours ago';
    if (d < 2 * DAY) return 'yesterday';
    return Math.round(d / DAY) + ' days ago';
  }
  function whenCT(iso) {
    if (!iso) return '—';
    var p = ctParts(new Date(iso).getTime());
    var h12 = p.hh % 12 === 0 ? 12 : p.hh % 12;
    var mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p.m - 1];
    return p.wd + ' ' + mon + ' ' + p.d + ', ' + h12 + ':' + pad(p.mm) + (p.hh < 12 ? ' AM' : ' PM') + ' CT';
  }
  function dueText(iso, nowMs) {
    if (!iso) return '—';
    var t = new Date(iso).getTime();
    if (t < nowMs) return 'Overdue since ' + whenCT(iso);
    return whenCT(iso);
  }
  function schedText(s) {
    if (!s) return 'On demand';
    if (s.every != null) {
      var m = s.every;
      if (m % 1440 === 0) return m === 1440 ? 'Daily' : 'Every ' + (m / 1440) + ' days';
      if (m % 60 === 0) return m === 60 ? 'Hourly' : 'Every ' + (m / 60) + ' hours';
      return m === 1 ? 'Every minute' : 'Every ' + m + ' minutes';
    }
    var fmt12 = function (hhmm) { var a = hhmm.split(':'), h = +a[0]; return ((h % 12) || 12) + ':' + a[1] + (h < 12 ? ' AM' : ' PM'); };
    if (s.daily) return 'Daily at ' + s.daily.map(fmt12).join(', ') + ' CT';
    var DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    if (s.weekly) return 'Every ' + DOW[s.weekly.dow] + ' at ' + fmt12(s.weekly.at) + ' CT';
    if (s.monthly) { var n = s.monthly.dom, suf = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
      return 'Monthly on the ' + n + suf + ' at ' + fmt12(s.monthly.at) + ' CT'; }
    return 'Scheduled';
  }
  var KIND = {
    'edge-cron': 'Scheduled cloud function', 'edge-on-demand': 'On-demand cloud function', 'pg-cron': 'Database job',
    'cloud-task': 'Claude cloud scheduled task', 'mac-task': 'Mac scheduled task', 'browser-task': 'Browser scheduled task',
    'gh-action': 'GitHub Action', 'inlet': 'Inlet'
  };
  function kindText(k) { return KIND[k] || k; }

  // ── admin session (shared with the Family Wing gate: localStorage 'press:family:v1') ──
  var SESSION_KEY = 'press:family:v1';
  function readSession(store) {
    try {
      var o = JSON.parse((store && store.getItem(SESSION_KEY)) || 'null');
      if (!o || typeof o.access_token !== 'string' || typeof o.refresh_token !== 'string' || typeof o.expires_at !== 'number') return null;
      return { access_token: o.access_token, refresh_token: o.refresh_token, expires_at: o.expires_at,
               email: String(o.email || '').toLowerCase(), name: o.name || null };
    } catch (e) { return null; }
  }
  function sessionFresh(s, nowMs) { return !!s && s.expires_at - 60000 > nowMs; }

  return {
    TZ: TZ, SESSION_KEY: SESSION_KEY,
    ctParts: ctParts, ctDayKey: ctDayKey, ctMidnight: ctMidnight, lastCompleteDays: lastCompleteDays,
    stripDays: stripDays, remainingDaysInMonth: remainingDaysInMonth, projectMonth: projectMonth, money: money,
    statusMeta: statusMeta, needsFix: needsFix, overallVerdict: overallVerdict, groupByApp: groupByApp,
    ago: ago, whenCT: whenCT, dueText: dueText, schedText: schedText, kindText: kindText,
    readSession: readSession, sessionFresh: sessionFresh
  };
});
