// assets/js/core/pages/reporting.js
import { $ } from '../dom.js';
import { I18N, applyI18nTo, onLocaleChanged, getLangFromQuery } from '../i18n.js';

let unLocale;
let blocks = [];

/* Подгрузка локали страницы Reporting */
async function loadReportingLocale(lang) {
  const L = (lang || 'EN').toUpperCase();
  async function fetchJson(url) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  }
  let data = await fetchJson(`/i18n/reporting/${L}.json`);
  if (!data && L !== 'EN') data = await fetchJson(`/i18n/reporting/EN.json`);
  if (!data) data = {};
  for (const k in data) I18N[k] = data[k]; // мягкий merge только reporting.*
}

export async function init(root) {
  const pageRoot = root || document;
  const sub = document.getElementById('subpage');
  if (sub) sub.classList.add('page--reporting');

  // Локали страницы
  const startLang = getLangFromQuery();
  await loadReportingLocale(startLang);
  await applyI18nTo(pageRoot);

  // Динамически подключаем блоки (каждый — изолированный модуль)
  //Временно коментирую часть кода, чтобы скрыть block4
//  const [b1, b2, b3, b4] = await Promise.all([
//    import('./reporting/block1.js'),
//    import('./reporting/block2.js'),
//    import('./reporting/block3.js'),
//    import('./reporting/block4.js'),
//  ]);
//  blocks = [b1, b2, b3, b4];
  
    const [b1, b2, b3] = await Promise.all([
    import('./reporting/block1.js'),
    import('./reporting/block2.js'),
    import('./reporting/block3.js'),
  ]);
  blocks = [b1, b2, b3];

  // Инициализация каждого блока
  for (const b of blocks) {
    try { await b.init(pageRoot); } catch (e) { console.error('Reporting block init error:', e); }
  }

  // На смену языка — применяем i18n; блоки могут переинициализироваться по необходимости
  unLocale = onLocaleChanged(async ({ lang }) => {
    await loadReportingLocale(lang);
    await applyI18nTo(pageRoot);
    for (const b of blocks) {
      if (typeof b.onLocaleChanged === 'function') {
        try { await b.onLocaleChanged(lang, pageRoot); } catch {}
      }
    }
  });
}

export function destroy() {
  for (const b of blocks) {
    try { b.destroy && b.destroy(); } catch {}
  }
  blocks = [];
  if (unLocale) { try { unLocale(); } catch {} unLocale = null; }
  const sub = document.getElementById('subpage');
  if (sub) sub.classList.remove('page--reporting');
}
