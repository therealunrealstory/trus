// /assets/js/core/router.js
// Лёгкий и надёжный роутер: грузит partials, лениво подключает модули страниц,
// применяет i18n ПОСЛЕ вставки partial и ПОСЛЕ init() страницы,
// не трогает "живые" элементы (аудио/модалки), экспорт совместим с boot.js.

import * as DOM from './dom.js';
import * as I18N from './i18n.js';

// Фолбэки, если в dom.js нет именованных экспортов
const qs  = DOM.qs  || ((sel, root = document) => root.querySelector(sel));
const qsa = DOM.qsa || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

let current = { name: null, destroy: null };
let navToken = 0;

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
  if (!res || !res.ok) return { html: `<div data-i18n="page.error">Failed to load page</div>` };
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

// Аккуратно применить переводы (под разные реализации i18n)
async function applyI18N(root) {
  const r = root || document.body;
  try {
    if (typeof I18N.applyI18nTo       === 'function') return I18N.applyI18nTo(r);
    if (typeof I18N.applyTranslations === 'function') return I18N.applyTranslations(r);
    if (typeof I18N.translateNode     === 'function') return I18N.translateNode(r);
    if (typeof I18N.apply             === 'function') return I18N.apply(r);
    if (typeof I18N.refresh           === 'function') return I18N.refresh(r);
    // возможные глобальные варианты
    const w = window;
    if (w.I18N?.applyI18nTo) return w.I18N.applyI18nTo(r);
    if (w.applyI18nTo)       return w.applyI18nTo(r);
  } catch (e) {
    console.warn('[router] i18n apply failed:', e);
  }
}

// Не даём i18n переписывать живые узлы (плеер/модалки), чтобы не ломать их состояние UI
function protectLiveIslands(root) {
  if (!root) return;
  const selectors = [
    '#audioBtn',
    '[data-audio="toggle"]',
    '.audio-player',
    '.player',
    '.hero-audio',
    '.modal',
    '[data-modal]'
  ].join(',');
  qsa(selectors, root).forEach(el => {
    if (!el.hasAttribute('data-i18n-skip')) el.setAttribute('data-i18n-skip','');
  });
}

async function runRoute(name, token) {
  const cfg = ROUTES[name];

  // Тёрндаун предыдущего экрана
  if (current.destroy) { try { current.destroy(); } catch {} }
  current = { name, destroy: null };

  setActiveNav(`#/${name}`);

  let mount = qs('#subpage');

  // 1) partial (если есть)
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return;
    mount = mountHTML(partial.html);
    protectLiveIslands(mount);
    await applyI18N(mount);
  } else {
    if (mount) mount.innerHTML = '';
  }

  // 2) модуль страницы
  const mod = await cfg.module();
  if (token !== navToken) return;

  if (typeof mod?.init === 'function') {
    // ВАЖНО: передаём DOM-элемент (совместимо с твоими now/story/support)
    await mod.init(mount);
  }
  if (typeof mod?.destroy === 'function') {
    current.destroy = mod.destroy;
  }

  // 3) финальный i18n (на случай, если модуль дорисовал что-то)
  protectLiveIslands(mount);
  await applyI18N(mount);
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

  // Перерисовать текущую страницу при смене языка (если i18n это поддерживает)
  if (typeof I18N.onLocaleChanged === 'function') {
    I18N.onLocaleChanged(() => rerenderCurrentPage());
  } else if (window.I18N?.onLocaleChanged) {
    window.I18N.onLocaleChanged(() => rerenderCurrentPage());
  }

  onHashChange();
}

export function startRouter() {
  if (!window.__TRUS_ROUTER_BOOTSTRAPPED__) {
    window.__TRUS_ROUTER_BOOTSTRAPPED__ = true;
    init();
  }
}

// Автозапуск только если файл подключён отдельным тегом
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) {
  startRouter();
}

export default { init, navigate, rerenderCurrentPage, startRouter };
