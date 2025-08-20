<<<<<<< HEAD
// sw.js — The Real Unreal Story
// Version must match the one in index.html registration query (?ver=...)
const SW_VERSION = 'v1.3.1';
const STATIC_CACHE = `static-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;
=======
// sw.js — v1.3.0
const VERSION = 'v1.3.0';
const CORE_CACHE = `core-${VERSION}`;
const RUNTIME_CACHE = `rt-${VERSION}`;
>>>>>>> parent of 3a123cb (index+sw change version to 1.3.1)

const CORE_ASSETS = [
  '/', '/index.html', '/site.webmanifest',
  '/assets/styles.css', '/assets/app.js',
  '/favicon.svg', '/favicon-32x32.png', '/apple-touch-icon.png'
];

// install: precache core
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CORE_CACHE).then(cache => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

// activate: clean old
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![CORE_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// fetch: 
//  1) i18n -> stale-while-revalidate
//  2) same-origin GET -> network-first fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // i18n JSON – stale-while-revalidate
  if (url.pathname.startsWith('/i18n/') && url.pathname.endsWith('.json')) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request).then(resp => {
        if (resp && resp.status === 200) cache.put(request, resp.clone());
        return resp;
      }).catch(()=> cached);
      return cached || fetchPromise;
    })());
    return;
  }

  // core assets -> cache-first
  if (CORE_ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(request).then(r => r || fetch(request)));
    return;
  }

  // same-origin network-first
  if (url.origin === location.origin) {
    event.respondWith((async () => {
      try {
        const net = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, net.clone());
        return net;
      } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw new Error('offline');
      }
    })());
  }
});
