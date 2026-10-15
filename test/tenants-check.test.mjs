// test/tenants-check.test.mjs — unit tests for tools/tenants-check.mjs (node:test, no deps).
// Each test scaffolds a throwaway estate (a fake press root + fake source repos) under the OS temp
// dir and runs the REAL checker against it via --press + CODE_ROOT, asserting exit code + output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECKER = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'tenants-check.mjs');
const GATE = '// canonical gate\nglobalThis.PressGate = { guard() {} };\n';

// A release script that satisfies the T4 contract (PRESS_DIR + spaces.json read + gate compare; no writes).
const GOOD_RELEASE = `import { readFileSync } from 'node:fs';
const PRESS = process.env.PRESS_DIR || '../press';
// publish-checks: assertVendoredGateMatchesCanonical
const spaces = JSON.parse(readFileSync(PRESS + '/spaces.json', 'utf8'));
console.log('ok', spaces);
`;

// A conforming redirect stub (rename arc, T10): tiny, noindex, hash-preserving replace, no data code.
const STUB = (to) => `<!doctype html><meta name="robots" content="noindex"><script>location.replace('${to}' + location.search + location.hash);</script><meta http-equiv="refresh" content="0;url=${to}">`;

function estate() {
  // realpath: Node resolves the checker's own path symlink-free (macOS tmpdir /var → /private/var)
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'tenants-check-')));
  const press = join(base, 'press');
  const vscode = join(base, 'vscode');
  const council = join(base, 'council');
  mkdirSync(join(press, 'src'), { recursive: true });
  mkdirSync(vscode, { recursive: true });
  mkdirSync(join(council, 'instruments', 'snag'), { recursive: true });
  writeFileSync(join(press, 'src', 'gate.js'), GATE);
  const reg = { pages: {}, spaces: { v: 2, personal: [], family: [] }, tenants: {}, redirects: null };
  // T8: by default the council snag registry mirrors tenants.json; a test may edit it (snagRows) or drop it (noRegistry).
  let snagEdit = null, noRegistry = false;
  return {
    base, press, vscode, council,
    snagRows(fn) { snagEdit = fn; return this; },
    noSnagRegistry() { noRegistry = true; return this; },
    page(name, content = '<html>' + name + '</html>') { writeFileSync(join(press, name), content); reg.pages[name] = { title: name }; return this; },
    parent(name, par) { reg.pages[name].parent = par; return this; },
    tier(name, t) { if (t === 'personal') reg.spaces.personal.push(name); else if (t === 'family') reg.spaces.family.push(name); return this; },
    tenant(name, entry) { reg.tenants[name] = entry; return this; },
    redirect(stub, to, content = STUB(to)) { writeFileSync(join(press, stub), content); (reg.redirects ||= {})[stub] = { to }; return this; },
    repo(name, { gate = GATE, vendored = 'src/vendor/press-gate.js', release = GOOD_RELEASE, releasePath = 'tools/release.js', git = true, build, buildOut } = {}) {
      const dir = join(vscode, name);
      mkdirSync(dir, { recursive: true });
      if (git) mkdirSync(join(dir, '.git'), { recursive: true });
      if (vendored && gate !== null) { mkdirSync(join(dir, dirname(vendored)), { recursive: true }); writeFileSync(join(dir, vendored), gate); }
      if (release && releasePath) { mkdirSync(join(dir, dirname(releasePath)), { recursive: true }); writeFileSync(join(dir, releasePath), release); }
      if (build) writeFileSync(join(dir, 'build.js'), build);
      return this;
    },
    write() {
      writeFileSync(join(press, 'pages.json'), JSON.stringify(reg.pages, null, 2));
      writeFileSync(join(press, 'spaces.json'), JSON.stringify(reg.spaces));
      writeFileSync(join(press, 'tenants.json'), JSON.stringify({ v: 1, tenants: reg.tenants, ...(reg.redirects ? { redirects: reg.redirects } : {}) }, null, 2));
      if (!noRegistry) {
        let rows = Object.entries(reg.tenants).map(([page, t]) => ({ id: page.replace(/\.html$/, ''), kind: 'web', page, repo: 'schnubsy/' + (t.repo || 'press') }));
        if (snagEdit) rows = snagEdit(rows);
        writeFileSync(join(council, 'instruments', 'snag', 'registry.json'), JSON.stringify({ v: 1, solutions: rows }, null, 2));
      }
      return this;
    },
    run(args = []) {
      try { const out = execFileSync('node', [CHECKER, '--press', this.press, ...args], { env: { ...process.env, CODE_ROOT: this.vscode, COUNCIL_DIR: this.council }, encoding: 'utf8' }); return { code: 0, out }; }
      catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
    },
    cleanup() { rmSync(base, { recursive: true, force: true }); },
  };
}
// grab the check line for a page+check-prefix
const line = (out, check, page) => out.split('\n').find((l) => l.includes(check) && l.includes(page)) || '';

test('T1 registry PASS — tier matches spaces.json', () => {
  const e = estate();
  e.page('giving.html').tier('giving.html', 'personal').tenant('giving.html', { repo: null, tier: 'personal', gate: null, vendored: null, release: null }).write();
  const r = e.run();
  assert.match(line(r.out, 'T1 registry', 'giving.html'), /PASS/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T1 registry FAIL — tenants tier disagrees with spaces.json', () => {
  const e = estate();
  e.page('x.html').tier('x.html', 'personal').tenant('x.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null }).write();
  const r = e.run();
  assert.match(line(r.out, 'T1 registry', 'x.html'), /FAIL/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T1 registry FAIL — page in BOTH personal[] and family[]', () => {
  const e = estate();
  e.page('d.html').tier('d.html', 'personal').tier('d.html', 'family').tenant('d.html', { repo: null, tier: 'personal', gate: null, vendored: null, release: null }).write();
  const r = e.run();
  assert.match(line(r.out, 'T1 registry', 'd.html'), /FAIL.*BOTH/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T2 source PASS — repo present + git', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa').tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  assert.match(line(e.run().out, 'T2 source', 'a.html'), /PASS/);
  e.cleanup();
});

test('T2 source FAIL — repo missing but coupling declared', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').tenant('a.html', { repo: 'ghost', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  const r = e.run();
  assert.match(line(r.out, 'T2 source', 'a.html'), /FAIL/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T3 gate PASS — vendored byte-identical to canonical', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa').tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  assert.match(line(e.run().out, 'T3 gate', 'a.html'), /PASS/);
  e.cleanup();
});

test('T3 gate FAIL — vendored drift', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa', { gate: '// DRIFTED\n' }).tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  const r = e.run();
  assert.match(line(r.out, 'T3 gate', 'a.html'), /FAIL.*DRIFT/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T3 gate FAIL — vendored MISSING (not SKIP)', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa', { vendored: null }).tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  const r = e.run();
  const l = line(r.out, 'T3 gate', 'a.html');
  assert.match(l, /FAIL/);
  assert.doesNotMatch(l, /SKIP/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T4 release PASS — PRESS_DIR + spaces.json + gate compare, no writes', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa').tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  assert.match(line(e.run().out, 'T4 release', 'a.html'), /PASS/);
  e.cleanup();
});

test('T4 release FAIL — missing PRESS_DIR', () => {
  const e = estate();
  const rel = GOOD_RELEASE.replace(/process\.env\.PRESS_DIR \|\| /, "");
  e.page('a.html').tier('a.html', 'personal').repo('appa', { release: rel }).tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  const r = e.run();
  assert.match(line(r.out, 'T4 release', 'a.html'), /FAIL.*PRESS_DIR/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T4 release FAIL — writes spaces.json (registry is read-only)', () => {
  const e = estate();
  const rel = GOOD_RELEASE + "\nimport { writeFileSync } from 'node:fs';\nwriteFileSync(PRESS + '/spaces.json', '{}');\n";
  e.page('a.html').tier('a.html', 'personal').repo('appa', { release: rel }).tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  const r = e.run();
  assert.match(line(r.out, 'T4 release', 'a.html'), /FAIL.*WRITES spaces\.json/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T5 rebuild PASS — deterministic build reproduces the live page', () => {
  const e = estate();
  const content = '<html>DETERMINISTIC</html>';
  const build = `import { writeFileSync, mkdirSync } from 'node:fs';\nmkdirSync('dist',{recursive:true});\nwriteFileSync('dist/out.html', ${JSON.stringify(content)});\n`;
  e.page('a.html', content).tier('a.html', 'personal').repo('appa', { build }).tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js', build: 'node build.js', output: 'dist/out.html', deterministic: true }).write();
  const r = e.run(['--rebuild']);
  assert.match(line(r.out, 'T5 rebuild', 'a.html'), /PASS/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T5 rebuild FAIL — deterministic build differs from the live page', () => {
  const e = estate();
  const build = `import { writeFileSync, mkdirSync } from 'node:fs';\nmkdirSync('dist',{recursive:true});\nwriteFileSync('dist/out.html', '<html>DIFFERENT</html>');\n`;
  e.page('a.html', '<html>LIVE</html>').tier('a.html', 'personal').repo('appa', { build }).tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js', build: 'node build.js', output: 'dist/out.html', deterministic: true }).write();
  const r = e.run(['--rebuild']);
  assert.match(line(r.out, 'T5 rebuild', 'a.html'), /FAIL/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T6 family-grants EMITTED — SQL printed for family pages', () => {
  const e = estate();
  e.page('remit.html').tier('remit.html', 'family').tenant('remit.html', { repo: null, tier: 'family', gate: 'src/family-gate.js', vendored: null, release: null }).write();
  const r = e.run();
  assert.match(r.out, /T6 family-grants/);
  assert.match(r.out, /press_access_grants/);
  assert.match(r.out, /'remit\.html'/);
  assert.match(r.out, /filter \(where g\.active\)/);
  e.cleanup();
});

// --- T7 tool-cfg helpers: a vault.js whose emptyKeyring lists `apps`, and an index.html TOOL_CFG.
function writeVault(press, apps) {
  const entries = apps.map((a) => `        '${a}': { sync_id: '' }`).join(',\n');
  writeFileSync(join(press, 'src', 'vault.js'),
    `var emptyKeyring = function () {\n  return { v: 1, apps: {\n${entries}\n  } };\n};\n`);
}
// The index.html also carries the T9 marquee label map: by default one LABELS entry per pages.json page
// (call AFTER e.write()); pass `labels` (an object page → {kicker,title,icon}) to override it, or
// `labels: null` to omit the LABELS block entirely. ICONS always holds 'Page' + 'gift'.
function writeIndex(press, cfgApps, { labels, extra = '' } = {}) {
  const entries = cfgApps.map((a) => `  '${a}': { kind:'app' }`).join(',\n');
  if (labels === undefined) {
    const pages = JSON.parse(readFileSync(join(press, 'pages.json'), 'utf8'));
    labels = Object.fromEntries(Object.keys(pages).map((p) => [p, { kicker: 'Kick', title: 'T ' + p, icon: 'Page' }]));
  }
  const icons = `const ICONS={\n  'Page': '<svg/>',\n  'gift': '<svg/>'\n};\n`;
  const lbl = labels === null ? '' : `const LABELS = {\n${Object.entries(labels).map(([p, l]) =>
    `  '${p}': { ${Object.entries(l).map(([k, v]) => `${k}:'${v}'`).join(', ')} },`).join('\n')}\n};\n`;
  writeFileSync(join(press, 'index.html'),
    `<html><body><script>\n${icons}${lbl}const TOOL_CFG = {\n${entries}${cfgApps.length ? ',' : ''}\n};\n${extra}</script></body></html>`);
}

test('T7 tool-cfg PASS — every personal data (keyring) page is in TOOL_CFG', () => {
  const e = estate();
  e.page('fsa.html').tier('fsa.html', 'personal')
    .page('access.html').tier('access.html', 'personal')   // personal but NOT a keyring page -> exempt
    .write();
  writeVault(e.press, ['fsa.html']);        // fsa stores data; access does not
  writeIndex(e.press, ['fsa.html']);
  const r = e.run();
  assert.match(line(r.out, 'T7 tool-cfg', '(marquee)'), /PASS.*1 personal data/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T7 tool-cfg FAIL — a personal data page is missing from TOOL_CFG', () => {
  const e = estate();
  e.page('fsa.html').tier('fsa.html', 'personal')
    .page('giving.html').tier('giving.html', 'personal')
    .write();
  writeVault(e.press, ['fsa.html', 'giving.html']);  // both store data
  writeIndex(e.press, ['fsa.html']);                 // giving.html forgotten in TOOL_CFG
  const r = e.run();
  const l = line(r.out, 'T7 tool-cfg', '(marquee)');
  assert.match(l, /FAIL/);
  assert.match(l, /giving\.html/);
  assert.doesNotMatch(l, /fsa\.html/);               // fsa is present, so not named
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T7 tool-cfg — a personal NON-data page (no keyring entry) is exempt, not required in TOOL_CFG', () => {
  const e = estate();
  e.page('fsa.html').tier('fsa.html', 'personal')
    .page('access.html').tier('access.html', 'personal')   // personal admin page, stores no data
    .write();
  writeVault(e.press, ['fsa.html']);        // only fsa is a keyring (data) page; access is not
  writeIndex(e.press, ['fsa.html']);        // access is deliberately absent from TOOL_CFG
  const r = e.run();
  const l = line(r.out, 'T7 tool-cfg', '(marquee)');
  assert.match(l, /PASS.*1 personal data/);  // fsa counted; access exempt (not a keyring page)
  assert.doesNotMatch(l, /access\.html/);    // access is never flagged despite missing from TOOL_CFG
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T7 tool-cfg SKIP — no vault.js / index.html to audit', () => {
  const e = estate();
  e.page('fsa.html').tier('fsa.html', 'personal').write();   // no vault.js, no index.html written
  const r = e.run();
  assert.match(line(r.out, 'T7 tool-cfg', '(marquee)'), /SKIP/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('clean estate exits 0; a single FAIL flips the exit to 1', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa').tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' }).write();
  assert.equal(e.run().code, 0);
  e.cleanup();
});

test('T8 registry-parity PASS — every tenant page has a snag-registry row with the same repo', () => {
  const e = estate();
  e.page('a.html').tier('a.html', 'personal').repo('appa').tenant('a.html', { repo: 'appa', tier: 'personal', gate: 'src/gate.js', vendored: 'src/vendor/press-gate.js', release: 'tools/release.js' })
    .page('k.html').tenant('k.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null }).write();
  const r = e.run();
  assert.match(line(r.out, 'T8 registry-parity', 'a.html'), /PASS.*schnubsy\/appa/);
  assert.match(line(r.out, 'T8 registry-parity', 'k.html'), /PASS.*schnubsy\/press/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T8 registry-parity FAIL — a tenant page with no registry row', () => {
  const e = estate();
  e.page('k.html').tenant('k.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null })
    .snagRows(() => []).write();
  const r = e.run();
  assert.match(line(r.out, 'T8 registry-parity', 'k.html'), /FAIL.*no snag-registry row/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T8 registry-parity FAIL — registry repo differs from tenants.json', () => {
  const e = estate();
  e.page('k.html').tenant('k.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null })
    .snagRows((rows) => rows.map((x) => ({ ...x, repo: 'schnubsy/elsewhere' }))).write();
  const r = e.run();
  assert.match(line(r.out, 'T8 registry-parity', 'k.html'), /FAIL.*schnubsy\/elsewhere != tenants\.json schnubsy\/press/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T8 registry-parity FAIL (not SKIP) — the council registry file is missing', () => {
  const e = estate();
  e.page('k.html').tenant('k.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null }).noSnagRegistry().write();
  const r = e.run();
  assert.match(line(r.out, 'T8 registry-parity', '(marquee)'), /FAIL.*MISSING/);
  assert.equal(r.code, 1);
  e.cleanup();
});

// --- T9 labels: every pages.json page has a marquee LABELS entry (kicker/title/icon; icon ∈ ICONS).
test('T9 labels PASS — every pages.json page has a LABELS entry with a known icon', () => {
  const e = estate();
  e.page('a.html').page('fsa.html').tier('fsa.html', 'personal').write();
  writeIndex(e.press, [], { labels: { 'a.html': { kicker: 'Day planner', title: 'Optimo', icon: 'Page' }, 'fsa.html': { kicker: 'Medical Expenses', title: 'FSA Claims Tracker', icon: 'gift' } } });
  const r = e.run();
  assert.match(line(r.out, 'T9 labels', 'a.html'), /PASS.*Day planner \/ Optimo/);
  assert.match(line(r.out, 'T9 labels', 'fsa.html'), /PASS.*FSA Claims Tracker · gift/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T9 labels FAIL — a pages.json page has no LABELS entry (published without coordinating naming)', () => {
  const e = estate();
  e.page('a.html').page('newapp.html').write();
  writeIndex(e.press, [], { labels: { 'a.html': { kicker: 'K', title: 'A', icon: 'Page' } } });
  const r = e.run();
  assert.match(line(r.out, 'T9 labels', 'a.html'), /PASS/);
  assert.match(line(r.out, 'T9 labels', 'newapp.html'), /FAIL.*no LABELS entry/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T9 labels FAIL — an entry missing a field, or naming an icon not in ICONS', () => {
  const e = estate();
  e.page('a.html').page('b.html').write();
  writeIndex(e.press, [], { labels: { 'a.html': { kicker: 'K', icon: 'Page' }, 'b.html': { kicker: 'K', title: 'B', icon: 'nope' } } });
  const r = e.run();
  assert.match(line(r.out, 'T9 labels', 'a.html'), /FAIL.*missing title/);
  assert.match(line(r.out, 'T9 labels', 'b.html'), /FAIL.*icon "nope" is not a key in ICONS/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T9 labels FAIL — index.html without a LABELS block; SKIP with no index.html', () => {
  const e = estate();
  e.page('a.html').write();
  assert.match(line(e.run().out, 'T9 labels', '(marquee)'), /SKIP/);   // no index.html yet
  writeIndex(e.press, [], { labels: null });
  const r = e.run();
  assert.match(line(r.out, 'T9 labels', '(marquee)'), /FAIL.*LABELS block not found/);
  assert.equal(r.code, 1);
  e.cleanup();
});

// --- rename arc (2026-10-14): KEYRING_ID alias (T7), `formerly` (T8), redirect stubs (T10).
test('T7 tool-cfg — a RENAMED data page counts via KEYRING_ID (link file → enrolled keyring id)', () => {
  const e = estate();
  e.page('thrift-shop.html').tier('thrift-shop.html', 'personal').write();
  writeVault(e.press, ['card-scout.html']);                 // the enrolled id never changed
  writeIndex(e.press, ['thrift-shop.html'], { extra: "const KEYRING_ID = { 'thrift-shop.html': 'card-scout.html' };\n" });
  assert.match(line(e.run().out, 'T7 tool-cfg', '(marquee)'), /PASS.*1 personal data/);
  writeIndex(e.press, [], { extra: "const KEYRING_ID = { 'thrift-shop.html': 'card-scout.html' };\n" });   // dropped from TOOL_CFG
  const r = e.run();
  assert.match(line(r.out, 'T7 tool-cfg', '(marquee)'), /FAIL.*thrift-shop\.html/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T8 registry-parity — a renamed tenant passes on its FORMER registry row (said out loud); a wrong former repo FAILs', () => {
  const e = estate();
  e.page('new.html').tenant('new.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null, formerly: { page: 'old.html', repo: 'oldrepo' } })
    .snagRows(() => [{ id: 'old', page: 'old.html', repo: 'schnubsy/oldrepo' }]).write();
  assert.match(line(e.run().out, 'T8 registry-parity', 'new.html'), /PASS.*FORMER name old\.html; council registry update pending/);
  e.snagRows(() => [{ id: 'old', page: 'old.html', repo: 'schnubsy/elsewhere' }]).write();
  const r = e.run();
  assert.match(line(r.out, 'T8 registry-parity', 'new.html'), /FAIL.*no snag-registry row/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T10 redirects PASS — a conforming stub is a named exception (no card, no registry entry)', () => {
  const e = estate();
  e.page('thrift-shop.html').redirect('card-scout.html', 'thrift-shop.html').write();
  writeIndex(e.press, [], { extra: "const REDIRECT_STUBS = { 'card-scout.html': 'thrift-shop.html' };\n" });
  const r = e.run();
  assert.match(line(r.out, 'T10 redirects', 'card-scout.html'), /PASS.*→ thrift-shop\.html/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T10 redirects FAIL — stub also a page, index map disagrees, no hash-preserving replace, oversize', () => {
  const idx = "const REDIRECT_STUBS = { 'card-scout.html': 'thrift-shop.html' };\n";
  const cases = [
    [(e) => e.page('thrift-shop.html').redirect('card-scout.html', 'thrift-shop.html').page('card-scout.html', STUB('thrift-shop.html')), idx, /also registered as a page/],
    [(e) => e.page('thrift-shop.html').redirect('card-scout.html', 'thrift-shop.html'), '', /REDIRECT_STUBS says nothing/],
    [(e) => e.page('thrift-shop.html').redirect('card-scout.html', 'thrift-shop.html', '<meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=thrift-shop.html">'), idx, /no hash-preserving location\.replace/],
    [(e) => e.page('thrift-shop.html').redirect('card-scout.html', 'thrift-shop.html', STUB('thrift-shop.html') + ' '.repeat(3000)), idx, /> 2 KB/],
    [(e) => e.redirect('card-scout.html', 'thrift-shop.html'), idx, /target thrift-shop\.html is not a pages\.json page/],
  ];
  for (const [build, extra, re] of cases) {
    const e = estate();
    build(e).write();
    writeIndex(e.press, [], { extra });
    const r = e.run();
    assert.match(line(r.out, 'T10 redirects', 'card-scout.html'), re);
    assert.equal(r.code, 1);
    e.cleanup();
  }
});

test('T7 tool-cfg FAIL — a keyring id with no personal page (a rename without KEYRING_ID)', () => {
  const e = estate();
  e.page('thrift-shop.html').tier('thrift-shop.html', 'personal').write();
  writeVault(e.press, ['card-scout.html']);
  writeIndex(e.press, ['thrift-shop.html']);                 // no KEYRING_ID: the enrolled id is orphaned
  const r = e.run();
  assert.match(line(r.out, 'T7 tool-cfg', '(marquee)'), /FAIL.*keyring id\(s\) with no personal page.*card-scout\.html/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T10 root — in a git checkout every root .html is registered AND every page / redirect target is tracked', () => {
  const e = estate();
  e.page('thrift-shop.html').redirect('card-scout.html', 'thrift-shop.html').write();
  writeIndex(e.press, [], { extra: "const REDIRECT_STUBS = { 'card-scout.html': 'thrift-shop.html' };\n" });
  const git = (...a) => execFileSync('git', ['-C', e.press, ...a], { encoding: 'utf8' });
  git('init', '-q'); git('add', 'card-scout.html', 'index.html');      // the stub tracked, its target NOT (the 🔴 shape)
  let r = e.run();
  assert.match(line(r.out, 'T10 redirects', '(root)'), /FAIL.*registered but not a tracked root file: thrift-shop\.html/);
  assert.equal(r.code, 1);
  git('add', 'thrift-shop.html');
  writeFileSync(join(e.press, 'stray.html'), '<html></html>'); git('add', 'stray.html');
  r = e.run();
  assert.match(line(r.out, 'T10 redirects', '(root)'), /FAIL.*not in pages\.json or redirects: stray\.html/);
  git('rm', '-q', '--cached', 'stray.html');
  r = e.run();
  assert.match(line(r.out, 'T10 redirects', '(root)'), /PASS.*3 root \.html/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('defaults (arc/unpin-the-mac): CODE_ROOT + COUNCIL_DIR are sibling clones of the press clone, never homedir()/Documents', () => {
  const src = readFileSync(CHECKER, 'utf8');
  assert.doesNotMatch(src, /join\(homedir\(\), 'Documents'/);
  // run a copy of the checker from <base>/press/tools with NO env overrides: it must look beside the press clone
  const e = estate();
  e.page('k.html').tenant('k.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null }).write();
  mkdirSync(join(e.press, 'tools'), { recursive: true });
  writeFileSync(join(e.press, 'tools', 'tenants-check.mjs'), src);
  const env = { ...process.env }; delete env.CODE_ROOT; delete env.COUNCIL_DIR;
  let out;
  try { out = execFileSync('node', [join(e.press, 'tools', 'tenants-check.mjs')], { env, encoding: 'utf8' }); }
  catch (err) { out = String(err.stdout) + String(err.stderr); }
  assert.match(out, new RegExp(`source repos: ${e.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s`));
  assert.doesNotMatch(out, /Documents\/(code|Claude)/);
  // COUNCIL_DIR default = <base>/council (the estate's sibling council with its snag registry): T8 finds it
  assert.doesNotMatch(out, /snag registry MISSING/);
  assert.match(out, /\[PASS\] T8 registry-parity/); // positive: T8 actually ran against the sibling registry
  e.cleanup();
  // …and with that sibling registry absent, T8 names exactly <base>/council as where it looked
  const e2 = estate().noSnagRegistry();
  e2.page('a.html').write();
  mkdirSync(join(e2.press, 'tools'), { recursive: true });
  writeFileSync(join(e2.press, 'tools', 'tenants-check.mjs'), src);
  let out2;
  try { out2 = execFileSync('node', [join(e2.press, 'tools', 'tenants-check.mjs')], { env, encoding: 'utf8' }); }
  catch (err) { out2 = String(err.stdout) + String(err.stderr); }
  assert.ok(out2.includes(`snag registry MISSING at ${join(e2.base, 'council', 'instruments', 'snag', 'registry.json')}`), out2);
  e2.cleanup();
  // …and --press <dir> moves the defaults with it: siblings of <dir>, not of the checker's own clone
  const e3 = estate();
  e3.page('k.html').tenant('k.html', { repo: null, tier: 'public', gate: null, vendored: null, release: null }).write();
  let out3;
  try { out3 = execFileSync('node', [CHECKER, '--press', e3.press], { env, encoding: 'utf8' }); }
  catch (err) { out3 = String(err.stdout) + String(err.stderr); }
  assert.ok(out3.includes(`source repos: ${e3.base}`), out3);
  assert.match(out3, /\[PASS\] T8 registry-parity/);
  e3.cleanup();
});

// ---- T1 parent (arc app-lab, 2026-10-14): a pages.json `parent` names a real, same-tier, un-parented page ----
const fam = (e, ...names) => { for (const n of names) e.page(n).tier(n, 'family'); return e; };

test('T1 parent PASS — family page parented under a family page', () => {
  const e = fam(estate(), 'lab.html', 'proto.html').parent('proto.html', 'lab.html').write();
  const r = e.run();
  assert.match(line(r.out, 'T1 parent', 'proto.html'), /PASS.*lab\.html/);
  assert.equal(r.code, 0);
  e.cleanup();
});

test('T1 parent FAIL — parent not in pages.json', () => {
  const e = fam(estate(), 'proto.html').parent('proto.html', 'ghost.html').write();
  const r = e.run();
  assert.match(line(r.out, 'T1 parent', 'proto.html'), /FAIL.*ghost\.html is not in pages\.json/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T1 parent FAIL — parent in a different space tier', () => {
  const e = estate();
  e.page('lab.html').page('proto.html').tier('proto.html', 'family').parent('proto.html', 'lab.html').write(); // lab = public
  const r = e.run();
  assert.match(line(r.out, 'T1 parent', 'proto.html'), /FAIL.*public but proto\.html is family/);
  assert.equal(r.code, 1);
  e.cleanup();
});

test('T1 parent FAIL — nested parent (the parent is itself parented)', () => {
  const e = fam(estate(), 'top.html', 'lab.html', 'proto.html').parent('lab.html', 'top.html').parent('proto.html', 'lab.html').write();
  const r = e.run();
  assert.match(line(r.out, 'T1 parent', 'proto.html'), /FAIL.*itself parented/);
  assert.match(line(r.out, 'T1 parent', 'lab.html'), /PASS/);
  assert.equal(r.code, 1);
  e.cleanup();
});
