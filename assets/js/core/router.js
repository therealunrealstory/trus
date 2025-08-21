// /assets/js/core/router.js
// SPA Router: loads partials JSON into #subpage, lazy-loads page modules,
// keeps nav state, and (importantly) reapplies i18n after every render,
// fixing the "translation flashes then reverts to EN" issue for Hero/Support/News/etc.

import { qs, qsa } from './dom.js';
import * as I18N from './i18n.js';

let current = { name: null, destroy: null };
let navToken = 0;
let mo = null; // MutationObserver for dynamic DOM updates

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

// Robust i18n apply (actual export in your i18n.js is applyI18nTo)
async function applyI18N(root) {
  const r = root || document.body;
  try {
    if (typeof I18N.applyI18nTo      === 'function') return I18N.applyI18nTo(r);
    if (typeof I18N.applyTranslations=== 'function') return I18N.applyTranslations(r);
    if (typeof I18N.translateNode    === 'function') return I18N.translateNode(r);
    if (typeof I18N.apply            === 'function') return I18N.apply(r);
    if (typeof I18N.refresh          === 'function') return I18N.refresh(r);
  } catch (e) {
    console.warn('[router] i18n apply failed:', e);
  }
}

// Observe dynamic changes inside mount and re-apply i18n
function startObserver(mount) {
  stopObserver();
  if (!mount || typeof MutationObserver === 'undefined') return;
  let scheduled = false;
  mo = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(async () => {
      scheduled = false;
      await applyI18N(mount);
    });
  });
  mo.observe(mount, { childList: true, subtree: true });
}
function stopObserver() {
  try { mo && mo.disconnect(); } catch {}
  mo = null;
}

async function runRoute(name, token) {
  const cfg = ROUTES[name];

  // Tear down previous page
  stopObserver();
  if (current.destroy) {
    try { current.destroy(); } catch {}
  }
  current = { name, destroy: null };

  // Active nav
  setActiveNav(`#/` + name);

  let mount = qs('#subpage');

  // 1) If there's a partial, mount it first
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return;
    mount = mountHTML(partial.html);
    await applyI18N(mount); // translate freshly inserted HTML
  } else {
    if (mount) mount.innerHTML = '';
  }

  // 2) Load module and init
  const mod = await cfg.module();
  if (token !== navToken) return;
  if (typeof mod?.init === 'function') {
    await mod.init({ mount });
  }
  if (typeof mod?.destroy === 'function') {
    current.destroy = mod.destroy;
  }

  // 3) Re-apply i18n after module possibly modified the DOM
  await applyI18N(mount);

  // 4) Start observer to auto-translate any subsequent async inserts
  startObserver(mount);
}

export async function navigate(hash) {
  if (hash && location.hash !== hash) location.hash = hash;
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

export function rerenderCurrentPage() {
  const name = parseRoute();
  navToken++;
  const myToken = navToken;
  runRoute(name, myToken);
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

// For boot.js
export function startRouter() {
  if (!window.__TRUS_ROUTER_BOOTSTRAPPED__) {
    window.__TRUS_ROUTER_BOOTSTRAPPED__ = true;
    init();
  }
}

// Auto-boot if included directly
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) {
  startRouter();
}

export default { init, navigate, rerenderCurrentPage, startRouter };
