// sw.js — The Real Unreal Story
// Version must match the one in index.html registration query (?ver=...)
const SW_VERSION = 'v1.3.1';
const STATIC_CACHE = `static-${SW_VERSION}`;
const RUNTIME_CACHE = `runtime-${SW_VERSION}`;

// Что кладём в предкэш, чтобы офлайн-режим выглядел корректно
const PRE_CACHE_FILES = [
  '/',                     // для SPA/навиг. фолбэка
  '/index.html',
  '/assets/styles.css',
  '/assets/app.js',
  '/site.webmanifest',

  // Иконки / PWA
  '/favicon.svg',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/android-chrome-512x512-maskable.png',

  // Фон и тайлы (чтобы главная была опрятной офлайн)
  '/images/bg.png',
  '/images/1.png',
  '/images/2.png',
  '/images/3.png',
];

// CDN-хосты, для которых применяем stale-while-revalidate
const SWR_CDNS = new Set([
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
]);

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    // Добавляем по одному, чтобы не провалить всю установку, если файла нет
    await Promise.all(
      PRE_CACHE_FILES.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
      )
    );
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Сносим старые кэши
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Только GET имеет смысл кэшировать
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Не кэшируем аудио — слишком объёмно (пусть браузер управляет сам)
  if (url.pathname.startsWith('/audio/')) {
    return; // сквозной запрос
  }

  // Не берём на себя кеширование тайлов OSM (свои правила использования)
  if (url.hostname.endsWith('openstreetmap.org')) {
    return; // сквозной запрос
  }

  // Навигационные запросы (HTML): network-first с фолбэком на кэш
  const isNavigation = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(networkFirstHTML(request));
    return;
  }

  // Статические ассеты нашего домена: cache-first
  if (sameOrigin && isStaticAsset(request)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Локали и динамические JSON/API (в т.ч. Netlify Functions): SWR
  if (
    (sameOrigin && (url.pathname.startsWith('/i18n/') || url.pathname.startsWith('/.netlify/functions/'))) ||
    SWR_CDNS.has(url.hostname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // По умолчанию — тоже SWR (бережно для всяких мелких ресурсов)
  event.respondWith(staleWhileRevalidate(request));
});

// ---------- Helpers ----------

function isStaticAsset(request) {
  // По destination распознаём основные типы ассетов
  const d = request.destination;
  if (d === 'style' || d === 'script' || d === 'image' || d === 'font' || d === 'manifest') return true;

  // Подстраховка по расширению
  const url = new URL(request.url);
  return /\.(css|js|mjs|png|webp|jpg|jpeg|gif|svg|ico|json|map|txt)$/i.test(url.pathname);
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreVary: true });
  if (cached) return cached;

  const response = await fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  // Кладём только успешные ответы
  if (response && response.status === 200) {
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  // Если в кэше что-то есть — отдаём сразу и параллельно обновляем
  if (cached) {
    eventWaitUntil(networkPromise); // не блокируем ответ
    return cached;
  }

  // Иначе ждём сеть, а при офлайне — пустой ответ/ошибка
  const net = await networkPromise;
  if (net) return net;

  // как крайний случай — попытаться вернуть index.html при запросе JSON/локали не стоит
  return new Response('', { status: 504, statusText: 'Gateway Timeout' });
}

async function networkFirstHTML(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put('/index.html', response.clone());
    }
    return response;
  } catch {
    // офлайн: возвращаем последнюю версию index.html
    const cached = await caches.match('/index.html', { ignoreVary: true });
    if (cached) return cached;
    return new Response('<!doctype html><title>Offline</title><h1>Offline</h1>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      status: 200,
    });
  }
}

// Безопасно "подвесить" промис к жизненному циклу SW (если доступно)
function eventWaitUntil(promise) {
  try {
    self.addEventListener('fetch', (ev) => ev.waitUntil?.(promise));
  } catch {}
}