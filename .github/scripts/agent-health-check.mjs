// agent-health-check.mjs — the daily agent-health notifier's brain.
//
// A page cannot notify; this script is what turns "an agent is down" into an email.
// It reads the SAME header-gated public views the dashboard reads (press_agent_registry_public
// + press_agent_runs_daily_public, x-app scoped), decides which enabled agents need attention,
// and sets its EXIT CODE accordingly:
//   * exit 0 — every watched agent is healthy (nothing to send).
//   * exit 1 — one or more need attention. It prints a plain-English summary naming each agent,
//     what is wrong, and the ONE thing to do. A non-zero exit fails the workflow, and GitHub
//     emails the repository owner on a failed scheduled run — THAT is the notification.
// A fetch failure also exits 1 (loud): if we cannot confirm health, we do not stay silent.
//
// It reads NO secret of its own beyond the publishable (anon) key, and NO per-run timeline —
// only the aggregate. The anon key authenticates with the `apikey` header alone (a publishable
// key is not a JWT, so no Authorization: Bearer).
//
// Health rule (identical to the dashboard): an enabled agent on a cadence is stale when its
// last_ok_at is older than STALE_MULTIPLIER x cadence_minutes (default 3), or has never run.
// On-demand agents (no cadence) are never stale. Disabled agents are ignored. Separately, an
// enabled agent with an `error` outcome logged today or yesterday (UTC) needs attention.
//
// FORCING THE UNHEALTHY CASE FOR TESTING: set STALE_MULTIPLIER low (e.g. 0) to make healthy
// agents trip — a temporary QUERY/THRESHOLD override that never edits live data. That is how
// the unhealthy-path evidence is captured.

const SB_URL = process.env.SB_URL || 'https://eepjhpyziczrxvirczio.supabase.co';
const SB_KEY = process.env.SUPABASE_PRESS_ANON_KEY || '';
const APP    = process.env.AGENT_APP || 'giving';
const MULT   = Number(process.env.STALE_MULTIPLIER ?? '3');

const REST = SB_URL + '/rest/v1';
const HEAD = { apikey: SB_KEY, 'x-app': APP };
const MIN = 60000, DAY = 86400000;

function die(msg) { console.log(`::error::${msg}`); process.exit(1); }

if (!SB_KEY) {
  die('SUPABASE_PRESS_ANON_KEY is not set. Add it as a repository secret (Settings → Secrets and variables → Actions). Until then the agent health notifier cannot run.');
}

async function getJSON(path) {
  let r;
  try {
    r = await fetch(REST + path, { headers: HEAD });
  } catch (e) {
    die(`Could not reach the press status service (${String(e && e.message || e)}). Not reporting healthy on a failed check.`);
  }
  if (!r.ok) die(`The press status service answered HTTP ${r.status}. Not reporting healthy on a failed check.`);
  return r.json();
}

const humanCadence = (m) =>
  m == null ? 'on demand'
  : m % 1440 === 0 ? (m / 1440 === 1 ? 'daily' : `every ${m / 1440} days`)
  : m % 60 === 0 ? (m / 60 === 1 ? 'hourly' : `every ${m / 60} hours`)
  : `every ${m} minute${m === 1 ? '' : 's'}`;
const friendly = (k) => String(k || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
const humanAge = (ms) => {
  if (ms < 2 * 3600000) return `about ${Math.max(1, Math.round(ms / MIN))} minutes`;
  if (ms < 2 * DAY) return `about ${Math.round(ms / 3600000)} hours`;
  return `about ${Math.round(ms / DAY)} days`;
};

const utcDay = (dt) => dt.toISOString().slice(0, 10);

async function main() {
  const registry = await getJSON('/press_agent_registry_public?select=app,agent,enabled,last_ok_at,kind,cadence_minutes&order=agent.asc');
  const daily = await getJSON('/press_agent_runs_daily_public?select=agent,day,error_count&order=day.desc');

  if (!Array.isArray(registry)) die('Unexpected registry response.');

  // errors logged today or yesterday (UTC) per agent — the aggregate is per-UTC-day, so this
  // is the closest public proxy for "an error in the last 24h" (may reach back up to ~48h).
  const now = Date.now();
  const recentDays = new Set([utcDay(new Date(now)), utcDay(new Date(now - DAY))]);
  const errorRecent = {};
  for (const row of (daily || [])) {
    if (recentDays.has(row.day) && (row.error_count || 0) > 0) errorRecent[row.agent] = true;
  }

  const enabled = registry.filter(r => r.enabled === true);
  const findings = [];

  for (const r of enabled) {
    const name = friendly(r.agent);
    const onDemand = r.cadence_minutes == null;

    // stale-by-cadence
    if (!onDemand) {
      const cadMs = r.cadence_minutes * MIN;
      if (r.last_ok_at == null) {
        findings.push({
          agent: name,
          problem: `has never successfully run, though it is switched on and expected to run ${humanCadence(r.cadence_minutes)}.`,
          action: `Check the "${name}" agent is actually deployed and its schedule (cron or inlet) is switched on.`
        });
      } else {
        const age = now - new Date(r.last_ok_at).getTime();
        if (age > MULT * cadMs) {
          findings.push({
            agent: name,
            problem: `has not checked in for ${humanAge(age)} — it should report ${humanCadence(r.cadence_minutes)}.`,
            action: `Check the "${name}" agent's schedule (cron or inlet) is still firing.`
          });
        }
      }
    }

    // error in the last ~24h (independent of staleness)
    if (errorRecent[r.agent]) {
      findings.push({
        agent: name,
        problem: `logged an error in the last day.`,
        action: `Look at the ${friendly(APP)} app's logs for the "${name}" agent.`
      });
    }
  }

  const watched = enabled.length;
  if (findings.length === 0) {
    console.log(`OK — all ${watched} watched ${APP} agent${watched === 1 ? '' : 's'} healthy (stale multiplier ${MULT}x cadence).`);
    process.exit(0);
  }

  // Unhealthy — print a readable summary and fail the run so GitHub emails the owner.
  const n = findings.length;
  const issues = n === 1 ? '1 issue needs' : `${n} issues need`;
  console.log(`::error::${friendly(APP)} agents — ${issues} attention:`);
  console.log('');
  console.log(`Agent health — ${friendly(APP)} app — ${issues} attention`);
  console.log('='.repeat(56));
  for (const f of findings) {
    console.log('');
    console.log(`• ${f.agent}: ${f.problem}`);
    console.log(`  What to do: ${f.action}`);
  }
  console.log('');
  console.log(`(The other watched agents are fine. Checked ${new Date().toISOString()}.)`);
  process.exit(1);
}

main();
