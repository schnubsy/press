// src/fsa-sw.js — strict good-neighbour service worker for the FSA page on /press/.
// Deployed to the press repo ROOT so GitHub Pages honours its scope. It touches ONLY
// fsa.html, /fsa-assets/*, and itself; for any other request it returns WITHOUT calling
// respondWith, so every sibling press page is completely untouched. Never caches PostgREST.
const CACHE = 'fsa-vnzwi1d';
const PAGE = 'fsa.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([
    './fsa.html',
    './fsa-assets/manifest.webmanifest',
    './fsa-assets/icon-192.png',
    './fsa-assets/icon-512.png',
    './fsa-assets/apple-touch-icon.png',
  ]).catch(() => {})));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((k) => k.startsWith('fsa-') && k !== CACHE).map((k) => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  let url;
  try { url = new URL(e.request.url); } catch (_) { return; }
  // Only ever handle our own same-origin assets. Anything else (sibling press pages,
  // and every cross-origin request incl. PostgREST at *.supabase.co) is left alone.
  if (url.origin !== self.location.origin) return;
  const p = url.pathname;
  const ours = p.endsWith('/' + PAGE) || p.endsWith('/fsa.html')
    || p.includes('/fsa-assets/') || p.endsWith('/fsa-sw.js');
  if (!ours) return;                       // good neighbour: do not intercept
  e.respondWith(staleWhileRevalidate(e.request));
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || network;
}
