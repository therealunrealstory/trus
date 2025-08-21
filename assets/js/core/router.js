// /assets/js/core/router.js
// Лёгкий роутер: partials + lazy-модули страниц.
// ВАЖНО: после каждого шага применяем i18n не только к #subpage, но и ко всему документу,
// чтобы перевелись шапка/Hero/кнопки музыки/модалки, которые лежат вне #subpage.
// Также выставляем <html data-route="..."> и шлём событие смены маршрута.

import * as DOM from './dom.js';
import * as I18N from './i18n.js';

// Фолбэки на случай, если в dom.js нет именованных экспортов
const qs  = DOM.qs  || ((sel, root = document) => root.querySelector(sel));
const qsa = DOM.qsa || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

let current = { name: null, destroy: null };
let navToken = 0;

// === Маршруты (контент страниц не трогаем)
const ROUTES = {
  story:   { partial: 'story',   module: () => import('./pages/story.js')   },
  support: { partial: 'support', module: () => import('./pages/support.js') },
  now:     { partial: 'now',     module: () => import('./pages/now.js')     },
  roadmap: { partial: null,      module: () => import('./pages/roadmap.js') }
};

function parseRoute() {
  const m = location.hash.match(/^#\/?([^\/]+)?/);
  const name = (m && m[1]) ? m[1] : 'story';
  return name in ROUTES ? name : 'story';
}

async function fetchPartial(name, token) {
  const url = `/partials/${name}.json`;
  const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
  if (token !== navToken) return null;
  if (!res || !res.ok) {
    return { html: `<div data-i18n="page.error">Failed to load page</div>` };
  }
  const json = await res.json().catch(() => ({}));
  if (token !== navToken) return null;
  const html = json.html ?? json.markup ?? json.content ?? json.innerHTML ?? '';
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

// Универсальный вызов i18n
async function applyI18N(root) {
  const r = root || document.body;
  try {
    if (typeof I18N.applyI18nTo       === 'function') return I18N.applyI18nTo(r);
    if (typeof I18N.applyTranslations === 'function') return I18N.applyTranslations(r);
    if (typeof I18N.translateNode     === 'function') return I18N.translateNode(r);
    if (typeof I18N.apply             === 'function') return I18N.apply(r);
    if (typeof I18N.refresh           === 'function') return I18N.refresh(r);
  } catch (e) {
    console.warn('[router] i18n apply failed:', e);
  }
}

// Вспомогательно: применить i18n к #subpage И ко всему документу,
// чтобы перевелись шапка/модалки/хедер и не оставались "..."
async function applyI18NAll(mount) {
  await applyI18N(mount);
  await applyI18N(document.body);
}

async function runRoute(name, token) {
  const cfg = ROUTES[name];

  // Сообщим глобально, какой маршрут будет активен
  document.documentElement.setAttribute('data-route', name);
  document.dispatchEvent(new CustomEvent('trus:route:will-change', { detail: { to: name }}));

  // Тёрндаун прошлой страницы
  if (current.destroy) { try { current.destroy(); } catch {} }
  current = { name, destroy: null };

  // Подсветка активного меню
  setActiveNav(`#/${name}`);

  // 1) Подключаем partial (если есть) и СРАЗУ переводим всё
  let mount = qs('#subpage');
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return;
    mount = mountHTML(partial.html);
    await applyI18NAll(mount);       // ← перевести и центр, и шапку/модалки
  } else {
    if (mount) mount.innerHTML = '';
    await applyI18N(document.body);  // ← хотя бы глобальные строки
  }

  // 2) Инициализация модуля страницы (ему передаём DOM-элемент)
  const mod = await cfg.module();
  if (token !== navToken) return;
  if (typeof mod?.init === 'function') {
    await mod.init(mount);
  }
  if (typeof mod?.destroy === 'function') {
    current.destroy = mod.destroy;
  }

  // 3) Финальный проход перевода по ВСЕМУ документу
  await applyI18NAll(mount);

  // Сообщим, что маршрут отрисован (для твоих вспомогательных скриптов/плеера/модалок)
  document.dispatchEvent(new CustomEvent('trus:route:rendered', { detail: { name } }));
}

export async function navigate(hash) {
  if (hash && location.hash !== hash) location.hash = hash;
}

export function rerenderCurrentPage() {
  const name = parseRoute();
  navToken++;
  const my = navToken;
  runRoute(name, my);
}

async function onHashChange() {
  if (!location.hash || location.hash === '#/' || location.hash === '#') {
    location.hash = '#/story';
    return;
  }
  const name = parseRoute();
  navToken++;
  const my = navToken;
  await runRoute(name, my);
}

function onClick(e) {
  const btn = e.target.closest('[data-route]');
  if (!btn) return;
  const route = btn.getAttribute('data-route');
  if (!route || !route.startsWith('#/')) return;
  e.preventDefault();
  if (location.hash === route) rerenderCurrentPage();
  else navigate(route);
}

export function init() {
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', onHashChange);

  // Если i18n шлёт событие смены языка — перерисуем текущую страницу и переведём весь документ
  if (typeof I18N.onLocaleChanged === 'function') {
    I18N.onLocaleChanged(async () => {
      rerenderCurrentPage();
      await applyI18N(document.body);
    });
  }

  onHashChange();
}

export function startRouter() {
  if (!window.__TRUS_ROUTER_BOOTSTRAPPED__) {
    window.__TRUS_ROUTER_BOOTSTRAPPED__ = true;
    init();
  }
}

// Автозапуск только при прямом подключении файла
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) {
  startRouter();
}

export default { init, navigate, rerenderCurrentPage, startRouter };
