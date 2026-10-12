// council-ui-audit@1.0.0 — instruments/ui-audit/ui-probe.mjs (canonical; projects vendor a stamped copy)
//
// The browser-side probe of the iPhone UI audit. `uiProbe(cfg)` runs INSIDE the page (Playwright
// `page.evaluate(uiProbe, cfg)`) — it is serialised, so it must stay self-contained: no imports, no
// closures over module scope. It returns the defect list for the currently active surface.
//
// Six GATED checks (testing.md → "Web" → iPhone UI audit):
//   overflow   zero horizontal page overflow; no control cut off sideways by the viewport or a clipping ancestor
//   clip       zero clipped / ellipsised control or label text (scrollWidth > clientWidth; select + placeholder measured)
//   wrap       no single-line control label (button, tab, chip, nav link, …) wrapping onto a 2nd line
//   touch      every tap target ≥ 44×44 CSS px (checkbox/radio → its label; inline links in running text exempt)
//   safearea   every fixed/sticky element anchored to the top/bottom edge pads for env(safe-area-inset-*)
//   font16     every text-entry input / select / textarea ≥ 16px (no iOS zoom-on-focus)
//
// Generalised from giving-tracker test/mobile/ui-audit.js (2026-10-12). Project specifics come in `cfg`:
//   cfg.surfaces    overlay selectors, topmost-wins order (default: open dialogs / sheets / modals)
//   cfg.main        the base surface when no overlay is open — first visible match in listed order (default 'body')
//   cfg.extraRoots  transient layers audited alongside the surface (toasts), e.g. '#toast.show'
//   cfg.clipOk      DESIGNED EXCEPTIONS — selector list never clip/overflow-checked (named in the evidence, never silent)
//   cfg.wrapOk      DESIGNED EXCEPTIONS — copy that is MEANT to wrap
//   cfg.hscrollOk   containers designed to scroll sideways (their children are not "cut off")
//   cfg.touchOk     DESIGNED EXCEPTIONS — tap targets gated some other way (say how in the evidence)
//   cfg.oneLine     extra single-line selectors, appended to the default control set
export function uiProbe(cfg) {
  cfg = cfg || {};
  const W = window.innerWidth, H = window.innerHeight;
  const defects = [];
  const NONE = '#__ui_audit_none__';
  const sel = (s) => (s && String(s).trim()) || NONE;
  const CLIP_OK = sel(cfg.clipOk), WRAP_OK = sel(cfg.wrapOk), HSCROLL_OK = sel(cfg.hscrollOk), TOUCH_OK = sel(cfg.touchOk);
  function d(check, el, detail) { defects.push({ check: check, el: desc(el), detail: detail }); }
  function desc(el) {
    if (!el || !el.tagName) return String(el);
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = (el.className && el.className.baseVal == null ? String(el.className) : '').trim();
    if (cls) s += '.' + cls.split(/\s+/).slice(0, 2).join('.');
    if (el === document.documentElement || el === document.body) return s;   // no page-wide text dump
    const t = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.value || '').replace(/\s+/g, ' ').trim();
    if (t) s += ' "' + t.slice(0, 32) + '"';
    return s;
  }
  function vis(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility) return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) return false;
    return el.offsetParent !== null || cs.position === 'fixed';
  }
  const within = (el, s) => !!(el.closest && el.closest(s));

  // ---- the active surface: the topmost open overlay, else the main surface ----
  const SURFACES = cfg.surfaces || 'dialog[open], [role="dialog"]:not([hidden]), [aria-modal="true"]:not([hidden]), .sheet:not([hidden]), .modal:not([hidden])';
  let scope = null;
  const overlays = Array.from(document.querySelectorAll(SURFACES)).filter(vis);
  if (overlays.length) scope = overlays[overlays.length - 1];
  // base surface: the first VISIBLE match of cfg.main in the order listed (not document order); default body, so
  // fixed headers / bottom bars outside <main> are audited too
  if (!scope) scope = String(cfg.main || 'body').split(',').map((x) => document.querySelector(x.trim())).find(vis) || document.body;
  const roots = [scope];
  if (cfg.extraRoots) document.querySelectorAll(cfg.extraRoots).forEach((r) => { if (vis(r) && !scope.contains(r)) roots.push(r); });
  function all(s) {
    const out = [];
    roots.forEach((r) => {
      if (r.matches && r.matches(s)) out.push(r);
      r.querySelectorAll(s).forEach((e) => out.push(e));
    });
    return out.filter(vis);
  }

  // (1) overflow ---------------------------------------------------------------
  const se = document.scrollingElement || document.documentElement;
  if (se.scrollWidth > W + 1) d('overflow', document.documentElement, 'page scrollWidth ' + se.scrollWidth + ' > ' + W);
  if (scope !== document.body && scope.scrollWidth > scope.clientWidth + 1 && getComputedStyle(scope).position === 'fixed')
    d('overflow', scope, 'surface scrollWidth ' + scope.scrollWidth + ' > clientWidth ' + scope.clientWidth);
  function hClip(el) {
    const r = el.getBoundingClientRect();
    let left = Math.max(r.left, 0), right = Math.min(r.right, W);
    let p = el.parentElement;
    while (p && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX !== 'visible' && cs.overflowX !== '') {
        if (p.matches(HSCROLL_OK)) return null;
        const pr = p.getBoundingClientRect();
        left = Math.max(left, pr.left); right = Math.min(right, pr.right);
      }
      p = p.parentElement;
    }
    const visW = right - left;
    return visW < r.width - 1.5 ? { full: Math.round(r.width), shown: Math.max(0, Math.round(visW)) } : null;
  }
  const CTRL = 'button, a[href], select, input:not([type=hidden]), textarea, [role="tab"], [role="option"], [role="button"], [role="menuitem"], .chip, .badge, .pill, label';
  all(CTRL).forEach((el) => {
    if (within(el, CLIP_OK) || el.matches('input[type=file]')) return;
    const c = hClip(el);
    if (c) d('overflow', el, 'cut off sideways: ' + c.shown + ' of ' + c.full + 'px visible');
  });

  // (2) clipped / ellipsised text ------------------------------------------------
  const canvas = document.createElement('canvas').getContext('2d');
  function textW(str, cs) { canvas.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; return canvas.measureText(str).width; }
  function hasOwnText(el) { for (let n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true; return false; }
  all('*').forEach((el) => {
    if (within(el, CLIP_OK) || el.closest('svg')) return;          // SVG labels are drawn, not laid out
    const tag = el.tagName, cs = getComputedStyle(el);
    if (tag === 'SELECT') {
      const o = el.options[el.selectedIndex];
      if (!o) return;
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 14;
      const tw = textW(o.text, cs);
      if (tw > avail + 1) d('clip', el, 'selected option "' + o.text.slice(0, 30) + '" needs ' + Math.round(tw) + 'px, has ' + Math.round(avail));
      return;
    }
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      if (['checkbox', 'radio', 'file', 'hidden', 'range', 'color', 'date', 'datetime-local', 'month', 'time', 'week'].indexOf(type) >= 0) return;
      // a typed VALUE scrolls inside its field (user data); the static placeholder copy must fit
      const str = (!el.value && tag === 'INPUT') ? (el.getAttribute('placeholder') || '') : '';
      if (!str) return;
      const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const tw = textW(str, cs);
      if (tw > avail + 1) d('clip', el, 'placeholder "' + str.slice(0, 34) + '" needs ' + Math.round(tw) + 'px, has ' + Math.round(avail));
      return;
    }
    if (cs.display === 'inline' || cs.display === 'contents') return;
    if (!hasOwnText(el) && !el.matches('button, [role="tab"], [role="button"], label, .chip, .badge, .pill')) return;
    if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      const how = cs.textOverflow === 'ellipsis' ? 'ellipsised' : (cs.overflowX === 'visible' ? 'spills out' : 'clipped');
      d('clip', el, 'text ' + how + ': content ' + el.scrollWidth + 'px in a ' + el.clientWidth + 'px box');
    }
  });

  // (3) unexpected wrap on single-line controls ----------------------------------
  const ONE_LINE = 'button, [role="tab"], [role="button"], [role="menuitem"], .btn, .chip, .badge, .pill, .tab, nav a' +
    (cfg.oneLine ? ', ' + cfg.oneLine : '');
  function lines(node) {
    const rg = document.createRange(); rg.selectNodeContents(node);
    const tops = [];
    Array.from(rg.getClientRects()).forEach((r) => {
      if (r.width < 1) return;
      if (!tops.some((t) => Math.abs(t - r.top) < r.height * 0.5)) tops.push(r.top);
    });
    return tops.length;
  }
  const seenText = new Set();
  all(ONE_LINE).forEach((el) => {
    if (within(el, CLIP_OK)) return;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.nodeValue.trim() || seenText.has(n)) continue;
      seenText.add(n);
      const p = n.parentElement;
      if (!p || !vis(p) || p.closest(WRAP_OK)) continue;
      const k = lines(n);
      if (k > 1) d('wrap', p, '"' + n.nodeValue.trim().slice(0, 34) + '" wraps onto ' + k + ' lines');
    }
  });

  // (4) touch targets ≥ 44×44 -----------------------------------------------------
  const TAP = 'button, a[href], select, input, textarea, [role="tab"], [role="option"], [role="button"], [role="menuitem"], [tabindex]:not([tabindex="-1"])';
  const seenTap = new Set();
  all(TAP).forEach((el) => {
    if (el.matches('input[type=hidden], input[type=file]') || within(el, TOUCH_OK)) return;
    // WCAG 2.5.8 inline exception: a link inside a sentence is sized by the line, not a control
    if (el.matches('a[href]') && getComputedStyle(el).display === 'inline' && el.closest('p, li, td, dd, blockquote')) return;
    let t = el;
    if (el.matches('input[type=checkbox], input[type=radio]')) t = el.closest('label') || (el.id && document.querySelector('label[for="' + el.id + '"]')) || el;
    if (seenTap.has(t)) return; seenTap.add(t);
    const r = t.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) d('touch', t, Math.round(r.width) + '×' + Math.round(r.height));
  });

  // (5) safe-area ----------------------------------------------------------------
  const safe = { top: [], bottom: [] };
  function scanRules(rules) {
    Array.from(rules || []).forEach((r) => {
      if (r.cssRules && r.media) { if (window.matchMedia(r.media.mediaText).matches) scanRules(r.cssRules); return; }
      if (r.cssRules && !r.selectorText) { scanRules(r.cssRules); return; }
      if (!r.selectorText || !r.style) return;
      const txt = r.style.cssText;
      if (/safe-area-inset-top/.test(txt)) safe.top.push(r.selectorText);
      if (/safe-area-inset-bottom/.test(txt)) safe.bottom.push(r.selectorText);
    });
  }
  Array.from(document.styleSheets).forEach((s) => { try { scanRules(s.cssRules); } catch (e) { /* cross-origin sheet */ } });
  function hasSafe(el, edge) {
    if (el.style && new RegExp('safe-area-inset-' + edge).test(el.style.cssText)) return true;
    return safe[edge].some((s) => { try { return el.matches(s); } catch (e) { return false; } });
  }
  all('*').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
    const r = el.getBoundingClientRect();
    if (r.width >= W - 1 && r.height >= H - 1) return;           // a full-bleed container (sheet / backdrop)
    // anchored = the RENDERED box touches that edge (a centred modal has computed top/bottom:0 but floats mid-screen;
    // a box touching BOTH edges is a sheet, not a bar)
    const topV = parseFloat(cs.top), botV = parseFloat(cs.bottom);
    if (!isNaN(topV) && topV < 47 && r.top < 34 && (cs.position === 'sticky' || r.bottom < H - 34) && !hasSafe(el, 'top')) d('safearea', el, cs.position + ' top:' + cs.top + ' with no safe-area-inset-top');
    if (!isNaN(botV) && botV < 34 && cs.position === 'fixed' && r.bottom > H - 34 && r.top > 34 && !hasSafe(el, 'bottom')) d('safearea', el, 'fixed bottom:' + cs.bottom + ' with no safe-area-inset-bottom');
  });

  // (6) text inputs ≥ 16px ------------------------------------------------------------
  all('input, select, textarea').forEach((el) => {
    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['checkbox', 'radio', 'file', 'hidden', 'range', 'color', 'button', 'submit', 'reset', 'image'].indexOf(type) >= 0) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 15.95) d('font16', el, 'font-size ' + fs.toFixed(2) + 'px — iOS zooms on focus');
  });

  return { surface: desc(scope), defects: defects };
}
