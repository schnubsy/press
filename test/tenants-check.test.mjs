// test/tenants-check.test.mjs — unit tests for tools/tenants-check.mjs (node:test, no deps).
// Each test scaffolds a throwaway estate (a fake press root + fake source repos) under the OS temp
// dir and runs the REAL checker against it via --press + CODE_ROOT, asserting exit code + output.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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

function estate() {
  const base = mkdtempSync(join(tmpdir(), 'tenants-check-'));
  const press = join(base, 'press');
  const vscode = join(base, 'vscode');
  mkdirSync(join(press, 'src'), { recursive: true });
  mkdirSync(vscode, { recursive: true });
  writeFileSync(join(press, 'src', 'gate.js'), GATE);
  const reg = { pages: {}, spaces: { v: 2, personal: [], family: [] }, tenants: {} };
  return {
    base, press, vscode,
    page(name, content = '<html>' + name + '</html>') { writeFileSync(join(press, name), content); reg.pages[name] = { title: name }; return this; },
    tier(name, t) { if (t === 'personal') reg.spaces.personal.push(name); else if (t === 'family') reg.spaces.family.push(name); return this; },
    tenant(name, entry) { reg.tenants[name] = entry; return this; },
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
      writeFileSync(join(press, 'tenants.json'), JSON.stringify({ v: 1, tenants: reg.tenants }, null, 2));
      return this;
    },
    run(args = []) {
      try { const out = execFileSync('node', [CHECKER, '--press', this.press, ...args], { env: { ...process.env, CODE_ROOT: this.vscode }, encoding: 'utf8' }); return { code: 0, out }; }
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
function writeIndex(press, cfgApps) {
  const entries = cfgApps.map((a) => `  '${a}': { label:'${a}', kind:'app' }`).join(',\n');
  writeFileSync(join(press, 'index.html'),
    `<html><body><script>\nconst TOOL_CFG = {\n${entries}${cfgApps.length ? ',' : ''}\n};\n</script></body></html>`);
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
