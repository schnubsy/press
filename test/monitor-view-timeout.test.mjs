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
const BEFORE = readFileSync(new URL('../docs/evidence/monitor-view-timeout-view-before.sql', import.meta.url), 'utf8');
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
