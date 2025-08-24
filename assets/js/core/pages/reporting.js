// assets/js/core/pages/reporting.js
import { $ } from '../dom.js';
import { I18N, applyI18nTo, onLocaleChanged, getLangFromQuery } from '../i18n.js';

let unLocale;
let pageEl;

/**
 * Подгружаем локаль для страницы Reporting:
 * /i18n/reporting/<LANG>.json, при ошибке — /i18n/reporting/EN.json
 * Мержим в I18N без трогания глобальных ключей (их просто дополняем).
 */
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

  // ✅ Мягкий merge в I18N (перекрываем/добавляем только ключи reporting.*)
  for (const k in data) I18N[k] = data[k];
}

export async function init(root) {
  // Помечаем страницу классом (как в support.js)
  const sub = document.getElementById('subpage');
  if (sub) sub.classList.add('page--reporting');
  pageEl = root || document;

  // Загрузка локали страницы и применение
  const startLang = getLangFromQuery();
  await loadReportingLocale(startLang);
  await applyI18nTo(pageEl);

  // Подписка на смену языка — перезагрузим только локаль страницы и пере‑применим i18n
  unLocale = onLocaleChanged(async ({ lang }) => {
    await loadReportingLocale(lang);
    await applyI18nTo(pageEl);
  });
}

export function destroy() {
  if (unLocale) { try { unLocale(); } catch {} unLocale = null; }
  const sub = document.getElementById('subpage');
  if (sub) sub.classList.remove('page--reporting');
}
