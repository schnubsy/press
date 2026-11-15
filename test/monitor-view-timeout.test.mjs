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
