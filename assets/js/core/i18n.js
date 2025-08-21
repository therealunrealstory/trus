// assets/js/core/i18n.js
import { $$ } from './dom.js';

export const LOCALE_DIRS = { AR:"rtl", CN:"ltr", DE:"ltr", EN:"ltr", ES:"ltr", FR:"ltr", IT:"ltr", PT:"ltr", RU:"ltr" };

export let I18N = {};
export const DEFAULT_I18N = {};
const listeners = new Set();

// Снимаем дефолтные тексты, чтобы всегда был fallback
(function captureDefaultI18n(){
  $$('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (!(k in DEFAULT_I18N)) DEFAULT_I18N[k] = el.innerHTML;
  });
  $$('[data-i18n-placeholder]').forEach(el => {
    const k = el.getAttribute('data-i18n-placeholder');
    if (!(k in DEFAULT_I18N)) DEFAULT_I18N[k] = el.getAttribute('placeholder') || '';
  });
})();

// Текущий язык: ?lang=XX -> localStorage -> html[lang]
export function getLangFromQuery() {
  const url = new URL(location.href);
  const q = (url.searchParams.get('lang') || '').trim().toUpperCase();
  if (q) return q;
  const ls = (localStorage.getItem('site_lang') || '').toUpperCase();
  if (ls) return ls;
  const htmlLang = (document.documentElement.getAttribute('lang') || 'EN').toUpperCase();
  return htmlLang;
}

export function t(key, fallback = '…') {
  if (key in I18N) return I18N[key];
  if (key in DEFAULT_I18N) return DEFAULT_I18N[key];
  return fallback;
}

export function onLocaleChanged(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function emitLocaleChanged(lang) {
  listeners.forEach(fn => { try { fn(lang); } catch {} });
  document.dispatchEvent(new CustomEvent('locale-changed', { detail: { lang } }));
}

// Применяем переводы
export function applyI18nTo(root = document) {
  $$('[data-i18n]', root).forEach(el => {
    if (el.hasAttribute('data-i18n-skip')) return; // уважаем «живые» элементы
    const key = el.getAttribute('data-i18n');
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.innerHTML = val;
  });
  $$('[data-i18n-placeholder]', root).forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.setAttribute('placeholder', val);
  });

  // Заголовок/описание (если есть ключи)
  const titleRest = I18N['meta.titleRest'] || DEFAULT_I18N['hero.titleRest'] || 'support for Adam';
  document.title = `The Real Unreal Story — ${titleRest}`;
  if (I18N['meta.description']) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); }
    m.setAttribute('content', I18N['meta.description']);
  }
}

// Загружаем локаль из /i18n/XX.json
export async function loadLocale(lang) {
  const L = (lang || 'EN').toUpperCase();
  localStorage.setItem('site_lang', L);

  let data = {};
  try {
    const res = await fetch(`/i18n/${L}.json`, { cache: 'no-store' });
    data = res.ok ? (await res.json()) : {};
  } catch {}
  I18N = data || {};

  document.documentElement.setAttribute('lang', L.toLowerCase());
  document.documentElement.setAttribute('dir', LOCALE_DIRS[L] || 'ltr');

  applyI18nTo(document);
  emitLocaleChanged(L);
}
