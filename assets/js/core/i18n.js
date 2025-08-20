import { $, $$ } from './dom.js';

export const LOCALE_DIRS = { AR:"rtl", CN:"ltr", DE:"ltr", EN:"ltr", ES:"ltr", FR:"ltr", IT:"ltr", PT:"ltr", RU:"ltr" };

export let I18N = {};
export const DEFAULT_I18N = {};

// Собираем дефолтные строки из разметки один раз
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

export function t(key, fallback){
  return (I18N && I18N[key]) ?? DEFAULT_I18N[key] ?? fallback;
}

async function fetchLocaleJson(lang){
  try { const r1 = await fetch(`i18n/${lang}.json`, { cache: 'no-store' }); if (r1.ok) return await r1.json(); } catch {}
  try { const r2 = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' }); if (r2.ok) return await r2.json(); } catch {}
  return null;
}

export async function loadLocale(lang) {
  try {
    const data = await fetchLocaleJson(lang);
    I18N = data || {}; 
  } catch { I18N = {}; }

  document.documentElement.lang = (lang || 'en').toLowerCase();
  document.documentElement.dir  = LOCALE_DIRS[lang] || 'ltr';

  const titleRest = I18N['meta.titleRest'] || DEFAULT_I18N['hero.titleRest'] || 'support for Adam';
  document.title = `The Real Unreal Story — ${titleRest}`;

  if (I18N['meta.description']) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); }
    m.setAttribute('content', I18N['meta.description']);
  }

  // Применить к документу — глобальные надписи (шапка/футер/меню)
  applyI18nTo(document);
}

export function applyI18nTo(root){
  $$('[data-i18n]', root).forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.innerHTML = val;
  });
  $$('[data-i18n-placeholder]', root).forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.setAttribute('placeholder', val);
  });
}
