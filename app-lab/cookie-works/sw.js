// Cookie Works — the offline service worker (ARC 2026-11-09 slice 3). Generated into dist/sw.js by vite.config.ts
// (serviceWorker plugin): the cache is named by the hash of the build's bytes; the list is every file of the build.
// Same origin only: it answers GETs to its own origin from the cache and never fetches, or answers for, anything else.
const CACHE = 'cookie-works-716d1c7cfa85';
const FILES = ["./","./assets/fredoka-latin-DM6njrJ3.woff2","./assets/index-DPOSx4_F.js","./assets/rubik-latin-CnQIisVs.woff2","./icons/apple-touch-icon.png","./icons/favicon-32.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./manifest.webmanifest"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('cookie-works-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // never another origin
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = (await c.match(req, { ignoreSearch: true }))
      || (req.mode === 'navigate' ? (await c.match('./index.html')) || (await c.match('./')) : undefined);
    return hit || fetch(req);
  })());
});
