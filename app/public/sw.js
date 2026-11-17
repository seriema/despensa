// Minimal offline support for the installed web app (PWA).
// Network first, fall back to cache – so a new deploy shows up on next open, and the app still opens offline.
// Product photos are cached too once seen.
const CACHE = 'despensa-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(e.request)),
  )
})
