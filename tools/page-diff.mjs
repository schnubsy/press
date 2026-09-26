#!/usr/bin/env node
// tools/page-diff.mjs — the snag train's visual gate: render a BUILT page and its LIVE URL at two
// viewports, pixel-diff them, and fail above a threshold (council skills/hand/references/snag.md → TRAIN).
//
//   node tools/page-diff.mjs <built.html> <live-url> [--threshold 2] [--evidence <dir>] [--wait <ms>]
//   npm run page:diff -- halvsies.html https://schnubsy.github.io/press/halvsies.html --evidence /tmp/diff
//
// Viewports: desktop 1280×800 and mobile 390×844, full-page. The built file is served from its own
// directory over a throwaway 127.0.0.1 server (so relative fetches like pages.json resolve as on Pages).
// Both renders run with reduced motion and animations/transitions/caret disabled; heights that differ are
// padded (white) to the larger size, so a height change counts as diff. Prints % diff per viewport and
// writes <name>-<viewport>-{built,live,diff}.png into --evidence (default: the OS temp dir).
//
// Exit: 0 = every viewport ≤ threshold · 2 = any viewport above threshold · 1 = usage / render error.
// Dev-only (Playwright + pixelmatch + pngjs are devDependencies); the site itself keeps no build step.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, basename, join, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
];
const FREEZE_CSS = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function argVal(argv, f, d) { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; }

// Pad a PNG to w×h with opaque white.
export function padTo(png, w, h) {
  if (png.width === w && png.height === h) return png;
  const out = new PNG({ width: w, height: h });
  out.data.fill(255);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

// Diff two PNG buffers → { pct, diffPixels, total, diff: PNG }.
export function diffPngs(aBuf, bBuf) {
  let a = PNG.sync.read(aBuf), b = PNG.sync.read(bBuf);
  const w = Math.max(a.width, b.width), h = Math.max(a.height, b.height);
  a = padTo(a, w, h); b = padTo(b, w, h);
  const diff = new PNG({ width: w, height: h });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, w, h, { threshold: 0.1 });
  const total = w * h;
  return { pct: total ? (diffPixels / total) * 100 : 0, diffPixels, total, diff };
}

function serveDir(dir) {
  return new Promise((ok) => {
    const srv = createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '');
      const p = resolve(dir, rel || 'index.html');
      if (!p.startsWith(resolve(dir)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
      res.end(readFileSync(p));
    });
    srv.listen(0, '127.0.0.1', () => ok(srv));
  });
}

async function shoot(browser, url, vp, waitMs) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  await page.addStyleTag({ content: FREEZE_CSS });
  if (waitMs) await page.waitForTimeout(waitMs);
  const buf = await page.screenshot({ fullPage: true });
  await ctx.close();
  return buf;
}

export async function main(argv = process.argv.slice(2)) {
  const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
  const [built, live] = pos;
  if (!built || !live) { console.error('usage: node tools/page-diff.mjs <built.html> <live-url> [--threshold 2] [--evidence <dir>] [--wait <ms>]'); return 1; }
  const builtPath = resolve(built);
  if (!existsSync(builtPath)) { console.error('page-diff: built file not found: ' + builtPath); return 1; }
  const threshold = Number(argVal(argv, '--threshold', '2'));
  const evidence = resolve(argVal(argv, '--evidence', join(tmpdir(), 'page-diff')));
  const waitMs = Number(argVal(argv, '--wait', '500'));
  mkdirSync(evidence, { recursive: true });
  const stem = basename(builtPath).replace(/\.html$/, '');

  const srv = await serveDir(dirname(builtPath));
  const builtUrl = `http://127.0.0.1:${srv.address().port}/${encodeURIComponent(basename(builtPath))}`;
  let browser = null;
  let worst = 0;
  try {
    browser = await chromium.launch();
    console.log(`page-diff — built ${builtPath}\n            live  ${live}\n            threshold ${threshold}% · evidence ${evidence}`);
    for (const vp of VIEWPORTS) {
      const a = await shoot(browser, builtUrl, vp, waitMs);
      const b = await shoot(browser, live, vp, waitMs);
      const r = diffPngs(a, b);
      writeFileSync(join(evidence, `${stem}-${vp.name}-built.png`), a);
      writeFileSync(join(evidence, `${stem}-${vp.name}-live.png`), b);
      writeFileSync(join(evidence, `${stem}-${vp.name}-diff.png`), PNG.sync.write(r.diff));
      worst = Math.max(worst, r.pct);
      const verdict = r.pct > threshold ? 'ABOVE' : 'ok';
      console.log(`  ${vp.name.padEnd(8)} ${vp.width}×${vp.height}  ${r.pct.toFixed(3)}%  (${r.diffPixels}/${r.total} px)  ${verdict}`);
    }
  } catch (e) {
    console.error('page-diff: render failed — ' + String(e.message).split('\n')[0]);
    return 1;
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  const over = worst > threshold;
  console.log(`page-diff: ${over ? 'FAIL' : 'PASS'} — worst ${worst.toFixed(3)}% vs threshold ${threshold}%`);
  return over ? 2 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().then((c) => process.exit(c));
}
