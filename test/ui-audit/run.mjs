#!/usr/bin/env node
// council-ui-audit@1.1.0 — instruments/ui-audit/run.mjs (canonical; projects vendor a stamped copy)
//
// The iPhone UI audit runner: every state in the project's config × widths 320/375/390/393/430 × dark + light,
// on WebKit (the iPhone engine of record), running the six gated checks of ui-probe.mjs on each surface.
//
//   node test/ui-audit/run.mjs test/ui-audit.config.mjs [--engine webkit|chromium] [--evidence <stem>]
//
// Exit codes (the gauntlet reads them):
//   0  GREEN    WebKit, every state driven, zero defects
//   1  RED      any defect, or a state the driver could not reach (an undriven state is never green)
//   2  PARTIAL  zero defects but NOT on WebKit (WebKit missing → labelled Chromium fallback, reason deps|egress|other) — not Safari-equivalent
//
// The config module default-exports:
//   { name, url: string | ({ width, scheme }) => string,      // the BUILT page (file:// or the preview URL)
//     states: [{ name, run: async (page) => {} }],           // each starts from a fresh load; '(initial)' is implicit
//     probe: { surfaces, main, extraRoots, clipOk, wrapOk, hscrollOk, touchOk, oneLine },  // ui-probe.mjs cfg
//     exceptions: ['<selector> — why it is designed that way', …],   // named in the evidence, never silent
//     setup: async (page, { width, scheme }) => {},          // optional: seed storage / stub network before load
//     widths: [...], schemes: [...], concurrency: 4 }        // optional overrides (standard: all five × both)
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { uiProbe } from './ui-probe.mjs';

export const WIDTHS = [320, 375, 390, 393, 430];
export const HEIGHTS = { 320: 568, 375: 812, 390: 844, 393: 852, 430: 932 };
export const SCHEMES = ['dark', 'light'];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

// Why WebKit would not launch — the REAL cause, never a default (arc/webkit-with-deps, 2026-10-22): the 2026-10-21 press
// run downloaded WebKit fine and then failed on missing Linux system libraries, but the old message blamed egress.
//   deps    the launch names missing shared libraries ("Host system is missing dependencies", "lib….so")
//   egress  the download / executable is absent ("Executable doesn't exist", "Looks like Playwright … just installed")
//           or the network refused it (connect_rejected, ENOTFOUND, 403/407)
//   other   anything else — the first line of the error is printed as-is
export function classifyWebkitFailure(message) {
  const m = String(message || '');
  if (/missing dependencies|missing libraries|lib[\w.+-]+\.so(?:\.\d+)*\b|install-deps|--with-deps/i.test(m)) {
    return { reason: 'deps', fix: 'missing system libraries — run `npx playwright install --with-deps webkit` (Linux: installs them via apt)' };
  }
  if (/Executable doesn't exist|browserType\.launch: .*not found|just installed or updated|connect_rejected|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|\b40[37]\b|egress|download/i.test(m)) {
    return { reason: 'egress', fix: 'WebKit not downloaded — run `npx playwright install --with-deps webkit`; if the download is refused, add cdn.playwright.dev + playwright.download.prss.microsoft.com to the egress allowlist' };
  }
  return { reason: 'other', fix: 'WebKit failed to launch — see the error; `npx playwright install --with-deps webkit` is the standard install' };
}

// WebKit first. Chromium only when asked or when WebKit cannot launch — and then the verdict is PARTIAL (reason named).
export async function launch(pw, want = 'webkit') {
  if (want === 'webkit') {
    try { return { browser: await pw.webkit.launch(), engine: 'webkit', fallback: null, reason: null }; }
    catch (e) {
      const msg = String(e && e.message || e);
      const why = msg.split('\n')[0].slice(0, 160);
      const { reason, fix } = classifyWebkitFailure(msg);
      const browser = await pw.chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
      return { browser, engine: 'chromium', reason, fallback: `WebKit unavailable [${reason}] (${why}) — ${fix}` };
    }
  }
  return { browser: await pw.chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), engine: 'chromium', reason: 'requested', fallback: 'Chromium requested (--engine chromium)' };
}

export function verdict({ engine, defects, undriven }) {
  if (defects > 0 || undriven > 0) return { label: 'RED', code: 1 };
  if (engine !== 'webkit') return { label: 'PARTIAL', code: 2 };
  return { label: 'GREEN', code: 0 };
}

export async function runUiAudit(cfg, { pw, engine: want = 'webkit' } = {}) {
  const widths = cfg.widths || WIDTHS, schemes = cfg.schemes || SCHEMES;
  const states = [{ name: '(initial)', run: async () => {} }, ...(cfg.states || [])];
  const { browser, engine, fallback, reason } = await launch(pw, want);
  const results = [];
  let defects = 0, undriven = 0;
  // one context per width × scheme, run CONCURRENTLY (states stay sequential inside a context); row order kept
  const combos = schemes.flatMap((scheme) => widths.map((width) => ({ scheme, width })));
  const CONC = Math.max(1, Number(cfg.concurrency) || 4);
  const perCombo = new Array(combos.length);
  async function runCombo(i) {
    const { scheme, width } = combos[i];
    const ctx = await browser.newContext({
      viewport: { width, height: HEIGHTS[width] || 844 }, deviceScaleFactor: 3, hasTouch: true,
      isMobile: engine !== 'firefox', userAgent: IPHONE_UA, colorScheme: scheme,
    });
    const rows = [];
    try {
      for (const st of states) {
        const page = await ctx.newPage();
        const row = { scheme, width, state: st.name };
        try {
          if (cfg.setup) await cfg.setup(page, { width, scheme });
          const url = typeof cfg.url === 'function' ? cfg.url({ width, scheme }) : cfg.url;
          await page.goto(url, { waitUntil: 'load' });
          await st.run(page, { width, scheme });
          await page.waitForTimeout(80);
          const r = await page.evaluate(uiProbe, cfg.probe || {});
          row.surface = r.surface; row.defects = r.defects;
        } catch (e) {
          row.error = String(e && e.message || e).split('\n')[0].slice(0, 200);
        }
        rows.push(row);
        await page.close();
      }
    } finally { await ctx.close(); }
    perCombo[i] = rows;
  }
  try {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(CONC, combos.length) }, async () => {
      while (next < combos.length) await runCombo(next++);
    }));
    for (const rows of perCombo) for (const row of rows) {
      results.push(row);
      if (row.error) undriven++; else defects += row.defects.length;
    }
  } finally { await browser.close(); }
  const v = verdict({ engine, defects, undriven });
  return { name: cfg.name || 'ui-audit', engine, fallback, reason, widths, schemes, states: states.map((s) => s.name),
    exceptions: cfg.exceptions || [], defects, undriven, verdict: v.label, code: v.code, results };
}

// ≤30-line summary (testing.md: the orchestrator reads only this; the JSON goes to docs/evidence/).
export function summary(rep) {
  const out = [];
  out.push(`ui-audit ${rep.name} · ${rep.engine}${rep.fallback ? ' (FALLBACK: ' + rep.fallback + ')' : ''}`);
  out.push(`matrix: ${rep.states.length} states × ${rep.widths.join('/')} × ${rep.schemes.join('+')} = ${rep.results.length} surfaces`);
  const by = {};
  for (const r of rep.results) for (const d of r.defects || []) (by[d.check] = by[d.check] || []).push(`${r.state}@${r.width}/${r.scheme}: ${d.el} — ${d.detail}`);
  for (const c of ['overflow', 'clip', 'wrap', 'touch', 'safearea', 'font16']) {
    const n = (by[c] || []).length;
    out.push(`${n ? '✗' : '🟢'} ${c.padEnd(8)} ${n}${n ? '  e.g. ' + by[c][0].slice(0, 110) : ''}`);
  }
  for (const r of rep.results.filter((x) => x.error).slice(0, 6)) out.push(`✗ undriven ${r.state}@${r.width}/${r.scheme}: ${r.error.slice(0, 100)}`);
  out.push(`designed exceptions: ${rep.exceptions.length ? rep.exceptions.length + ' named in the evidence' : 'none'}`);
  out.push(`VERDICT: ${rep.verdict}${rep.verdict === 'PARTIAL' ? ` (${rep.reason || 'other'}) — not Safari-equivalent; the WebKit run is the gate` : ''}`);
  return out.slice(0, 30).join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const val = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const pos = a.filter((x, i) => !x.startsWith('--') && !(i > 0 && ['--engine', '--evidence'].includes(a[i - 1])));
  const cfgPath = pos[0];
  if (!cfgPath) { console.error('usage: node run.mjs <ui-audit.config.mjs> [--engine webkit|chromium] [--evidence <stem>]'); process.exit(64); }
  let pw;
  try { pw = await import('playwright'); } catch { console.error('ui-audit: playwright is not installed (npm i -D playwright)'); process.exit(1); }
  pw = pw.default || pw;
  const cfg = (await import(pathToFileURL(resolve(cfgPath)).href)).default;
  const rep = await runUiAudit(cfg, { pw, engine: val('--engine') || 'webkit' });
  const stem = val('--evidence') || 'docs/evidence/ui-audit';
  mkdirSync(dirname(resolve(stem)), { recursive: true });
  writeFileSync(resolve(stem + '.json'), JSON.stringify(rep, null, 2) + '\n');
  const s = summary(rep);
  writeFileSync(resolve(stem + '.txt'), s + '\n\nexceptions:\n' + rep.exceptions.map((x) => '- ' + x).join('\n') + '\n');
  console.log(s);
  process.exit(rep.code);
}
