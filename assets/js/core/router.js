// assets/js/core/router.js
// Minimal, robust router: loads partials and page modules; reapplies i18n to the entire document.

import * as DOM from './dom.js';
import * as I18N from './i18n.js';

const qs  = DOM.qs  || ((sel, root = document) => root.querySelector(sel));
const qsa = DOM.qsa || ((sel, root = document) => Array.from(root.querySelectorAll(sel)));

let current = { name: null, destroy: null };
let navToken = 0;

const ROUTES = {
  story:    { partial: 'story',    module: () => import('./pages/story.js')    },
  support:  { partial: 'support',  module: () => import('./pages/support.js')  },
  now:      { partial: 'now',      module: () => import('./pages/now.js')      },
  roadmap:  { partial: null,       module: () => import('./pages/roadmap.js')  }, // оставим как было
  timeline: { partial: 'timeline', module: () => import('./pages/timeline.js') }, // НОВОЕ
  reporting:{ partial: 'reporting',module: () => import('./pages/reporting.js') }  // ← ДОБАВЛЕНО
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
//  return { ...json, html: String(html) }; ...json не нужно указывать, исправлено

  // 👇 вот эту строчку добавь
  console.debug('[partial]', name, 'loaded keys:', Object.keys(json));

	return { html: String(html) };
}

function mountHTML(html) {
  const mount = qs('#subpage') || document.body;
  mount.innerHTML = html || '';
  return mount;
}

function setActiveNav(routeHash) {
  qsa('[data-route]').forEach(el => {
    const active = el.getAttribute('data-route') === routeHash;
    if (active) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  });
}

async function applyI18N(root) {
  const r = root || document.body;
  try { if (typeof I18N.applyI18nTo === 'function') return I18N.applyI18nTo(r); }
  catch (e) { console.warn('[router] i18n apply failed:', e); }
}
async function applyI18NAll(mount) {
  await applyI18N(mount);
  await applyI18N(document.body);
}

async function runRoute(name, token) {
  const cfg = ROUTES[name];

  document.documentElement.setAttribute('data-route', name);
  document.dispatchEvent(new CustomEvent('trus:route:will-change', { detail: { to: name }}));

  if (current.destroy) { try { current.destroy(); } catch {} }
  current = { name, destroy: null };

  setActiveNav(`#/${name}`);

  let mount = qs('#subpage');
  if (cfg.partial) {
    const partial = await fetchPartial(cfg.partial, token);
    if (token !== navToken || partial === null) return;
    mount = mountHTML(partial.html);
    await applyI18NAll(mount);
  } else {
    if (mount) mount.innerHTML = '';
    await applyI18N(document.body);
  }

  const mod = await cfg.module();
  if (token !== navToken) return;

  if (typeof mod?.init === 'function') await mod.init(mount);
  if (typeof mod?.destroy === 'function') current.destroy = mod.destroy;

  await applyI18NAll(mount);

  document.dispatchEvent(new CustomEvent('trus:route:rendered', { detail: { name } }));
}

export async function navigate(hash) { if (hash && location.hash !== hash) location.hash = hash; }
export function rerenderCurrentPage() { const name = parseRoute(); navToken++; runRoute(name, navToken); }

async function onHashChange() {
  if (!location.hash || location.hash === '#/' || location.hash === '#') { location.hash = '#/story'; return; }
  const name = parseRoute(); navToken++; await runRoute(name, navToken);
}
function onClick(e) {
  const btn = e.target.closest('[data-route]'); if (!btn) return;
  const route = btn.getAttribute('data-route'); if (!route || !route.startsWith('#/')) return;
  e.preventDefault(); if (location.hash === route) rerenderCurrentPage(); else navigate(route);
}

export function init() {
  document.addEventListener('click', onClick);
  window.addEventListener('hashchange', onHashChange);
  if (typeof I18N.onLocaleChanged === 'function') I18N.onLocaleChanged(() => rerenderCurrentPage());
  onHashChange();
}
export function startRouter() {
  if (!window.__TRUS_ROUTER_BOOTSTRAPPED__) { window.__TRUS_ROUTER_BOOTSTRAPPED__ = true; init(); }
}
if (document.currentScript && !window.__TRUS_ROUTER_BOOTSTRAPPED__) startRouter();

export default { init, navigate, rerenderCurrentPage, startRouter };
