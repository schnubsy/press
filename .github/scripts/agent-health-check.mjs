// agent-health-check.mjs — the watcher-of-the-watcher (arc marquee-wings-monitor, slice 4).
//
// The primary alerting now lives server-side: pg_cron fires the `agent-watch` Edge Function every 15 minutes,
// it reads the server-computed press_agent_monitor_public view (status from REAL work against each schedule,
// never a `skipped` tick) and sends Pushover + Gmail on every state change. This script is the INDEPENDENT
// check that the watcher itself is alive and doing its job. It reads the same public view with the publishable
// (anon) key — all apps, no x-app filter — and sets its EXIT CODE:
//
//   exit 1 (the job fails → GitHub emails the owner) when
//     • the status service cannot be reached (never "healthy" on a failed check), or
//     • agent-watch has not done real work for > WATCH_STALE_MIN minutes (default 1440 = a day — arc
//       quiet-alerts: nothing here is urgent; a watcher that cannot deliver an alert logs itself as an error and
//       retries every tick, so a stuck alert also ends up here as a stale watcher), or
//     • STRICT=1 and any enabled agent is late/failed (manual runs: workflow_dispatch input `strict`).
//   exit 0 otherwise — late/failed agents are listed as ::warning:: lines (the watcher owns telling Mark).
//
// It reads NO secret beyond the publishable key (apikey header only — a publishable key is not a JWT).

const SB_URL = process.env.SB_URL || 'https://eepjhpyziczrxvirczio.supabase.co';
const SB_KEY = process.env.SUPABASE_PRESS_ANON_KEY || '';
const STALE_MIN = Number(process.env.WATCH_STALE_MIN || '1440');
const STRICT = /^(1|true|yes)$/i.test(process.env.STRICT || '');
const BAD = new Set(['late', 'failed']);

function die(msg) { console.log(`::error::${msg}`); process.exit(1); }

// One transient blip (a network error, an HTTP 5xx — e.g. a 57014 statement timeout surfacing as 500 — or no answer
// within TIMEOUT_MS) is retried: up to ATTEMPTS tries, RETRY_MS apart, each retry a ::warning:: with its attempt number.
// Only then does the job die with the same "Not reporting healthy on a failed check" message — a failed check is still
// never reported healthy. A 4xx is not transient (key / URL problem) and dies at once; so does a 200 whose body is not
// JSON. Arc monitor-view-timeout, slice 3; the per-attempt timeout + bad-body handling: arc monitor-view-runs-branch, slice 2.
export const ATTEMPTS = 3;
export const RETRY_MS = 10000;
export const TIMEOUT_MS = 20000;
const wait = (ms) => new Promise((res) => setTimeout(res, ms));
const isTimeout = (e) => !!e && (e.name === 'TimeoutError' || e.name === 'AbortError');

export async function fetchRows(fetchImpl = fetch, { attempts = ATTEMPTS, retryMs = RETRY_MS, timeoutMs = TIMEOUT_MS,
  timeoutSignal = (ms) => AbortSignal.timeout(ms), sleep = wait, fail = die, log = console.log } = {}) {
  let rows;
  for (let attempt = 1; ; attempt++) {
    let problem, r = null;
    const signal = timeoutSignal(timeoutMs);
    try {
      r = await fetchImpl(`${SB_URL}/rest/v1/press_agent_monitor_public?select=id,app_label,label,enabled,status,status_reason,fix_hint,last_real_work_at,watch_status,watch_since,watch_notified_at&order=sort.asc`,
        { headers: { apikey: SB_KEY }, signal });
    } catch (e) {
      problem = unreachable(e, timeoutMs);
    }
    if (r) {
      if (r.ok) {
        try { rows = await r.json(); break; } catch (e) {
          // the body stream timed out or broke ⇒ transient, retried; a body that arrived but is not JSON ⇒ fail now
          if (!(e instanceof SyntaxError)) problem = unreachable(e, timeoutMs);
          else return fail(`The press status service answered HTTP ${r.status} with a body that is not JSON (${String(e.message).slice(0, 120)}). Not reporting healthy on a failed check.`);
        }
      } else {
        const final = `The press status service answered HTTP ${r.status}. Not reporting healthy on a failed check.`;
        if (r.status < 500) return fail(final);
        problem = { what: `answered HTTP ${r.status}`, final };
      }
    }
    if (attempt >= attempts) return fail(problem.final);
    log(`::warning::Attempt ${attempt} of ${attempts}: the press status service ${problem.what} — retrying in ${Math.round(retryMs / 1000)} s.`);
    await sleep(retryMs);
  }
  if (!Array.isArray(rows) || !rows.length) return fail('The status view returned no rows — the monitor registry is empty or unreadable.');
  return rows;
}

function unreachable(e, timeoutMs) {
  if (isTimeout(e)) {
    const s = `${Math.round(timeoutMs / 1000)} s`;
    return { what: `did not answer within ${s}`, final: `The press status service did not answer within ${s}. Not reporting healthy on a failed check.` };
  }
  const m = String((e && e.message) || e);
  return { what: `could not be reached (${m})`, final: `Could not reach the press status service (${m}). Not reporting healthy on a failed check.` };
}

export function assess(rows, nowMs, { staleMin = STALE_MIN, strict = STRICT } = {}) {
  const errors = [], warnings = [];
  const watch = rows.find((r) => r.id === 'agent-watch');
  if (!watch) errors.push('The agent-watch row is missing from the monitor — the server-side watcher is not registered.');
  else {
    const last = watch.last_real_work_at ? new Date(watch.last_real_work_at).getTime() : null;
    const age = last == null ? Infinity : (nowMs - last) / 60000;
    if (age > staleMin) {
      errors.push(last == null
        ? 'The agent watcher (agent-watch) has never run — nobody is being alerted. Check the pg_cron job "agent-watch" and the function logs.'
        : `The agent watcher (agent-watch) last ran ${Math.round(age)} minutes ago (limit ${staleMin}) — alerts are NOT going out. Check the pg_cron job "agent-watch" and the function logs.`);
    }
  }
  for (const r of rows) {
    if (!r.enabled || !BAD.has(r.status) || r.id === 'agent-watch') continue;
    const line = `${r.app_label} · ${r.label}: ${r.status} — ${r.status_reason}${r.fix_hint ? ` (fix: ${r.fix_hint})` : ''}`;
    if (strict) errors.push(line);
    else warnings.push(line);
  }
  return { errors, warnings };
}

async function main() {
  if (!SB_KEY) die('SUPABASE_PRESS_ANON_KEY is not set. Add it as a repository secret (Settings → Secrets and variables → Actions).');
  const rows = await fetchRows();
  const { errors, warnings } = assess(rows, Date.now());
  for (const w of warnings) console.log(`::warning::${w}`);
  if (errors.length) {
    console.log(`::error::Agent Monitor — ${errors.length} problem${errors.length === 1 ? '' : 's'} need attention`);
    for (const e of errors) console.log(`• ${e}`);
    console.log('\nhttps://schnubsy.github.io/press/agent-health.html');
    process.exit(1);
  }
  const on = rows.filter((r) => r.enabled).length;
  console.log(`OK — watcher fresh; ${on} enabled items checked across all apps; ${warnings.length} known issue(s) (the watcher alerts after a day).`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
