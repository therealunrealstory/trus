/* Simple offline cache & runtime SW */
const VERSION = 'v1.0.0';
const CORE = [
  '/',
  '/index.html',
  '/site.webmanifest'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// network-first для функций, cache-first для остального
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isFunction = url.pathname.startsWith('/.netlify/functions/');

  if (isFunction) {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match(req)) || new Response(JSON.stringify([]), { headers:{'content-type':'application/json'} });
      }
    })());
  } else {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      cache.put(req, fresh.clone());
      return fresh;
    })());
  }
});
