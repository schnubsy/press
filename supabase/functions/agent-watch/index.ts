// supabase/functions/agent-watch/index.ts — the server-side agent watcher (press, arc marquee-wings-monitor slice 4).
//
// Fired every 15 minutes by pg_cron job `agent-watch` (net.http_post with header x-agent-watch-secret, the value
// held ONLY in Supabase Vault as `agent-watch_secret`; this function checks it via press_agent_watch_secret_ok,
// so the secret never exists as a function env var). Each tick:
//   1. records the watcher-of-the-watcher's latest GitHub Action runs (public GitHub API) as press_agent_runs rows;
//   2. reads the server-computed press_agent_monitor_public view (status from REAL work, never `skipped`);
//   3. diffs against press_agent_watch_state and alerts ONLY when an item has been down (late|failed) for 24h+
//      (once per episode) or comes back after such an alert — ONE Pushover push + ONE Gmail email
//      (council notify.mjs transports). Shorter blips are stored silently (arc quiet-alerts); a push sent
//      22:00–07:00 America/Chicago goes out at priority -1 — no buzz at night (council arc chrome-keeper);
//   4. notes its own gap since the previous tick, and logs itself as a press_agent_runs row (agent-watch).
// Body {"dry":true} = compute + store nothing, notify nothing (for testing).
import { makePushImpl, makeEmailImpl } from '../_shared/notify.mjs';
import { diffStates, formatAlert, selfGapMinutes, ghRunToRow, nightPriority } from './watch-core.mjs';

const SB_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const PAGE_URL = 'https://schnubsy.github.io/press/agent-health.html';
const GH_RUNS = 'https://api.github.com/repos/schnubsy/press/actions/workflows/agent-health-notifier.yml/runs?per_page=10&status=completed';

function db(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json', ...(init.headers || {}) },
  });
}
async function rows(path: string) {
  const r = await db(path);
  if (!r.ok) throw new Error(`read ${path.split('?')[0]} HTTP ${r.status}`);
  return await r.json();
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function syncGitHub(): Promise<string> {
  try {
    const r = await fetch(GH_RUNS, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'press-agent-watch' } });
    if (!r.ok) return `github HTTP ${r.status}`;
    const j = await r.json();
    const runs = (j.workflow_runs || []).filter((x: any) => x.event === 'schedule' || x.event === 'workflow_dispatch');
    if (!runs.length) return 'github: no runs';
    const ins = await db('press_agent_runs?on_conflict=run_id', {
      method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify(runs.map(ghRunToRow)),
    });
    return ins.ok ? `github: ${runs.length} runs seen` : `github insert HTTP ${ins.status}`;
  } catch (e) {
    return 'github: ' + String((e as Error).message || e).slice(0, 80);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  const secret = req.headers.get('x-agent-watch-secret') || '';
  const ok = await db('rpc/press_agent_watch_secret_ok', { method: 'POST', body: JSON.stringify({ p: secret }) });
  if (!ok.ok || (await ok.json()) !== true) return json(401, { error: 'unauthorized' });
  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const dry = body && body.dry === true;

  const started = new Date();
  const nowIso = started.toISOString();
  const notes: string[] = [];
  let outcome: 'ok' | 'error' = 'ok';
  let result: Record<string, unknown> = {};
  try {
    if (!dry) notes.push(await syncGitHub());
    const view = await rows('press_agent_monitor_public?select=id,label,app_label,status,status_reason,fix_hint,last_real_work_at');
    const state = await rows('press_agent_watch_state?select=id,status,since,bad_since,down_alerted');
    const prev: Record<string, any> = {};
    for (const s of state) prev[s.id] = s;
    const self = view.find((r: any) => r.id === 'agent-watch');
    const gap = selfGapMinutes(self && self.last_real_work_at, started.getTime());
    const { upserts, alerts } = diffStates(view, prev, nowIso);
    const counts: Record<string, number> = {};
    for (const r of view) counts[r.status] = (counts[r.status] || 0) + 1;
    result = { counts, changes: upserts.length, alerts: alerts.map((a) => `${a.id}:${a.kind}`), gap_min: gap, dry };

    let sent = { push: 'none', email: 'none' };
    let notifiedIds: string[] = [];
    if (!dry && (alerts.length || gap)) {
      const msg = formatAlert(alerts, gap, PAGE_URL);
      msg.push.priority = nightPriority(msg.push.priority, started); // quiet nights: 22:00–07:00 CT ⇒ -1
      sent = { push: 'off', email: 'off' };
      const appToken = Deno.env.get('PUSHOVER_APP_TOKEN') || '', userKey = Deno.env.get('PUSHOVER_USER_KEY') || '';
      const mailerEndpoint = Deno.env.get('MAILER_ENDPOINT') || '', mailerKey = Deno.env.get('MAILER_KEY') || '';
      if (appToken && userKey) {
        try { await makePushImpl()({ appToken, userKey }, msg.push); sent.push = 'ok'; }
        catch (e) { sent.push = 'failed'; console.error('agent-watch: push failed', String((e as Error).message).slice(0, 160)); }
      }
      if (mailerEndpoint && mailerKey) {
        try { await makeEmailImpl()(mailerEndpoint, mailerKey, msg.mail); sent.email = 'ok'; }
        catch (e) { sent.email = 'failed'; console.error('agent-watch: email failed', String((e as Error).message).slice(0, 160)); }
      }
      if (sent.push === 'ok' || sent.email === 'ok') {
        notifiedIds = alerts.map((a) => a.id);
      } else if (alerts.length) {
        outcome = 'error'; // an alert that reached nobody is a watcher failure — retried next tick
        const downIds = new Set(alerts.filter((a) => a.kind === 'down').map((a) => a.id));
        for (const u of upserts) if (downIds.has(u.id)) u.down_alerted = false;
      }
    }
    if (!dry && upserts.length) {
      const up = await db('press_agent_watch_state?on_conflict=id', {
        method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(upserts),
      });
      if (!up.ok) throw new Error('state upsert HTTP ' + up.status);
    }
    if (notifiedIds.length) {
      await db(`press_agent_watch_state?id=in.(${notifiedIds.map(encodeURIComponent).join(',')})`, {
        method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ notified_at: nowIso }),
      });
    }
    result.sent = sent;
    const c = counts;
    notes.unshift(`${c.healthy || 0} healthy · ${c.late || 0} late · ${c.failed || 0} failed · ${c['no-data'] || 0} no data` +
      (alerts.length ? ` · alerted ${alerts.length} (push ${sent.push}, email ${sent.email})` : ''));
  } catch (e) {
    outcome = 'error';
    notes.unshift('watch error: ' + String((e as Error).message || e).slice(0, 120));
    result.error = notes[0];
  }
  if (!dry) {
    await db('press_agent_runs', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        run_id: 'watch:' + nowIso, app: 'marquee', agent: 'agent-watch', kind: 'edge-cron', model: '-',
        outcome, note: notes.join(' · ').slice(0, 280), started_at: nowIso, finished_at: new Date().toISOString(),
        latency_ms: Date.now() - started.getTime(),
      }),
    }).catch(() => {});
  }
  return json(outcome === 'ok' ? 200 : 500, { outcome, ...result });
});
