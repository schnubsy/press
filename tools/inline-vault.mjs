// tools/inline-vault.mjs — inject src/vault.js verbatim into index.html at the
// @@VAULT_INLINE@@ marker, keeping ONE source of truth. The site has no build step;
// this runs by hand (or in a check) whenever src/vault.js changes.
//   node tools/inline-vault.mjs           # write
//   node tools/inline-vault.mjs --check   # exit 1 if index.html is out of sync
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const vault = readFileSync(join(ROOT, 'src', 'vault.js'), 'utf8').replace(/\s+$/, '');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

const BEGIN = '<!-- @@VAULT_INLINE@@ -->';
const END = '<!-- @@/VAULT_INLINE@@ -->';
const block = `${BEGIN}\n<script>\n/* eslint-disable */\n${vault}\n</script>\n${END}`;

let out;
const re = new RegExp(BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
if (re.test(html)) out = html.replace(re, block);
else if (html.includes(BEGIN)) out = html.replace(BEGIN, block);   // first run: only the begin marker present
else { console.error('inline-vault: no @@VAULT_INLINE@@ marker in index.html'); process.exit(2); }

if (process.argv.includes('--check')) {
  if (out !== html) { console.error('inline-vault: index.html is OUT OF SYNC with src/vault.js — run: node tools/inline-vault.mjs'); process.exit(1); }
  console.log('inline-vault: index.html is in sync with src/vault.js'); process.exit(0);
}
writeFileSync(join(ROOT, 'index.html'), out);
console.log('inline-vault: injected src/vault.js into index.html (' + vault.length + ' bytes)');
