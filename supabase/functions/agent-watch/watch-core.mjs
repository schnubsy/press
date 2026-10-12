// supabase/functions/agent-watch/watch-core.mjs — the agent watcher's PURE logic (Deno + Node; unit-tested in
// test/agent-monitor.test.mjs). No I/O: the Edge Function (index.ts) feeds it rows and sends what it returns.
//
// Rule: alert ONLY on a state change that matters —
//   * into trouble:   anything (incl. first sight) → late | failed
//   * escalation:     late → failed
//   * recovery:       late | failed → healthy
// Everything else (healthy ↔ no-data, → off, failed → late) just updates the stored state silently.

export const BAD = new Set(['late', 'failed']);
export const WATCH_STALE_MIN = 45;

export function isAlertingChange(from, to) {
  if (from === to) return false;
  if (BAD.has(to)) return !(from === 'failed' && to === 'late');
  return BAD.has(from) && to === 'healthy';
}

// rows: press_agent_monitor_public rows; prev: { [id]: { status } } from press_agent_watch_state.
// Returns { upserts: [{id,status,since}], alerts: [{id,label,app,from,to,reason,fix}] }.
export function diffStates(rows, prev, nowIso) {
  const upserts = [], alerts = [];
  for (const r of rows || []) {
    const from = prev && prev[r.id] ? prev[r.id].status : null;
    const to = r.status;
    if (from === to) continue;
    upserts.push({ id: r.id, status: to, since: nowIso });
    if (isAlertingChange(from, to)) {
      alerts.push({ id: r.id, label: r.label, app: r.app_label, from, to, reason: r.status_reason || '', fix: r.fix_hint || '' });
    }
  }
  return { upserts, alerts };
}

// The watcher checks ITSELF: a gap since its own previous tick longer than WATCH_STALE_MIN is reported once.
export function selfGapMinutes(prevWatchIso, nowMs) {
  if (!prevWatchIso) return 0;
  const gap = (nowMs - new Date(prevWatchIso).getTime()) / 60000;
  return gap > WATCH_STALE_MIN ? Math.round(gap) : 0;
}

const word = (to) => (to === 'healthy' ? 'recovered' : to === 'failed' ? 'FAILED' : 'is late');

// One message per tick (push + email carry the same text). Never contains a secret or an email address.
export function formatAlert(alerts, gapMin, pageUrl) {
  const lines = [];
  if (gapMin) lines.push(`• The agent watcher itself was silent for ${gapMin} min before this check.`);
  for (const a of alerts) {
    lines.push(`• ${a.app} · ${a.label} ${word(a.to)} — ${a.reason}` + (a.to !== 'healthy' && a.fix ? `\n  Fix: ${a.fix}` : ''));
  }
  const bad = alerts.filter((a) => a.to !== 'healthy');
  let title;
  if (alerts.length === 1 && !gapMin) title = `${alerts[0].app} · ${alerts[0].label} ${word(alerts[0].to)}`;
  else if (bad.length) title = `Agent Monitor: ${bad.length} need${bad.length === 1 ? 's' : ''} attention`;
  else if (alerts.length) title = `Agent Monitor: ${alerts.length} recovered`;
  else title = 'Agent Monitor: watcher was down';
  const body = lines.join('\n');
  return {
    push: { title, body, url: pageUrl, url_title: 'Open Agent Monitor', priority: bad.length || gapMin ? 1 : 0 },
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
