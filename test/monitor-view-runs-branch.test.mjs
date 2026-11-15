// arc monitor-view-runs-branch (2026-11-15) — the Agent Monitor view's runs branch, index-backed (slice 1)
// and the db/ mirror of press_agent_due_times (slice 3). Static contracts of the SQL files; the live proofs
// (same values, EXPLAIN) are read-only reads cited in docs/evidence/monitor-view-runs-branch-slice-*.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const V4 = read('db/20261115_agent_monitor_view_v4.sql');
const LIVE = read('db/20261115_agent_monitor_view_v4_rollback.sql');   // the live v3, as pg_get_viewdef renders it
const HEAD = 'create or replace view public.press_agent_monitor_public as\n';
const viewBody = (t) => { const i = t.indexOf(HEAD); assert.ok(i >= 0, 'create or replace view'); return t.slice(i + HEAD.length).split(';\n')[0] + ';'; };
const ctes = (b) => b.split(/\n {8}\), /);   // the CTE boundaries of pg_get_viewdef's layout
const ctename = (c) => (c.match(/^\s*(?:WITH )?(\w+) AS (?:MATERIALIZED )?\(/) || [])[1];
const byName = (b) => Object.fromEntries(ctes(b).map((c) => [ctename(c), c]));
const md5 = (s) => createHash('md5').update(s).digest('hex');

test('view v4: the rollback file is the captured live v3 (md5 of 2026-11-15) and the guard pins it', () => {
  assert.equal(md5(viewBody(LIVE)), 'a2a900ff147518f278f072ecde2e93df');
  assert.match(V4, /md5\(d\) <> 'a2a900ff147518f278f072ecde2e93df'/);
  assert.match(V4, /position\('cf_runs' in d\) = 0/);                 // a re-run over v4 passes the guard
  assert.match(V4, /raise exception 'monitor-view-runs-branch: live press_agent_monitor_public changed/);
});

test('view v4: the CTE list — runs replaced by ek, cf_runs added, g materialised; nothing else renamed', () => {
  assert.deepEqual(ctes(viewBody(LIVE)).map(ctename), ['e', 'runs', 'rf', 'cf_jobs', 'cf', 'costs', 'f', 'g', 's']);
  assert.deepEqual(ctes(viewBody(V4)).map(ctename), ['e', 'ek', 'rf', 'cf_jobs', 'cf_runs', 'cf', 'costs', 'f', 'g', 's']);
  assert.match(viewBody(V4), /\n {8}\), g AS MATERIALIZED \(\n/);
  assert.match(viewBody(V4), /\n {8}\), cf_runs AS MATERIALIZED \(\n/);
});

test('view v4: e, cf_jobs and f are byte-identical; g differs only by MATERIALIZED', () => {
  const a = byName(viewBody(LIVE)), b = byName(viewBody(V4));
  for (const n of ['e', 'cf_jobs', 'f']) assert.equal(b[n], a[n], `unchanged: ${n}`);
  assert.equal(b.g.replace('g AS MATERIALIZED (', 'g AS ('), a.g);
});

test('view v4: s and the final SELECT are byte-identical outside the two last-run SubPlans', () => {
  const a = byName(viewBody(LIVE)).s, b = byName(viewBody(V4)).s;
  const cut = (t) => { const i = t.indexOf('COALESCE(( SELECT "left"(r.note, 160)'); const j = t.indexOf("'Real work logged'::text)"); assert.ok(i > 0 && j > i); return [t.slice(0, i), t.slice(j)]; };
  assert.deepEqual(cut(b), cut(a));
  assert.equal(b.match(/FROM press_agent_runs r\n/g).length, 2);    // both SubPlans read the table by key …
  assert.equal((b.match(/ORDER BY r\.finished_at DESC\n\s+LIMIT 1/g) || []).length, 2);   // … newest first, one row
});

test('view v4: no all-time runs CTE — every press_agent_runs read is keyed by (app, agent)', () => {
  const b = viewBody(V4);
  assert.doesNotMatch(b.replace(/records its runs/g, ''), /(?<![\w'])runs\b(?!-)/);   // the `runs` CTE is gone
  const reads = b.split('press_agent_runs ').slice(1);
  assert.equal(reads.length, 7);   // rf × 4, costs, last note, deals judged
  for (const r of reads) assert.match(r.slice(0, 900), /\.app = [\s\S]*?\.agent = /, 'keyed read');
  const rf = byName(b).rf;
  assert.equal((rf.match(/ORDER BY x\.finished_at DESC\n\s+LIMIT 1\)/g) || []).length, 3);   // work_at · alive_at · fail_at
  assert.match(rf, /LIMIT 1\) one\) AS n_runs/);                                             // capped at 1
  assert.match(byName(b).costs, /WHERE r\.finished_at > \(now\(\) - '40 days'::interval\)\n\s+GROUP BY k\.id/);
});

test('view v4: the run key selects what the two UNION ALL branches of runs selected', () => {
  const runs = byName(viewBody(LIVE)).runs, ek = byName(viewBody(V4)).ek;
  assert.match(runs, /JOIN press_agent_runs x ON x\.app = e\.run_app AND x\.agent = e\.run_agent\n\s+WHERE \(e\.source = ANY \(ARRAY\['runs-work'::text, 'runs-alive'::text, 'runs-event'::text\]\)\) AND x\.outcome <> 'dead'::text/);
  assert.match(runs, /JOIN press_agent_runs x ON x\.app = 'task'::text AND x\.agent = e\.id\n\s+WHERE e\.source = 'checkin'::text/);
  assert.match(ek, /WHEN e\.source = 'checkin'::text THEN 'task'::text\n\s+ELSE e\.run_app/);
  assert.match(ek, /WHEN e\.source = 'checkin'::text THEN e\.id\n\s+ELSE e\.run_agent/);
  assert.match(ek, /e\.source = 'checkin'::text AS k_all/);   // the dead filter applies to the runs-* branch only
  assert.match(ek, /WHERE e\.source = ANY \(ARRAY\['runs-work'::text, 'runs-alive'::text, 'runs-event'::text, 'checkin'::text\]\)/);
  assert.equal((viewBody(V4).match(/\(k\.k_all OR [xr]\.outcome <> 'dead'::text\)/g) || []).length, 5);   // rf × 4 + costs
  assert.equal((viewBody(V4).match(/\(s\.source = 'checkin'::text OR r\.outcome <> 'dead'::text\)/g) || []).length, 2);
});

test('view v4: n_runs is not a view column and is only tested = 0 (the cap cannot change the output)', () => {
  const b = viewBody(V4);
  const finalSelect = b.slice(b.lastIndexOf('\n SELECT s.id,'));
  assert.doesNotMatch(finalSelect, /n_runs/);
  const uses = [...b.matchAll(/\b\w+\.n_runs\b[^,\n]*/g)].map((m) => m[0]);
  assert.deepEqual(uses.filter((u) => !/^(rf|cf|a|f|g|cr)\.n_runs(,|\)| AS| =|$)/.test(u)), []);
  assert.equal((b.match(/g\.n_runs = 0/g) || []).length, 1);
  assert.doesNotMatch(b, /n_runs\s*(>|<|<>|!=)|n_runs\s*=\s*[1-9]/);
  for (const f of ['agent-health.html', 'supabase/functions/agent-watch/index.ts', 'supabase/functions/agent-watch/watch-core.mjs', '.github/scripts/agent-health-check.mjs']) {
    assert.doesNotMatch(read(f), /n_runs/, `${f} never reads n_runs`);
  }
});

test('view v4: the cron branch aggregates job history ONCE (cf_runs) and keeps cf\'s six columns', () => {
  const { cf_runs: runs, cf } = byName(viewBody(V4));
  assert.match(runs, /FROM cron\.job_run_details d\n\s+WHERE d\.start_time > \(now\(\) - '40 days'::interval\)\n\s+GROUP BY d\.jobid/);
  assert.match(cf, /FROM cf_runs cr\n\s+WHERE cr\.jobid = ANY \(cj\.jobids\)\) a/);
  assert.match(cf, /COALESCE\(sum\(cr\.n_runs\), 0::numeric\)::bigint AS n_runs/);   // 0 when a job has no history, as count() was
  assert.doesNotMatch(cf, /cron\.job_run_details d/);                                   // no per-job scan any more
  const old = byName(viewBody(LIVE)).cf;
  const head = (t) => t.slice(0, t.indexOf('CROSS JOIN LATERAL'));
  assert.equal(head(cf), head(old));   // same SELECT list, same last_msg by primary key
});

test('view v4: grants as v3 (anon reads the public status view; nothing else widened)', () => {
  assert.match(V4, /revoke all on public\.press_agent_monitor_public from anon, authenticated;/);
  assert.match(V4, /grant select on public\.press_agent_monitor_public to anon, authenticated, service_role;/);
  assert.doesNotMatch(V4, /grant (insert|update|delete|all)/i);
  assert.doesNotMatch(V4, /create (unique )?index|create table|drop /i);
});
