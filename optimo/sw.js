// optimo tombstone service worker. Served at BOTH old addresses: /optimo/ (migrate-home, 2026-10-10; this repo's own
// Pages site) and /press/optimo/ (arc app-lab, 2026-10-14; written into press/optimo/ by tools/release.js). optimo now
// lives at /press/app-lab/optimo/. An old installed app's workbox SW checks <old scope>sw.js for updates; this
// replacement installs, drops the old push subscription (push-send then prunes the dead endpoint on its 404/410),
// deletes the old precache, unregisters itself and sends every open old window to the new address. The new app's
// caches (scope /press/app-lab/optimo/) are untouched.
const NEW = '/press/app-lab/optimo/'
const OLD = ['/optimo/', '/press/optimo/']
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription()
        if (sub) await sub.unsubscribe()
      } catch (e) {}
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.includes('optimo') && !k.includes('/app-lab/optimo/')).map((k) => caches.delete(k)))
      await self.registration.unregister()
      const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of wins) {
        const u = new URL(w.url)
        if (OLD.some((p) => u.pathname.startsWith(p))) w.navigate(NEW + u.search + u.hash).catch(() => {})
      }
    })(),
  )
})
