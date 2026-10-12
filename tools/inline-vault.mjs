// tools/inline-vault.mjs — keep ONE source of truth for the vault crypto core.
// src/vault.js is injected VERBATIM into two carriers:
//   1. index.html  — at the HTML <!-- @@VAULT_INLINE@@ --> marker (wrapped in <script>)
//   2. src/gate.js — at the JS  // @@VAULT_INLINE@@ marker (raw, gate.js is already JS)
// The site has no build step; this runs by hand (or in a check) whenever src/vault.js changes.
//   node tools/inline-vault.mjs           # write both carriers
//   node tools/inline-vault.mjs --check   # exit 1 if EITHER carrier is out of sync
//
// The --check is the guard the plan/HANDOFF rely on: the crypto core must be
// character-for-character identical across src/vault.js, index.html and src/gate.js.
//
// SECOND SOURCE (arc/marquee-wings-monitor slice 2): src/family-gate.js is inlined VERBATIM into the
// two press-native pages that boot it without a <script src> — index.html (the Family-Wing door) and
// perth.html (a family tenant with no source repo). Those blocks have no markers (they predate this
// guard); each is located by its own header line ` * press family-gate.js` through the module's closing
// `})(typeof globalThis !== 'undefined' ? globalThis : this);`. Same write / --check contract.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const vault = readFileSync(join(ROOT, 'src', 'vault.js'), 'utf8').replace(/\s+$/, '');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// One carrier = a file with a BEGIN/END marker pair; `block(vault)` builds the
// replacement, `first` is the first-run fallback when only BEGIN is present.
const carriers = [
  {
    label: 'index.html',
    path: join(ROOT, 'index.html'),
    begin: '<!-- @@VAULT_INLINE@@ -->',
    end: '<!-- @@/VAULT_INLINE@@ -->',
    block: (v, c) => `${c.begin}\n<script>\n/* eslint-disable */\n${v}\n</script>\n${c.end}`,
  },
  {
    label: 'src/gate.js',
    path: join(ROOT, 'src', 'gate.js'),
    begin: '// @@VAULT_INLINE@@',
    end: '// @@/VAULT_INLINE@@',
    block: (v, c) => `${c.begin}\n// (injected verbatim from src/vault.js by tools/inline-vault.mjs — do not edit between the markers)\n${v}\n${c.end}`,
  },
];

const check = process.argv.includes('--check');
let failed = false;

for (const c of carriers) {
  const src = readFileSync(c.path, 'utf8');
  const want = c.block(vault, c);
  const re = new RegExp(esc(c.begin) + '[\\s\\S]*?' + esc(c.end));
  let out;
  if (re.test(src)) out = src.replace(re, want);
  else if (src.includes(c.begin)) out = src.replace(c.begin, want); // first run: only BEGIN present
  else { console.error(`inline-vault: no @@VAULT_INLINE@@ marker in ${c.label}`); process.exit(2); }

  if (check) {
    if (out !== src) { console.error(`inline-vault: ${c.label} is OUT OF SYNC with src/vault.js — run: node tools/inline-vault.mjs`); failed = true; }
    else console.log(`inline-vault: ${c.label} is in sync with src/vault.js`);
  } else {
    writeFileSync(c.path, out);
    console.log(`inline-vault: injected src/vault.js into ${c.label} (${vault.length} bytes)`);
  }
}

// ── family-gate carriers ─────────────────────────────────────────────────────
const fgate = readFileSync(join(ROOT, 'src', 'family-gate.js'), 'utf8').replace(/\s+$/, '');
const FG_BLOCK_RE = /\/\* =+\n \* press family-gate\.js[\s\S]*?\}\)\(typeof globalThis !== 'undefined' \? globalThis : this\);/;
for (const label of ['index.html', 'perth.html']) {
  const path = join(ROOT, label);
  const src = readFileSync(path, 'utf8');
  if (!FG_BLOCK_RE.test(src)) { console.error(`inline-family-gate: no inlined family-gate block in ${label}`); process.exit(2); }
  const out = src.replace(FG_BLOCK_RE, () => fgate);
  if (check) {
    if (out !== src) { console.error(`inline-family-gate: ${label} is OUT OF SYNC with src/family-gate.js — run: node tools/inline-vault.mjs`); failed = true; }
    else console.log(`inline-family-gate: ${label} is in sync with src/family-gate.js`);
  } else {
    writeFileSync(path, out);
    console.log(`inline-family-gate: injected src/family-gate.js into ${label} (${fgate.length} bytes)`);
  }
}

process.exit(check && failed ? 1 : 0);
