// arc monitor-view-timeout (2026-11-15) — the Agent Monitor status view stopped timing out.
//   slice 1: db/20261115_cron_history_prune.sql — the pg_cron history pruner (static contract of the SQL file)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PRUNE = readFileSync(new URL('../db/20261115_cron_history_prune.sql', import.meta.url), 'utf8');
const body = PRUNE.replace(/^--.*$/gm, '');   // SQL without comments

test('prune: idempotent, off the Data API, search_path pinned', () => {
  assert.match(body, /create or replace function public\.press_cron_history_prune\(\)/);
  assert.match(body, /set search_path = ''/);
  assert.match(body, /revoke all on function public\.press_cron_history_prune\(\) from public;/);
  assert.match(body, /revoke all on function public\.press_cron_history_prune\(\) from anon, authenticated;/);
  assert.doesNotMatch(body, /grant [^;]*press_cron_history_prune[^;]* to (anon|authenticated)/);
  assert.doesNotMatch(body, /security definer/i);          // runs as the cron owner; nothing to elevate
  assert.match(body, /on conflict \(id\) do nothing/);
  assert.doesNotMatch(body, /create table/i);               // no table ⇒ no table GRANT lines needed
});

test('prune: 45 days for every job, 15 days (the strip window) for sub-hourly jobs', () => {
  assert.match(body, /then interval '15 days' else interval '45 days' end/);
  // the monitor's widest look-back is 40 days (press_agent_due_times / the view's cron window) — 45 stays outside it
  assert.ok(45 > 40);
  // the strip (press_agent_monitor_daily_public) reads 15 days of cron rows — never prune inside it
  assert.match(readFileSync(new URL('../db/20261012_agent_monitor_view_v2.sql', import.meta.url), 'utf8'),
    /d\.start_time > now\(\) - interval '15 days'/);
});

test('prune: a job\'s latest, latest succeeded and latest failed run are never deleted', () => {
  assert.match(body, /select max\(d\.runid\) as runid from cron\.job_run_details d group by d\.jobid/);
  assert.match(body, /union select max\(d\.runid\) from cron\.job_run_details d where d\.status = 'succeeded' group by d\.jobid/);
  assert.match(body, /union select max\(d\.runid\) from cron\.job_run_details d where d\.status = 'failed' group by d\.jobid/);
  assert.match(body, /and d\.runid not in \(select k\.runid from keep k where k\.runid is not null\)/);
});

test('prune: "more often than hourly" = minute field not a single number, or a seconds schedule', () => {
  const m = body.match(/\(j\.schedule ~\* 'second' or split_part\(btrim\(j\.schedule\), ' ', 1\) !~ '\^\[0-9\]\+\$'\)/);
  assert.ok(m, 'frequent-job predicate present');
  const frequent = (s) => /second/i.test(s) || !/^[0-9]+$/.test(s.trim().split(' ')[0]);   // the same rule in JS
  for (const s of ['* * * * *', '*/15 * * * *', '*/30 11-23,0-5 * * *', '30 seconds', '0,30 * * * *']) assert.equal(frequent(s), true, s);
  for (const s of ['17 */3 * * *', '0 9 * * *', '15 4 * * *', '41 9 * * *']) assert.equal(frequent(s), false, s);
});

test('prune: one daily job off the hour, registered on the monitor with an allowlisted retry', () => {
  const sched = body.match(/select cron\.schedule\('([a-z0-9_-]+)', '([^']+)', \$cron\$select public\.press_cron_history_prune\(\)\$cron\$\);/);
  assert.ok(sched, 'cron.schedule by name');
  const [, name, cron] = sched;
  assert.equal(name, 'cron-history-prune');
  const [min, hour, ...rest] = cron.split(' ');
  assert.notEqual(min, '0'); assert.match(min, /^[0-9]+$/); assert.match(hour, /^[0-9]+$/); assert.deepEqual(rest, ['*', '*', '*']);
  assert.match(body, /\('cron-history-prune', 'Marquee', 'Job history tidy-up'/);
  assert.match(body, /'pg-cron', true, 'cron', null, null, 'cron-history-prune', false, null,/);
  assert.match(body, /'\{"every":1440\}', 120,/);
  const retry = body.match(/'(cron:[^']+)', 77, now\(\)\)/);
  assert.ok(retry); assert.equal(retry[1], `cron:${name}`);
  assert.match(retry[1], /^cron:[a-z0-9_-]+$/);   // agent-fix's allowlist (supabase/functions/agent-fix/index.ts)
});

// slice 2: db/20261115_agent_monitor_view_v3.sql — the live definition with ONLY the cron (`cf`) branch rewritten
const V3 = readFileSync(new URL('../db/20261115_agent_monitor_view_v3.sql', import.meta.url), 'utf8');
const BEFORE = readFileSync(new URL('../db/20261115_agent_monitor_view_v3_rollback.sql', import.meta.url), 'utf8');
const HEAD = 'create or replace view public.press_agent_monitor_public as\n';
const viewBody = (t) => { const i = t.indexOf(HEAD); assert.ok(i >= 0, 'create or replace view'); return t.slice(i + HEAD.length).split(';\n')[0] + ';'; };
const ctes = (b) => b.split(/\n {8}\), /);   // the CTE boundaries of pg_get_viewdef's layout
const ctename = (c) => (c.match(/^\s*(?:WITH )?(\w+) AS \(/) || [])[1];

test('view v3: the rollback file is the captured live definition (md5 of 2026-11-15)', async () => {
  const { createHash } = await import('node:crypto');
  const live = viewBody(BEFORE);
  assert.equal(createHash('md5').update(live).digest('hex'), '7b0ddf18fea7ae19e0eb8508e7507012');
  assert.match(V3, /md5\(d\) <> '7b0ddf18fea7ae19e0eb8508e7507012'/);      // the guard pins the same capture
  assert.match(V3, /position\('cf_jobs' in d\) = 0/);                      // … and lets a re-run through
});

test('view v3: every CTE but the cron branch and the final SELECT are byte-identical to the live view', () => {
  const a = ctes(viewBody(BEFORE)), b = ctes(viewBody(V3));
  const na = a.map(ctename), nb = b.map(ctename);
  assert.deepEqual(na.filter((n) => n !== 'cf'), nb.filter((n) => n !== 'cf' && n !== 'cf_jobs'));
  assert.deepEqual(nb.slice(0, 4), ['e', 'runs', 'rf', 'cf_jobs']);
  for (const c of a) if (ctename(c) !== 'cf') assert.ok(b.includes(c), `unchanged: ${ctename(c) || 'final select'}`);
  assert.equal(a.at(-1), b.at(-1));   // `s` + the column list
});

test('view v3: the cron branch reads per job (LATERAL), never sorts every run, same output columns', () => {
  const cf = ctes(viewBody(V3)).find((c) => ctename(c) === 'cf');
  const jobs = ctes(viewBody(V3)).find((c) => ctename(c) === 'cf_jobs');
  assert.match(jobs, /JOIN cron\.job j ON j\.jobname = e\.cron_job/);
  assert.match(jobs, /WHERE e\.source = 'cron'::text/);
  assert.match(cf, /CROSS JOIN LATERAL/);
  assert.match(cf, /WHERE d\.jobid = ANY \(cj\.jobids\) AND d\.start_time > \(now\(\) - '40 days'::interval\)/);
  assert.match(cf, /WHERE m\.runid = a\.ok_runid\) AS last_msg/);
  assert.doesNotMatch(viewBody(V3), /array_agg\(d\.return_message ORDER BY/);
  assert.doesNotMatch(viewBody(V3), /LEFT JOIN cron\.job_run_details/);
  const cols = (c) => [...c.matchAll(/ AS (\w+)(?=,|\n|$)/g)].map((m) => m[1]).filter((n) => !['ok_runid', 'jobids'].includes(n));
  const old = ctes(viewBody(BEFORE)).find((c) => ctename(c) === 'cf');
  for (const col of ['work_at', 'alive_at', 'fail_at', 'n_runs', 'active', 'last_msg']) {
    assert.ok(cols(old).includes(col), `old cf.${col}`);
    assert.match(cf, new RegExp(`(a\\.|cj\\.)${col}|AS ${col}\\b`), `v3 cf.${col}`);
  }
});

test('view v3: grants as v2 (anon reads the public status view; nothing else widened)', () => {
  assert.match(V3, /revoke all on public\.press_agent_monitor_public from anon, authenticated;/);
  assert.match(V3, /grant select on public\.press_agent_monitor_public to anon, authenticated, service_role;/);
  assert.doesNotMatch(V3, /grant (insert|update|delete|all)/i);
});

// slice 3: .github/scripts/agent-health-check.mjs — one transient 5xx / network blip is retried, never reported healthy
const GH = await import('../.github/scripts/agent-health-check.mjs');
const { spawnSync } = await import('node:child_process');
const ROWS = [{ id: 'agent-watch', enabled: true, status: 'healthy', last_real_work_at: new Date().toISOString() }];
const reply = (status, body = ROWS) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const scripted = (...steps) => { let i = 0; const fn = async () => { const s = steps[Math.min(i++, steps.length - 1)]; if (s instanceof Error) throw s; return reply(s); }; fn.calls = () => i; return fn; };
const harness = () => { const logs = [], sleeps = []; return { logs, sleeps, opts: { sleep: async (ms) => { sleeps.push(ms); }, log: (l) => logs.push(l), fail: (m) => { throw new Error(m); } } }; };

test('retry: 500 then 200 ⇒ rows; one ::warning:: with the attempt number; waits ~10 s', async () => {
  const h = harness(), f = scripted(500, 200);
  assert.deepEqual(await GH.fetchRows(f, h.opts), ROWS);
  assert.equal(f.calls(), 2);
  assert.deepEqual(h.sleeps, [10000]);
  assert.equal(h.logs.length, 1);
  assert.match(h.logs[0], /^::warning::Attempt 1 of 3: the press status service answered HTTP 500 — retrying in 10 s\.$/);
});

test('retry: a network error then 200 ⇒ rows', async () => {
  const h = harness(), f = scripted(new Error('fetch failed'), 200);
  assert.deepEqual(await GH.fetchRows(f, h.opts), ROWS);
  assert.match(h.logs[0], /Attempt 1 of 3: the press status service could not be reached \(fetch failed\)/);
});

test('retry: 500 ×3 ⇒ the existing failure message after 3 attempts (2 retries)', async () => {
  const h = harness(), f = scripted(500, 500, 500, 200);
  await assert.rejects(GH.fetchRows(f, h.opts), /^Error: The press status service answered HTTP 500\. Not reporting healthy on a failed check\.$/);
  assert.equal(f.calls(), 3);
  assert.deepEqual(h.sleeps, [10000, 10000]);
  assert.deepEqual(h.logs.map((l) => l.match(/Attempt (\d) of 3/)[1]), ['1', '2']);
});

test('retry: a 4xx is not transient — fails at once, no retry', async () => {
  const h = harness(), f = scripted(401, 200);
  await assert.rejects(GH.fetchRows(f, h.opts), /answered HTTP 401\. Not reporting healthy on a failed check\./);
  assert.equal(f.calls(), 1);
  assert.equal(h.logs.length, 0);
});

test('retry: 500 ×3 through the real die() ⇒ process exit 1 with the ::error:: message', () => {
  const mod = new URL('../.github/scripts/agent-health-check.mjs', import.meta.url).href;
  const code = `import { fetchRows } from ${JSON.stringify(mod)};
    await fetchRows(async () => ({ ok: false, status: 500, json: async () => [] }), { retryMs: 0, sleep: async () => {} });
    console.log('UNREACHABLE');`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::warning::Attempt 1 of 3/);
  assert.match(r.stdout, /::warning::Attempt 2 of 3/);
  assert.match(r.stdout, /::error::The press status service answered HTTP 500\. Not reporting healthy on a failed check\./);
  assert.doesNotMatch(r.stdout, /UNREACHABLE|^OK/m);
});

// arc monitor-view-runs-branch, slice 2: each attempt has a timeout (a hang is transient, retried); a 200 whose body is not
// JSON fails with the same "Not reporting healthy" wording — never an unhandled throw.
const hangUntilAborted = (signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(signal.reason), { once: true }));
const instantTimeout = () => { const c = new AbortController(); setImmediate(() => c.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))); return c.signal; };
const steps = (...s) => { let i = 0; const seen = []; const fn = async (_url, init) => { seen.push(init); const x = s[Math.min(i++, s.length - 1)]; if (x === 'hang') return hangUntilAborted(init.signal); if (x === 'badjson') return { ok: true, status: 200, json: async () => JSON.parse('<html>502 Bad Gateway</html>') }; return reply(x); }; fn.calls = () => i; fn.seen = seen; return fn; };

test('timeout: every attempt carries an AbortSignal of TIMEOUT_MS (20 s by default)', async () => {
  assert.equal(GH.TIMEOUT_MS, 20000);
  const asked = [], h = harness(), f = steps(200);
  await GH.fetchRows(f, { ...h.opts, timeoutSignal: (ms) => { asked.push(ms); return new AbortController().signal; } });
  assert.deepEqual(asked, [20000]);
  assert.ok(f.seen[0].signal instanceof AbortSignal);
  assert.equal(f.seen[0].headers.apikey !== undefined, true);
});

test('timeout: a hang then 200 ⇒ rows; the hang is a ::warning:: retry like a network error', async () => {
  const h = harness(), f = steps('hang', 200);
  assert.deepEqual(await GH.fetchRows(f, { ...h.opts, timeoutSignal: instantTimeout }), ROWS);
  assert.equal(f.calls(), 2);
  assert.deepEqual(h.sleeps, [10000]);
  assert.match(h.logs[0], /^::warning::Attempt 1 of 3: the press status service did not answer within 20 s — retrying in 10 s\.$/);
});

test('timeout: hang ×3 ⇒ the failure message after 3 attempts', async () => {
  const h = harness(), f = steps('hang', 'hang', 'hang', 200);
  await assert.rejects(GH.fetchRows(f, { ...h.opts, timeoutSignal: instantTimeout }),
    /^Error: The press status service did not answer within 20 s\. Not reporting healthy on a failed check\.$/);
  assert.equal(f.calls(), 3);
  assert.equal(h.logs.length, 2);
});

test('timeout: hang ×3 through the real die() and a real AbortSignal.timeout ⇒ exit 1 with the ::error:: message', () => {
  const mod = new URL('../.github/scripts/agent-health-check.mjs', import.meta.url).href;
  const code = `import { fetchRows } from ${JSON.stringify(mod)};
    setInterval(() => {}, 1000);   // a real hung request holds a socket open; AbortSignal.timeout's own timer is unref'd
    const hang = (u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason)));
    await fetchRows(hang, { timeoutMs: 30, retryMs: 0, sleep: async () => {} });
    console.log('UNREACHABLE');`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::warning::Attempt 2 of 3: the press status service did not answer within 0 s/);
  assert.match(r.stdout, /::error::The press status service did not answer within 0 s\. Not reporting healthy on a failed check\./);
  assert.doesNotMatch(r.stdout, /UNREACHABLE/);
});

test('bad body: 200 + a non-JSON body ⇒ fails at once with the existing wording (no retry, no unhandled throw)', async () => {
  const h = harness(), f = steps('badjson', 200);
  await assert.rejects(GH.fetchRows(f, h.opts),
    /^Error: The press status service answered HTTP 200 with a body that is not JSON \(.+\)\. Not reporting healthy on a failed check\.$/);
  assert.equal(f.calls(), 1);
  assert.equal(h.logs.length, 0);
});

test('bad body: through the real die() ⇒ exit 1, an ::error:: line, no stack trace', () => {
  const mod = new URL('../.github/scripts/agent-health-check.mjs', import.meta.url).href;
  const code = `import { fetchRows } from ${JSON.stringify(mod)};
    await fetchRows(async () => ({ ok: true, status: 200, json: async () => JSON.parse('not json') }), { retryMs: 0, sleep: async () => {} });
    console.log('UNREACHABLE');`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 10000 });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /::error::The press status service answered HTTP 200 with a body that is not JSON .*Not reporting healthy on a failed check\./);
  assert.doesNotMatch(r.stdout + r.stderr, /UNREACHABLE|SyntaxError: Unexpected|at JSON\.parse/);
});

test('bad body: a body stream that times out is transient (retried), not "not JSON"', async () => {
  const h = harness();
  let i = 0;
  const f = async () => (i++ === 0
    ? { ok: true, status: 200, json: async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); } }
    : reply(200));
  assert.deepEqual(await GH.fetchRows(f, h.opts), ROWS);
  assert.equal(i, 2);
  assert.match(h.logs[0], /did not answer within 20 s — retrying/);
});
