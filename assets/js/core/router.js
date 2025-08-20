// /assets/js/core/router.js
// SPA-роутер для v200825-final: грузит partials JSON в #subpage, lazy-импортирует модули страниц,
// отменяет "устаревшие" переходы через navToken, обновляет активность кнопок [data-route].
//
// Страницы:
//  - story   (#/story)   -> partials/story.json + pages/story.js
//  - support (#/support) -> partials/support.json + pages/support.js
//  - now     (#/now)     -> partials/now.json + pages/now.js
//  - roadmap (#/roadmap) -> БЕЗ partial (модуль сам рисует), pages/roadmap.js

import { qs, qsa } from './dom.js';
import { getLocale } from './i18n.js';

let current = { name: null, destroy: null };
let navToken = 0;

const ROUTES = {
  story: {
    partial: 'story',
    module: () => import('./pages/story.js'),
    titleKey: 'nav.story' // опционально, если используешь обновление title по i18n
  },
  support: {
    partial: 'support',
    module: () => import('./pages/support.js'),
    titleKey: 'nav.support'
  },
  now: {
    partial: 'now',
    module: () => import('./pages/now.js'),
    titleKey: 'nav.now'
  },
  roadmap: {
    partial: null, // без partial — модуль сам всё отрисует
    module: () => import('./pages/roadmap.js'),
    titleKey: 'nav.roadmap'
  }
};

function parseRoute() {
  // ожидаем вид #/name[/sub]
  const m = location.hash.match(/^#\/?([^\/]+)?/);
  const name = (m && m[1]) ? m[1] : 'story';
  return name in ROUTES ? name : 'story';
}

async function fetchPartial(name, token) {
  const url = `/partials/${name}.json`;
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (token !== navToken) return null; // устарело
  if (!res || !res.ok) return { html: `<div data-i18n="page.error">Не удалось загрузить страницу.</div>` };

  const json = await res.json().catch(() => ({}));
  if (token !== navToken) return null;

  // Универсальная подстановка: поддержим html/markup/content/innerHTML
  const html = json.html ?? json.markup ?? json.content ?? '';
  return { ...json, html: String(html) };
}

function mountHTML(html) {
  const mount = qs('#subpage') || document.body;
  mount.innerHTML = html || '';
  return mount;
}

function setActiveNav(routeHash) {
  qsa('[data-route]').forEach(el => {
    const isActive = el.getAttribute('data-route') === routeHash;
    if (isActive) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

async function runRoute(name, token) {
  const cfg = ROUTES[name];

  // Снять предыдущую страницу
  if (current.destroy) {
    try { current.destroy(); } catch(e) {}
  }
  current = { name, destroy: null };

  // Обновить состояние навигации
  setActiveNav(`#/` + name);

  // Если есть partial — грузим и вставляем его HTML перед инициализацией модуля
  let mount = qs('#subpage');
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return; // отменено
    mount = mountHTML(partial.html);
  } else {
    // очищаем подложку, модуль сам создаст контент
    if (mount) mount.innerHTML = '';
  }

  // Lazy-импорт и init()
  const mod = await cfg.module();
  if (token !== navToken) return;
  if (typeof mod?.init === 'function') {
    await mod.init({ mount });
  }
  if (typeof mod?.destroy === 'function') {
    current.destroy = mod.destroy;
  }

  // (опционально) обновление заголовка страницы
  // Если у тебя уже есть глобальный механизм через i18n.loadLocale() — можно не трогать title тут.
  if (cfg.titleKey) {
    try {
      const base = document.querySelector('meta[name="site-title-base"]')?.getAttribute('content') || document.title || 'The Real Unreal Story';
      // Простой вариант: оставим текущий document.title как есть
      document.title = base;
    } catch {}
  }
}

export async function navigate(hash) {
  if (hash && location.hash !== hash) location.hash = hash;
  // onHashChange обработает
}

async function onHashChange() {
  const name = parseRoute();
  navToken++;
  const myToken = navToken;
  await runRoute(name, myToken);
}

export function init() {
  window.addEventListener('hashchange', onHashChange);
  // Первый запуск
  onHashChange();
}

// Авто-инициализация, если роутер подключён напрямую
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) {
  window.__TRUS_ROUTER_BOOTSTRAPPED__ = true;
  init();
}

export default { init, navigate };
