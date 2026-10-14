// supabase/functions/agent-watch/watch-core.mjs — the agent watcher's PURE logic (Deno + Node; unit-tested in
// test/agent-monitor.test.mjs). No I/O: the Edge Function (index.ts) feeds it rows and sends what it returns.
//
// Rule (arc quiet-alerts, 2026-10-13 — Mark: "only tell me when an agent is down for a day"):
//   * DOWN:     an item that has been continuously late|failed for >= DOWN_MIN (24h) alerts ONCE per episode.
//   * FIXED:    a down item that was alerted on and is now healthy sends ONE "fixed" note.
//   * Everything else — a late/failed blip that clears inside 24h, no-data, off — is stored SILENTLY.
// An episode = an unbroken run of late|failed (late ↔ failed flips keep the same episode and its start time).
// A down alert that could not be delivered is NOT marked sent, so the next tick retries it.

export const BAD = new Set(['late', 'failed']);
export const DOWN_MIN = 24 * 60;          // how long an item must be down before you hear about it
export const WATCH_STALE_MIN = 24 * 60;   // the watcher's own silence worth reporting

const mins = (fromIso, nowMs) => (nowMs - new Date(fromIso).getTime()) / 60000;

// rows: press_agent_monitor_public rows; prev: { [id]: { status, since, bad_since, down_alerted } } from
// press_agent_watch_state. Returns { upserts: [{id,status,since,bad_since,down_alerted}], alerts: [...] }.
// Each alert = {id,label,app,kind:'down'|'fixed',to,reason,fix,down_min}.
export function diffStates(rows, prev, nowIso, { downMin = DOWN_MIN } = {}) {
  const nowMs = new Date(nowIso).getTime();
  const upserts = [], alerts = [];
  for (const r of rows || []) {
    const p = (prev && prev[r.id]) || null;
    const from = p ? p.status : null;
    const to = r.status;
    const wasBad = BAD.has(from), isBad = BAD.has(to);
    let badSince = null, alerted = false;
    if (isBad) {
      badSince = wasBad ? (p.bad_since || p.since || nowIso) : nowIso;
      alerted = wasBad ? p.down_alerted === true : false;
      const downFor = mins(badSince, nowMs);
      if (!alerted && downFor >= downMin) {
        alerts.push({ id: r.id, label: r.label, app: r.app_label, kind: 'down', to, reason: r.status_reason || '',
          fix: r.fix_hint || '', down_min: Math.round(downFor) });
        alerted = true;
      }
    } else if (wasBad && p.down_alerted === true && to === 'healthy') {
      alerts.push({ id: r.id, label: r.label, app: r.app_label, kind: 'fixed', to, reason: r.status_reason || '',
        fix: '', down_min: Math.round(mins(p.bad_since || p.since || nowIso, nowMs)) });
    }
    const changed = !p || from !== to || (p.bad_since || null) !== badSince || (p.down_alerted === true) !== alerted;
    if (changed) upserts.push({ id: r.id, status: to, since: from === to && p ? p.since : nowIso, bad_since: badSince, down_alerted: alerted });
  }
  return { upserts, alerts };
}

// The watcher checks ITSELF: a gap since its own previous tick longer than WATCH_STALE_MIN is reported once.
export function selfGapMinutes(prevWatchIso, nowMs, staleMin = WATCH_STALE_MIN) {
  if (!prevWatchIso) return 0;
  const gap = (nowMs - new Date(prevWatchIso).getTime()) / 60000;
  return gap > staleMin ? Math.round(gap) : 0;
}

const human = (m) => (m >= 2880 ? `${Math.round(m / 1440)} days` : m >= 90 ? `${Math.round(m / 60)} hours` : `${m} min`);
const word = (a) => (a.kind === 'fixed' ? 'is working again' : `has been down ${human(a.down_min)}`);

// One message per tick (push + email carry the same text). Never contains a secret or an email address.
export function formatAlert(alerts, gapMin, pageUrl) {
  const lines = [];
  if (gapMin) lines.push(`• The agent watcher itself was silent for ${human(gapMin)} before this check.`);
  for (const a of alerts) {
    lines.push(`• ${a.app} · ${a.label} ${word(a)}` + (a.kind === 'down' ? ` — ${a.reason}` : '') +
      (a.kind === 'down' && a.fix ? `\n  Fix: ${a.fix}` : ''));
  }
  const down = alerts.filter((a) => a.kind === 'down');
  let title;
  if (alerts.length === 1 && !gapMin) title = `${alerts[0].app} · ${alerts[0].label} ${word(alerts[0])}`;
  else if (down.length) title = `Agent Monitor: ${down.length} down for a day+`;
  else if (alerts.length) title = `Agent Monitor: ${alerts.length} working again`;
  else title = 'Agent Monitor: watcher was down';
  const body = lines.join('\n');
  return {
    // Down = normal priority (0); fixed-only = quiet (-1). Nothing here is urgent enough for high priority.
    push: { title, body, url: pageUrl, url_title: 'Open Agent Monitor', priority: down.length || gapMin ? 0 : -1 },
    mail: { subject: title, text: body + '\n\nOpen the Agent Monitor: ' + pageUrl },
  };
}

// GitHub Actions run → a press_agent_runs row for the watcher-of-the-watcher. A run that FAILED on purpose (it
// found a problem) still did its job → 'ok'; only cancelled / timed-out / startup failures are 'error'.
export function ghRunToRow(run) {
  const c = run.conclusion;
  const outcome = c === 'success' || c === 'failure' ? 'ok' : 'error';
  const note = c === 'success' ? 'All clear' : c === 'failure' ? 'Flagged a problem (GitHub emailed)' : `Run ended: ${c}`;
  return {
    run_id: 'gh:' + run.id, app: 'marquee', agent: 'agent-health-notifier', kind: 'gh-action', model: '-',
    outcome, note, started_at: run.run_started_at || run.created_at, finished_at: run.updated_at,
  };
}
