// /assets/js/core/router.js
// SPA Router: partials + lazy modules, повторное применение i18n,
// безопасный MutationObserver без зацикливаний и без вмешательства в «живые» элементы (аудио/модалки).

import * as DOM from './dom.js';
import * as I18N from './i18n.js';

// Фолбэки, если в dom.js нет именованных экспортов
const qs  = DOM.qs  || ((sel, root = document) => root.querySelector(sel));
const qsa = DOM.qsa || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

let current   = { name: null, destroy: null };
let navToken  = 0;
let mo        = null;     // MutationObserver
let moTarget  = null;
let isApplyingI18N = false;
let moTimer   = null;     // debounce

// Узлы/поддеревья, в которые i18n не лезет после запуска (живые островки)
const I18N_SKIP_SELECTOR = [
  '[data-i18n-skip]',
  '[data-i18n-lock]',
  '.audio-player',
  '.js-audio',
  '[data-audio]',
  '[data-player]',
  '.player',
  '.hero-audio',
  '.modal',
  '[data-modal]'
].join(',');

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
    return { html: `<div data-i18n="page.error">Не удалось загрузить страницу.</div>` };
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

// Помечаем «живые» элементы, чтобы i18n не перезатирал их состояние
function markDynamicIslands(root) {
  if (!root) return;
  // Если у тебя уже стоят data-i18n-skip / data-i18n-lock — ничего делать не нужно.
  // Здесь мягкая авто-подсветка типовых контейнеров плееров и модалок:
  const candidates = qsa(I18N_SKIP_SELECTOR, root);
  candidates.forEach(el => {
    if (!el.hasAttribute('data-i18n-skip') && !el.hasAttribute('data-i18n-lock')) {
      el.setAttribute('data-i18n-skip', '');
    }
  });

  // Дополнительно — кнопки play/pause: если у них есть data-i18n, снимем его один раз,
  // чтобы переводчик не менял innerHTML и не сбрасывал иконку состояния.
  const playBtns = qsa('.play, .btn-play, [data-action="play"], [data-audio="toggle"]', root);
  playBtns.forEach(btn => {
    if (btn.hasAttribute('data-i18n')) {
      btn.setAttribute('data-i18n-lock', ''); // помечаем как динамическую
      btn.removeAttribute('data-i18n');       // и больше не трогаем текст/иконку переводом
    }
  });
}

// ————— Безопасный наблюдатель —————
function stopObserver() {
  try { mo && mo.disconnect(); } catch {}
  mo = null;
  moTarget = null;
  if (moTimer) { clearTimeout(moTimer); moTimer = null; }
}

function mutationTouchesSkipArea(mutation) {
  const nodes = [
    ...(mutation.addedNodes ? Array.from(mutation.addedNodes) : []),
    ...(mutation.removedNodes ? Array.from(mutation.removedNodes) : [])
  ];
  return nodes.some(n => {
    if (!(n instanceof Element)) return false;
    return n.closest(I18N_SKIP_SELECTOR) != null;
  });
}

function startObserver(mount) {
  stopObserver();
  if (!mount || typeof MutationObserver === 'undefined') return;
  moTarget = mount;
  mo = new MutationObserver((mutations) => {
    if (isApplyingI18N) return; // игнорируем собственные правки перевода
    // реагируем только на добавление/удаление узлов НЕ внутри «skip»-зон
    const relevant = mutations.some(m => {
      const structural = (m.addedNodes && m.addedNodes.length) || (m.removedNodes && m.removedNodes.length);
      if (!structural) return false;
      return !mutationTouchesSkipArea(m);
    });
    if (!relevant) return;
    // Debounce: не чаще, чем раз в 150 мс
    if (moTimer) return;
    moTimer = setTimeout(async () => {
      moTimer = null;
      await safeApplyI18N(mount);
    }, 150);
  });
  mo.observe(mount, { childList: true, subtree: true }); // без attributes/characterData
}

async function safeApplyI18N(root) {
  if (!root) return;
  // 1) Отмечаем динамические островки (включая плеер/модалки)
  markDynamicIslands(root);
  // 2) На время применения переводов отключаем наблюдатель
  const hadObserver = !!mo;
  if (hadObserver) stopObserver();
  isApplyingI18N = true;
  try {
    await applyI18N(root);
  } finally {
    isApplyingI18N = false;
    if (hadObserver) startObserver(root);
  }
}

// ————— Основной цикл маршрутизации —————
async function runRoute(name, token) {
  const cfg = ROUTES[name];

  // Тёрндаун прошлой страницы
  stopObserver();
  if (current.destroy) {
    try { current.destroy(); } catch {}
  }
  current = { name, destroy: null };

  // Активный пункт меню
  setActiveNav(`#/` + name);

  let mount = qs('#subpage');

  // 1) Подставляем partial (если есть)
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return;
    mount = mountHTML(partial.html);
    await safeApplyI18N(mount);
  } else {
    if (mount) mount.innerHTML = '';
  }

  // 2) Грузим модуль и запускаем init с DOM-ЭЛЕМЕНТОМ
  const mod = await cfg.module();
  if (token !== navToken) return;
  if (typeof mod?.init === 'function') {
    await mod.init(mount);
  }
  if (typeof mod?.destroy === 'function') {
    current.destroy = mod.destroy;
  }

  // 3) После возможной дорисовки модулем — ещё раз i18n (безопасно)
  await safeApplyI18N(mount);

  // 4) Наблюдатель на асинхронные вставки
  startObserver(mount);
}

export async function navigate(hash) {
  if (hash && location.hash !== hash) location.hash = hash;
}

export function rerenderCurrentPage() {
  const name = parseRoute();
  navToken++;
  const myToken = navToken;
  runRoute(name, myToken);
}

async function onHashChange() {
  if (!location.hash || location.hash === '#/' || location.hash === '#') {
    location.hash = '#/story';
    return;
  }
  const name = parseRoute();
  navToken++;
  const myToken = navToken;
  await runRoute(name, myToken);
}

function onClick(e) {
  const btn = e.target.closest('[data-route]');
  if (!btn) return;
  const route = btn.getAttribute('data-route');
  if (!route || !route.startsWith('#/')) return;
  e.preventDefault();
  if (location.hash === route) {
    rerenderCurrentPage();
  } else {
    navigate(route);
  }
}

export function init() {
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', onHashChange);
  onHashChange();
}

export function startRouter() {
  if (!window.__TRUS_ROUTER_BOOTSTRAPPED__) {
    window.__TRUS_ROUTER_BOOTSTRAPPED__ = true;
    init();
  }
}

// Автозапуск
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) {
  startRouter();
}

export default { init, navigate, rerenderCurrentPage, startRouter };
