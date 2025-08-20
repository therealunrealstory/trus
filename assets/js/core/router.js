// /assets/js/core/router.js
// Надёжный SPA-роутер с делегированием кликов, дефолтным #/story,
// совместим с pages/story.js|support.js|now.js (init(mount)) и pages/roadmap.js.

import * as DOM from './dom.js';

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
  if (!res || !res.ok) {
    return { html: `<div data-i18n="page.error">Не удалось загрузить страницу.</div>` };
  }
  const json = await res.json().catch(() => ({}));
  if (token !== navToken) return null;
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

  if (current.destroy) { try { current.destroy(); } catch {} }
  current = { name, destroy: null };

  setActiveNav(`#/` + name);

  let mount = qs('#subpage');
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return;
    mount = mountHTML(partial.html);                // ← получаем ЭЛЕМЕНТ
  } else {
    if (mount) mount.innerHTML = '';
  }

  const mod = await cfg.module();
  if (token !== navToken) return;

  // ВАЖНО: передаём в init ИМЕННО ЭЛЕМЕНТ, а не объект { mount }
  if (typeof mod?.init === 'function') await mod.init(mount);

  if (typeof mod?.destroy === 'function') current.destroy = mod.destroy;
}

export async function navigate(hash) {
  if (hash && location.hash !== hash) location.hash = hash;
}

// Требуется boot.js: перерисовать текущую страницу без смены hash
export async function rerenderCurrentPage() {
  if (!current.name) return;
  navToken++;
  const myToken = navToken;
  await runRoute(current.name, myToken);
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

export function init() {
  // Делегирование кликов по [data-route] (кнопки сабнава)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-route]');
    if (!btn) return;
    const to = btn.getAttribute('data-route');
    if (!to) return;
    e.preventDefault();
    if (location.hash !== to) location.hash = to;
  });

  window.addEventListener('hashchange', onHashChange);
  onHashChange(); // первый запуск
}

// Автобут, если подключили напрямую модульным скриптом из index.html
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) {
  window.__TRUS_ROUTER_BOOTSTRAPPED__ = true;
  init();
}

export default { init, navigate, rerenderCurrentPage };
