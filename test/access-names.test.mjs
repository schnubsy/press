// access.html names family apps the way the marquee does (index.html LABELS owns card naming).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const acc = readFileSync(new URL('../access.html', import.meta.url), 'utf8');
const spaces = JSON.parse(readFileSync(new URL('../spaces.json', import.meta.url), 'utf8'));
test('access.html APP_NAMES match the marquee LABELS titles for every family page', () => {
  const names = JSON.parse(acc.match(/var APP_NAMES = (\{[^}]*\})/)[1].replace(/'/g, '"'));
  for (const page of spaces.family) {
    const m = idx.match(new RegExp("'" + page.replace('.', '\\.') + "':\\s*\\{[^}]*title:'([^']*)'"));
    assert.ok(m, 'LABELS entry for ' + page);
    assert.equal(names[page], m[1], page);
  }
});
