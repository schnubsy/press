// test/page-diff.test.mjs — the pure diff math behind tools/page-diff.mjs (node:test; no browser).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { diffPngs, padTo, VIEWPORTS } from '../tools/page-diff.mjs';

function png(w, h, rgb = [255, 255, 255], paint) {
  const p = new PNG({ width: w, height: h });
  for (let i = 0; i < w * h; i++) { p.data[i * 4] = rgb[0]; p.data[i * 4 + 1] = rgb[1]; p.data[i * 4 + 2] = rgb[2]; p.data[i * 4 + 3] = 255; }
  if (paint) paint(p);
  return PNG.sync.write(p);
}

test('viewports are the train gate pair: 1280×800 + 390×844', () => {
  assert.deepEqual(VIEWPORTS.map((v) => [v.width, v.height]), [[1280, 800], [390, 844]]);
});

test('identical renders diff 0%', () => {
  const a = png(40, 30);
  const r = diffPngs(a, a);
  assert.equal(r.diffPixels, 0);
  assert.equal(r.pct, 0);
});

test('a painted block is counted as its share of pixels', () => {
  const a = png(100, 100);
  const b = png(100, 100, [255, 255, 255], (p) => { for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const i = (y * 100 + x) * 4; p.data[i] = 200; p.data[i + 1] = 0; p.data[i + 2] = 0; } });
  const r = diffPngs(a, b);
  assert.equal(r.diffPixels, 100);
  assert.equal(r.pct, 1);
});

test('a height change counts: the shorter render is padded white, the extra dark rows differ', () => {
  const a = png(50, 100, [0, 0, 0]);
  const b = png(50, 80, [0, 0, 0]);
  const r = diffPngs(a, b);
  assert.equal(r.total, 50 * 100);
  assert.equal(r.diffPixels, 50 * 20);
  assert.equal(padTo(PNG.sync.read(b), 50, 100).height, 100);
});
