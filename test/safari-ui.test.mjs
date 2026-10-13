// test/safari-ui.test.mjs — arc/safari-ui (2026-10-12) static guards beside the WebKit ui-audit (gauntlet stage 5).
// The audit gates what it can SEE; these pin the source-level contract so a regression is caught without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('the vendored ui-audit pair carries the council stamp (re-vendor the pair together)', () => {
  for (const f of ['test/ui-audit/ui-probe.mjs', 'test/ui-audit/run.mjs']) {
    assert.match(read(f), /^(#!.*\n)?\/\/ council-ui-audit@\d+\.\d+\.\d+ /m, f);
  }
  const ver = (f) => read(f).match(/council-ui-audit@(\d+\.\d+\.\d+)/)[1];
  assert.equal(ver('test/ui-audit/ui-probe.mjs'), ver('test/ui-audit/run.mjs'));
});

test('every press mini control is a real <button> — no clickable <span> the audit cannot gate', () => {
  const idx = read('index.html');
  assert.doesNotMatch(idx, /<span class="tw-mini"/);
  assert.doesNotMatch(idx, /<span[^>]*id="setupLink"/);
  for (const id of ['lockBtn', 'devBtn', 'kitBtn', 'addBtn', 'revBtn', 'kitPrint', 'kitDone', 'famLogout', 'setupLink']) {
    assert.match(idx, new RegExp(`<button type="button" class="[^"]*" id="${id}">`), id);
  }
});

test('no text-entry field under 16px on a press-native page (iOS zoom-on-focus)', () => {
  assert.match(read('index.html'), /\.tw-cinput\{[^}]*font-size:16px/);
  assert.match(read('access.html'), /\.linkrow input\{font-size:16px\}/);
});

test('the shared gates stay byte-identical to press/src — the 44px gate fixes are page-level overrides', () => {
  // src/gate.js + src/family-gate.js are the tenants' vendored modules (tenants-check T3); a tenant-wave arc moves the
  // overrides into them. Until then the overrides live in the pages that show the gates.
  assert.match(read('index.html'), /html #family-gate \.fg-back\{[^}]*min-height:44px/);
  assert.match(read('steward.html'), /html #press-gate \.pg-back\{[^}]*min-height:44px/);
  assert.match(read('steward.html'), /html #press-gate \.pg-btn\{min-height:44px/);
});
