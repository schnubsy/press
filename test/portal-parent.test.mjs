// test/portal-parent.test.mjs — arc app-lab (2026-10-14): a pages.json entry with `parent` gets NO portal card.
// Loads the REAL cardFiles() out of index.html and pins every card-list call site to it (public lobby, both wing
// doors' counts, the private wing, the family wing). The Playwright twin is test/card-labels.spec.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const pages = JSON.parse(readFileSync(new URL('../pages.json', import.meta.url), 'utf8'));
const spaces = JSON.parse(readFileSync(new URL('../spaces.json', import.meta.url), 'utf8'));
const src = idx.match(/function cardFiles\(files, man\)\{[^\n]*\}/);
const cardFiles = new Function(src[0] + '; return cardFiles;')();

test('a parented family page gets no card; non-parented family pages still do', () => {
  const man = { 'remit.html': { title: 'Remit' }, 'app-lab.html': { title: 'App Lab' }, 'optimo.html': { title: 'optimo', parent: 'app-lab.html' } };
  assert.deepEqual(cardFiles(['remit.html', 'optimo.html', 'app-lab.html'], man), ['remit.html', 'app-lab.html']);
  // no manifest (outage) or an entry without `parent` = every page keeps its card
  assert.deepEqual(cardFiles(['optimo.html', 'remit.html'], null), ['optimo.html', 'remit.html']);
  assert.deepEqual(cardFiles(['x.html'], { 'x.html': { title: 'x' } }), ['x.html']);
});

test('the real registries: optimo.html has no card but keeps its family tier; App Lab is carded', () => {
  assert.equal(pages['optimo.html'].parent, 'app-lab.html');
  assert.ok(spaces.family.includes('optimo.html'), 'optimo.html stays in spaces.json family (gate + grant key unchanged)');
  const fam = cardFiles(spaces.family, pages);
  assert.ok(!fam.includes('optimo.html'));
  assert.ok(fam.includes('app-lab.html'));
  for (const f of spaces.family) if (!pages[f].parent) assert.ok(fam.includes(f), f);
});

test('every portal card list goes through cardFiles (lobby, wing-door counts, private wing, family wing)', () => {
  assert.match(idx, /const pub = cardFiles\(files, man\)/);
  assert.match(idx, /function secureCardHTML\(man\)\{\n\s*const st = vaultState\(\), n = cardFiles\(SPACES\.personal\|\|\[\], man\)\.length;/);
  assert.match(idx, /function familyCardHTML\(man\)\{\n\s*const n = cardFiles\(SPACES\.family\|\|\[\], man\)\.length;/);
  assert.match(idx, /wingOrdered\(cardFiles\(\[\.\.\.new Set\(\(SPACES\.personal\|\|\[\]\)\.map\(linkFile\)\)\], man\), 'personal'\)/);
  assert.match(idx, /const fam=wingOrdered\(cardFiles\(SPACES\.family\|\|\[\], man\), 'family'\);/);
});
