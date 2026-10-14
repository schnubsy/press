#!/usr/bin/env node
// tools/tenants-check.mjs — audit every marquee↔tenant coupling from the press root.
//
// The marquee is a PLATFORM with TENANTS (press/docs/spec.md → Tenants). This command reads the
// three repo-owned registries (tenants.json, pages.json, spaces.json) and, per tenant, runs one
// named check. Prints PASS / FAIL / SKIP / INFO / EMITTED + a reason; EXITS 1 on any FAIL.
//
//   node tools/tenants-check.mjs                 # T1–T4 + T6–T10 (no build)
//   node tools/tenants-check.mjs --rebuild       # + T5 rebuild-vs-live for deterministic tenants
//   node tools/tenants-check.mjs --press <dir>   # override the press root (default: where this lives)
//   CODE_ROOT=<dir> node tools/tenants-check.mjs   # override the source-repos parent (default = the parent of this press clone — sibling clones)
//   COUNCIL_DIR=<dir> node tools/tenants-check.mjs # override the council repo for T8 (default = the sibling ../council clone)
//   A Mac press run whose council / tenant repos are NOT beside the press clone sets COUNCIL_DIR / CODE_ROOT explicitly.
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
// Defaults are sibling clones of this press clone (arc/unpin-the-mac, fsa-claims 2026-10-14) — never a homedir()/Documents path.
const CODE_ROOT = resolve(process.env.CODE_ROOT || join(SELF_ROOT, '..'));
const REBUILD = has('--rebuild');
const COUNCIL_DIR = resolve(process.env.COUNCIL_DIR || join(SELF_ROOT, '..', 'council'));

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
  return join(CODE_ROOT, entry.repo);
}

// ---- load registries -------------------------------------------------------
let tenants, pages, spaces, redirects;
try { const tj = readJSON(join(PRESS, 'tenants.json')); tenants = tj.tenants; redirects = tj.redirects || {}; } catch (e) { console.error('tenants-check: cannot read tenants.json at ' + PRESS + ' — ' + e.message); process.exit(1); }
try { pages = readJSON(join(PRESS, 'pages.json')); } catch (e) { console.error('tenants-check: cannot read pages.json — ' + e.message); process.exit(1); }
try { spaces = readJSON(join(PRESS, 'spaces.json')); } catch (e) { console.error('tenants-check: cannot read spaces.json — ' + e.message); process.exit(1); }
const personal = Array.isArray(spaces.personal) ? spaces.personal : [];
const family = Array.isArray(spaces.family) ? spaces.family : [];

console.log(`tenants-check — press root: ${PRESS}`);
console.log(`  source repos: ${CODE_ROOT}${REBUILD ? '   (--rebuild ON)' : ''}\n`);

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

// ---- T7 tool-cfg — a personal page that STORES DATA must have a TOOL_CFG entry -------------
// "Stores data" is read INDEPENDENTLY of TOOL_CFG (else the check is circular): a page stores data
// iff the vault keyring (src/vault.js → emptyKeyring) holds an entry for it. Every such page that is
// also personal-tier in spaces.json MUST appear in index.html's TOOL_CFG, or it silently drops out of
// "Connect your tools" AND the recovery kit. (access.html is personal but has no keyring entry, so it
// is correctly exempt.)
{
  const vaultPath = join(PRESS, 'src', 'vault.js');
  const indexPath = join(PRESS, 'index.html');
  if (!existsSync(vaultPath) || !existsSync(indexPath)) {
    say('SKIP', 'T7 tool-cfg', '(marquee)', 'no src/vault.js or index.html to audit');
  } else {
    const vaultSrc = readFileSync(vaultPath, 'utf8');
    const indexSrc = readFileSync(indexPath, 'utf8');
    // keyring apps = the object keys inside emptyKeyring()'s `apps: { … }` (the vault's tool list).
    const ks = vaultSrc.indexOf('emptyKeyring');
    const ke = ks >= 0 ? vaultSrc.indexOf('};', ks) : -1;
    const kregion = ke > ks ? vaultSrc.slice(ks, ke) : '';
    const keyring = new Set([...kregion.matchAll(/'([a-z0-9-]+\.html)'\s*:/g)].map((m) => m[1]));
    // TOOL_CFG keys in index.html.
    const tcm = indexSrc.match(/const TOOL_CFG\s*=\s*\{([\s\S]*?)\n\};/);
    const toolcfg = new Set(tcm ? [...tcm[1].matchAll(/'([a-z0-9-]+\.html)'\s*:/g)].map((m) => m[1]) : []);
    // KEYRING_ID (rename arc 2026-10-14): a renamed page keeps its ENROLLED keyring id — map link file → keyring id so the
    // renamed page is still recognised as a data page (thrift-shop.html stores data under keyring id card-scout.html).
    const km = indexSrc.match(/const KEYRING_ID\s*=\s*\{([^}]*)\}/);
    const alias = new Map(km ? [...km[1].matchAll(/'([a-z0-9-]+\.html)'\s*:\s*'([a-z0-9-]+\.html)'/g)].map((m) => [m[1], m[2]]) : []);
    const kid = (p) => alias.get(p) || p;
    // an alias map that exists but parses to nothing would silently drop every renamed page from the audit
    const aliasBroken = km && /\.html/.test(km[1]) && !alias.size;
    if (!keyring.size) say('SKIP', 'T7 tool-cfg', '(marquee)', 'could not read the vault keyring (emptyKeyring)');
    else if (aliasBroken) say('FAIL', 'T7 tool-cfg', '(marquee)', "KEYRING_ID found in index.html but no 'link.html': 'id.html' pair parsed");
    else if (!tcm) say('FAIL', 'T7 tool-cfg', '(marquee)', 'TOOL_CFG block not found in index.html');
    else {
      const dataPersonal = personal.filter((p) => keyring.has(kid(p))); // personal pages that store data (via KEYRING_ID)
      // every vault keyring id must belong to a personal page (directly or via KEYRING_ID) — an orphan id means a renamed
      // or removed tool silently left Connect / the recovery kit
      const orphan = [...keyring].filter((id) => !personal.some((p) => kid(p) === id));
      if (orphan.length) say('FAIL', 'T7 tool-cfg', '(marquee)', `keyring id(s) with no personal page (map a renamed page in KEYRING_ID): ${orphan.join(', ')}`);
      const missing = dataPersonal.filter((p) => !toolcfg.has(p));
      if (missing.length) say('FAIL', 'T7 tool-cfg', '(marquee)', `personal data page(s) with NO TOOL_CFG entry (won't show in Connect / recovery kit): ${missing.join(', ')}`);
      else if (!orphan.length) say('PASS', 'T7 tool-cfg', '(marquee)', `${dataPersonal.length} personal data page(s) all present in TOOL_CFG`);
    }
  }
}

// ---- T8 registry-parity — every tenant page has a council snag-registry row with the same repo ---------
// The snag instrument (council skills/hand/references/snag.md) routes a snag about a page to the repo its
// registry row names, and the monthly train sweeps apps from that registry — so a tenant missing from it
// (or pointing at the wrong repo) is a page whose snags land nowhere. Missing registry file = FAIL, not SKIP.
{
  const regPath = join(COUNCIL_DIR, 'instruments', 'snag', 'registry.json');
  let reg = null;
  if (!existsSync(regPath)) say('FAIL', 'T8 registry-parity', '(marquee)', `snag registry MISSING at ${regPath} (set COUNCIL_DIR)`);
  else {
    try { reg = readJSON(regPath); } catch (e) { say('FAIL', 'T8 registry-parity', '(marquee)', `snag registry unreadable: ${e.message}`); }
  }
  if (reg) {
    const rows = new Map((Array.isArray(reg.solutions) ? reg.solutions : []).filter((r) => r && r.page).map((r) => [r.page, r]));
    for (const page of Object.keys(tenants)) {
      const want = 'schnubsy/' + (tenants[page].repo || 'press');
      const row = rows.get(page);
      // A renamed tenant (tenants.json `formerly`) may still be registered under its former page + repo until the council
      // registry is updated (Steward) — accepted ONLY when that row matches the former pair exactly, and said out loud.
      const was = tenants[page].formerly;
      const oldRow = was && was.page ? rows.get(was.page) : null;
      if (!row && oldRow && oldRow.repo === 'schnubsy/' + was.repo)
        say('PASS', 'T8 registry-parity', page, `${oldRow.id} → ${oldRow.repo} (FORMER name ${was.page}; council registry update pending → page ${page}, repo ${want})`);
      else if (!row) say('FAIL', 'T8 registry-parity', page, `no snag-registry row (add it to council instruments/snag/registry.json)`);
      else if (row.repo !== want) say('FAIL', 'T8 registry-parity', page, `registry repo ${row.repo} != tenants.json ${want}`);
      else say('PASS', 'T8 registry-parity', page, `${row.id} → ${row.repo}`);
    }
  }
}

// ---- T9 labels — every pages.json page has a marquee LABELS entry (the marquee owns card naming) ----
// RULE (Mark, 2026-10-12): a card's kicker / title / icon live in ONE label map in index.html (`const LABELS`);
// release scripts never set card wording and pages.json `title` is the tab title only. So a page published
// without its LABELS entry would render a generic fallback card — FAIL it. Each entry must carry a non-empty
// kicker, title and an icon key that exists in index.html's ICONS registry. No index.html = SKIP (as T7);
// an index.html with no LABELS block = FAIL.
{
  const indexPath = join(PRESS, 'index.html');
  if (!existsSync(indexPath)) say('SKIP', 'T9 labels', '(marquee)', 'no index.html to audit');
  else {
    const src = readFileSync(indexPath, 'utf8');
    const lm = src.match(/const LABELS\s*=\s*\{([\s\S]*?)\n\};/);
    if (!lm) say('FAIL', 'T9 labels', '(marquee)', 'LABELS block not found in index.html (the marquee label map)');
    else {
      const labels = new Map();
      for (const m of lm[1].matchAll(/['"]([a-z0-9-]+\.html)['"]\s*:\s*\{([^}]*)\}/g)) {
        const f = {};
        for (const fm of m[2].matchAll(/(kicker|title|icon)\s*:\s*(['"])(.*?)\2/g)) f[fm[1]] = fm[3];
        labels.set(m[1], f);
      }
      const im = src.match(/const ICONS\s*=\s*\{([\s\S]*?)\n\};/);
      const icons = new Set(im ? [...im[1].matchAll(/^\s*['"]([^'"]+)['"]\s*:/gm)].map((m) => m[1]) : []);
      for (const page of Object.keys(pages)) {
        const l = labels.get(page);
        if (!l) { say('FAIL', 'T9 labels', page, 'no LABELS entry in index.html — add {kicker,title,icon} in the same press change as the publish'); continue; }
        const miss = ['kicker', 'title', 'icon'].filter((k) => !l[k]);
        if (miss.length) say('FAIL', 'T9 labels', page, `LABELS entry missing ${miss.join(', ')}`);
        else if (!icons.has(l.icon)) say('FAIL', 'T9 labels', page, `LABELS icon "${l.icon}" is not a key in ICONS`);
        else say('PASS', 'T9 labels', page, `${l.kicker} / ${l.title} · ${l.icon}`);
      }
    }
  }
}

// ---- T10 redirects — the named exception for an old page file kept as a redirect stub (rename arc, 2026-10-14) ----
// tenants.json `redirects` {old: {to, …}} is the ONE list of root .html files that are NOT pages. Each must: exist; stay
// tiny (≤ 2 KB) and noindex; location.replace() to its target keeping the #hash; carry no gate/vault/data code; point at
// a real page; and appear in NO page registry (pages.json, spaces.json, LABELS) — else it would render as a card.
// index.html REDIRECT_STUBS must list exactly the same map (the marquee hides those files). And every root .html is
// either a pages.json page, a redirect, or index.html — nothing unregistered.
{
  const indexPath = join(PRESS, 'index.html');
  const src = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  const rm = src.match(/const REDIRECT_STUBS\s*=\s*\{([^}]*)\}/);
  const inIndex = new Map(rm ? [...rm[1].matchAll(/'([a-z0-9-]+\.html)'\s*:\s*'([a-z0-9-]+\.html)'/g)].map((m) => [m[1], m[2]]) : []);
  const lm = src.match(/const LABELS\s*=\s*\{([\s\S]*?)\n\};/);
  const labelKeys = new Set(lm ? [...lm[1].matchAll(/['"]([a-z0-9-]+\.html)['"]\s*:/g)].map((m) => m[1]) : []);
  for (const [stub, r] of Object.entries(redirects)) {
    const to = r && r.to;
    const p = join(PRESS, stub);
    const errs = [];
    if (!existsSync(p)) errs.push('file missing');
    else {
      const txt = readFileSync(p, 'utf8');
      if (txt.length > 2048) errs.push(`${txt.length} bytes (> 2 KB)`);
      if (!/<meta name="robots" content="noindex">/.test(txt)) errs.push('no noindex');
      if (!txt.includes(`location.replace('${to}' + location.search + location.hash)`)) errs.push(`no hash-preserving location.replace to ${to}`);
      if (/PressGate|press:vault|supabase|sb_publishable_|fetch\(|localStorage/i.test(txt)) errs.push('carries gate/vault/data code');
    }
    if (!to || !pages[to]) errs.push(`target ${to} is not a pages.json page`);
    if (pages[stub] || personal.includes(stub) || family.includes(stub) || labelKeys.has(stub) || tenants[stub]) errs.push('also registered as a page');
    if (inIndex.get(stub) !== to) errs.push(`index.html REDIRECT_STUBS says ${inIndex.get(stub) || 'nothing'}`);
    if (errs.length) say('FAIL', 'T10 redirects', stub, errs.join('; '));
    else say('PASS', 'T10 redirects', stub, `→ ${to} (named exception: not a page)`);
  }
  for (const [stub] of inIndex) if (!redirects[stub]) say('FAIL', 'T10 redirects', stub, 'in index.html REDIRECT_STUBS but not tenants.json redirects');
  let rootHtml = [];
  try { rootHtml = execFileSync('git', ['-C', PRESS, 'ls-files', '*.html'], { encoding: 'utf8' }).split('\n').filter((f) => f && !f.includes('/')); } catch { /* not a git checkout */ }
  const stray = rootHtml.filter((f) => f !== 'index.html' && !pages[f] && !redirects[f]);
  // the reverse: every registered page + redirect target is a TRACKED file (a stub must never point at a 404)
  const missing = rootHtml.length ? [...Object.keys(pages), ...Object.values(redirects).map((r) => r && r.to)].filter((f) => f && !f.includes('/') && !rootHtml.includes(f)) : [];
  if (stray.length) say('FAIL', 'T10 redirects', '(root)', `root .html not in pages.json or redirects: ${stray.join(', ')}`);
  if (missing.length) say('FAIL', 'T10 redirects', '(root)', `registered but not a tracked root file: ${[...new Set(missing)].join(', ')}`);
  if (rootHtml.length && !stray.length && !missing.length) say('PASS', 'T10 redirects', '(root)', `${rootHtml.length} root .html = pages.json + redirects + index.html`);
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
