#!/usr/bin/env node
// tools/tenants-check.mjs — audit every marquee↔tenant coupling from the press root.
//
// The marquee is a PLATFORM with TENANTS (press/docs/spec.md → Tenants). This command reads the
// three repo-owned registries (tenants.json, pages.json, spaces.json) and, per tenant, runs one
// named check. Prints PASS / FAIL / SKIP / INFO / EMITTED + a reason; EXITS 1 on any FAIL.
//
//   node tools/tenants-check.mjs                 # T1–T4 + T6 (no build)
//   node tools/tenants-check.mjs --rebuild       # + T5 rebuild-vs-live for deterministic tenants
//   node tools/tenants-check.mjs --press <dir>   # override the press root (default: where this lives)
//   VSCODE_ROOT=<dir> node tools/tenants-check.mjs   # override the source-repos parent (default ~/Documents/VSCode)
//
// No dependencies (Node ≥20). The DB checks it cannot reach are EMITTED as SQL, never asserted.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argVal = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

const SELF_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRESS = resolve(argVal('--press') || SELF_ROOT);
const VSCODE_ROOT = process.env.VSCODE_ROOT || join(homedir(), 'Documents', 'VSCode');
const REBUILD = has('--rebuild');

// ---- helpers ---------------------------------------------------------------
const C = { reset: '\x1b[0m', red: '\x1b[31m', grn: '\x1b[32m', yel: '\x1b[33m', dim: '\x1b[2m', cyn: '\x1b[36m' };
const tty = process.stdout.isTTY;
const col = (c, s) => (tty ? C[c] + s + C.reset : s);
const tally = { pass: 0, fail: 0, skip: 0, emitted: 0, info: 0 };
function say(kind, name, page, msg) {
  const tag = { PASS: col('grn', 'PASS'), FAIL: col('red', 'FAIL'), SKIP: col('yel', 'SKIP'), INFO: col('cyn', 'INFO'), EMITTED: col('cyn', 'EMIT') }[kind];
  if (kind === 'PASS') tally.pass++; else if (kind === 'FAIL') tally.fail++; else if (kind === 'SKIP') tally.skip++;
  else if (kind === 'EMITTED') tally.emitted++; else tally.info++;
  console.log(`  [${tag}] ${name.padEnd(20)} ${page.padEnd(20)} ${msg}`);
}
function readJSON(p) { return JSON.parse(readFileSync(p, 'utf8')); }
// git hash-object equivalent (blob sha1) — pure Node, works without a git binary.
function gitBlobHash(path) { const b = readFileSync(path); const h = createHash('sha1'); h.update('blob ' + b.length + '\0'); h.update(b); return h.digest('hex'); }
function isGitRepo(dir) { try { return existsSync(join(dir, '.git')) && statSync(join(dir, '.git')).size >= 0; } catch { return false; } }
function resolveRepo(entry) {
  if (entry.repoPath) { let p = entry.repoPath; if (p.startsWith('~')) p = join(homedir(), p.replace(/^~[/]?/, '')); return resolve(p); }
  return join(VSCODE_ROOT, entry.repo);
}

// ---- load registries -------------------------------------------------------
let tenants, pages, spaces;
try { tenants = readJSON(join(PRESS, 'tenants.json')).tenants; } catch (e) { console.error('tenants-check: cannot read tenants.json at ' + PRESS + ' — ' + e.message); process.exit(1); }
try { pages = readJSON(join(PRESS, 'pages.json')); } catch (e) { console.error('tenants-check: cannot read pages.json — ' + e.message); process.exit(1); }
try { spaces = readJSON(join(PRESS, 'spaces.json')); } catch (e) { console.error('tenants-check: cannot read spaces.json — ' + e.message); process.exit(1); }
const personal = Array.isArray(spaces.personal) ? spaces.personal : [];
const family = Array.isArray(spaces.family) ? spaces.family : [];

console.log(`tenants-check — press root: ${PRESS}`);
console.log(`  source repos: ${VSCODE_ROOT}${REBUILD ? '   (--rebuild ON)' : ''}\n`);

// ---- per-tenant checks -----------------------------------------------------
for (const page of Object.keys(tenants)) {
  const t = tenants[page];
  const repoPath = t.repo ? resolveRepo(t) : null;

  // T1 registry — page in pages.json; tier matches spaces.json; not in both lists.
  {
    const inP = personal.includes(page), inF = family.includes(page);
    if (!pages[page]) say('FAIL', 'T1 registry', page, 'not in pages.json');
    else if (inP && inF) say('FAIL', 'T1 registry', page, 'in BOTH spaces.json personal[] and family[]');
    else {
      const expect = inP ? 'personal' : inF ? 'family' : 'public';
      if (t.tier !== expect) say('FAIL', 'T1 registry', page, `tenants.json tier="${t.tier}" but spaces.json says "${expect}"`);
      else say('PASS', 'T1 registry', page, `tier ${expect}`);
    }
  }

  // T2 source — repo ≠ null ⇒ the source repo exists and is a git repo.
  if (t.repo == null) say('SKIP', 'T2 source', page, 'press-native (repo: null)');
  else if (!existsSync(repoPath)) {
    if (t.vendored || t.release) say('FAIL', 'T2 source', page, `source repo missing at ${repoPath}`);
    else say('SKIP', 'T2 source', page, `provenance-only repo "${t.repo}" not on disk at ${repoPath}`);
  } else if (!isGitRepo(repoPath)) say('FAIL', 'T2 source', page, `${repoPath} is not a git repo`);
  else say('PASS', 'T2 source', page, `${t.repo} present`);

  // T3 vendored gate — vendored ≠ null ⇒ byte-identical to press/src/<gate>. Missing = FAIL.
  if (t.vendored == null) say('SKIP', 'T3 gate', page, 'no vendored gate');
  else {
    const canonical = join(PRESS, t.gate);
    const vend = join(repoPath, t.vendored);
    if (!existsSync(vend)) say('FAIL', 'T3 gate', page, `vendored gate MISSING at ${vend}`);
    else if (!existsSync(canonical)) say('FAIL', 'T3 gate', page, `canonical ${t.gate} missing in press`);
    else {
      const a = gitBlobHash(vend), b = gitBlobHash(canonical);
      if (a === b) say('PASS', 'T3 gate', page, `${t.vendored} == press/${t.gate} (${a.slice(0, 8)})`);
      else say('FAIL', 'T3 gate', page, `DRIFT: ${t.vendored} (${a.slice(0, 8)}) != press/${t.gate} (${b.slice(0, 8)}) — re-vendor in the SOURCE repo`);
    }
  }

  // T4 release contract — release ≠ null ⇒ honours PRESS_DIR + spaces.json + a gate byte-compare,
  //    and does NOT write spaces.json / tenants.json.
  if (t.release == null) say('SKIP', 'T4 release', page, 'no release script');
  else {
    const rel = join(repoPath, t.release);
    if (!existsSync(rel)) say('FAIL', 'T4 release', page, `release script MISSING at ${rel}`);
    else {
      const txt = readFileSync(rel, 'utf8');
      const missing = [];
      if (!/PRESS_DIR/.test(txt)) missing.push('PRESS_DIR');
      if (!/spaces\.json/.test(txt)) missing.push('spaces.json read');
      if (!/publish-checks|assertVendoredGate/.test(txt)) missing.push('vendored-gate byte-compare (publish-checks)');
      // writes spaces.json / tenants.json? — a write/copy call whose target arg carries the literal.
      const wrote = [];
      for (const line of txt.split('\n')) {
        const m = line.match(/(?:writeFileSync|copyFileSync|writeFile|cpSync)\s*\((.*)/);
        if (!m) continue;
        const arg = m[1].split(/,(?![^(]*\))/)[0]; // first top-level arg
        if (/spaces\.json/.test(arg)) wrote.push('spaces.json');
        if (/tenants\.json/.test(arg)) wrote.push('tenants.json');
      }
      if (missing.length || wrote.length) {
        const parts = [];
        if (missing.length) parts.push('missing ' + missing.join(', '));
        if (wrote.length) parts.push('WRITES ' + [...new Set(wrote)].join('/') + ' (registries are read-only)');
        say('FAIL', 'T4 release', page, parts.join('; '));
      } else say('PASS', 'T4 release', page, 'PRESS_DIR + spaces.json read + gate compare; no registry writes');
    }
  }

  // T5 rebuild-vs-live — only with --rebuild. deterministic:true ⇒ build & assert hash == press/<page>.
  if (REBUILD) {
    if (!t.build || !t.output || !repoPath || !existsSync(repoPath)) {
      say('SKIP', 'T5 rebuild', page, t.deterministic ? 'deterministic but no build/output or repo' : 'not a buildable tenant');
    } else {
      const live = join(PRESS, page);
      const out = join(repoPath, t.output);
      let built = false;
      try { const [cmd, ...cargs] = t.build.split(/\s+/); execFileSync(cmd, cargs, { cwd: repoPath, stdio: 'pipe' }); built = true; }
      catch (e) { say(t.deterministic ? 'FAIL' : 'INFO', 'T5 rebuild', page, `build "${t.build}" failed: ${String(e.message).split('\n')[0]}`); }
      if (built) {
        if (!existsSync(out)) say(t.deterministic ? 'FAIL' : 'INFO', 'T5 rebuild', page, `build produced no ${t.output}`);
        else if (!existsSync(live)) say('INFO', 'T5 rebuild', page, `no live press/${page} to compare`);
        else {
          const bo = gitBlobHash(out), bl = gitBlobHash(live);
          if (t.deterministic) {
            if (bo === bl) say('PASS', 'T5 rebuild', page, `rebuild == press/${page} (${bo.slice(0, 8)})`);
            else say('FAIL', 'T5 rebuild', page, `rebuild ${bo.slice(0, 8)} != press/${page} ${bl.slice(0, 8)}`);
          } else say('INFO', 'T5 rebuild', page, `non-deterministic — rebuild ${bo.slice(0, 8)} vs live ${bl.slice(0, 8)}`);
        }
      }
    }
  }
}

// ---- T6 family grants (EMITTED — the script cannot reach the DB) ------------
if (family.length) {
  // Access tables (press_access_apps/grants) key on the FULL page filename (e.g. 'remit.html'),
  // NOT the press_state stem — and the active flag lives on the GRANT (press_access_grants.active).
  const list = family.map((s) => `'${s}'`).join(', ');
  console.log('\n  [' + col('cyn', 'EMIT') + '] T6 family-grants     (run via the Supabase MCP; expect >=1 active grant per page)');
  console.log(col('dim', [
    '        select a.page, count(g.*) filter (where g.active) as active_grants',
    '        from press_access_apps a',
    '        left join press_access_grants g on g.page = a.page',
    `        where a.page in (${list})`,
    '        group by a.page;',
  ].join('\n')));
  tally.emitted++;
}

// ---- summary ---------------------------------------------------------------
console.log(`\ntenants-check: ${tally.pass} pass, ${tally.fail} fail, ${tally.skip} skip, ${tally.emitted} emitted` + (tally.info ? `, ${tally.info} info` : ''));
process.exit(tally.fail ? 1 : 0);
