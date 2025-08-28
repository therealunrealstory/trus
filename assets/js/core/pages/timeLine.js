// assets/js/core/pages/timeline.js
import { mount as mountLegal, unmount as unmountLegal } from '../../features/legalTimeline.js';
import { I18N, applyI18nTo, onLocaleChanged as onI18NLocaleChanged, getLangFromQuery } from '../i18n.js';

let Roadmap = null;
let cleanup = [];

/* ---------- robust partial loader ---------- */

function stripCommentsAndCommas(raw) {
  // убираем BOM
  let s = raw.replace(/^\uFEFF/, '');
  // блок-комментарии /* ... */
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // построчные // ... (вне строк)
  s = s.replace(/^[ \t]*\/\/.*$/gm, '');
  // висящие запятые перед } или ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // .join("") → превращаем обратно в массив
  s = s.replace(/\]\s*\.join\(\s*(["'`])\1\s*\)/g, ']');
  return s;
}

async function loadPartial(name) {
  const res = await fetch(`partials/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load partial: ${name}`);

  // читаем как текст и чистим
  const raw = await res.text();
  const cleaned = stripCommentsAndCommas(raw);

  // 1) пробуем обычный JSON.parse
  try {
    const json = JSON.parse(cleaned);
    let html = json.html ?? json.markup ?? json.content ?? json.innerHTML ?? '';
    if (Array.isArray(html)) html = html.join('');
    return String(html || '');
  } catch {
    // 2) fallback-парсер: вытаскиваем строку-массив под ключом "html": ["...","..."]
    const s = cleaned;
    const key = '"html"';
    const idx = s.indexOf(key);
    if (idx !== -1) {
      let i = idx + key.length;
      // ищем двоеточие
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === ':') i++;
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === '[') {
        let start = i;
        let depth = 0; let inStr = false; let end = -1; let esc = false;
        for (; i < s.length; i++) {
          const ch = s[i];
          if (inStr) {
            if (esc) { esc = false; }
            else if (ch === '\\') { esc = true; }
            else if (ch === '"') { inStr = false; }
          } else {
            if (ch === '"') { inStr = true; continue; }
            if (ch === '[') depth++;
            else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
          }
        }
        if (end !== -1) {
          const arrBody = s.slice(start, end + 1); // ["…","…"]
          const strings = arrBody.match(/"(?:\\.|[^"\\])*"/g) || [];
          const parts = strings.map(strLit => JSON.parse(strLit));
          return parts.join('');
        }
      }
    }
    // 3) запасной путь: "html": "....."
    const m = s.match(/"html"\s*:\s*("(?:\\.|[^"\\])*")/);
    if (m && m[1]) {
      const htmlStr = JSON.parse(m[1]);
      return String(htmlStr);
    }
    throw new Error(`Partial ${name}: cannot extract html`);
  }
}

/* ---------- i18n loader for reporting.* (нужен для Block4) ---------- */

async function loadReportingLocale(lang){
  const L = (lang || 'EN').toUpperCase();
  async function fetchJson(url){
    try{ const r = await fetch(url, { cache:'no-store' }); return r.ok ? r.json() : null; }
    catch{ return null; }
  }
  let data = await fetchJson(`/i18n/reporting/${L}.json`);
  if (!data && L !== 'EN') data = await fetchJson(`/i18n/reporting/EN.json`);
  if (!data) data = {};
  for (const k in data) I18N[k] = data[k]; // мягкий merge только reporting.*
}

/* ---------- page lifecycle ---------- */

export async function init(rootEl) {
  const el = rootEl || document.querySelector('#subpage');
  if (!el) return;

  // 1) Юридическая лента (как было)
  const legalRoot = el.querySelector('#legal-timeline');
  if (legalRoot) {
    try {
      mountLegal(legalRoot);
      cleanup.push(() => { try { unmountLegal(); } catch {} });
    } catch (e) {
      console.error('[timeline] mount legal failed:', e);
    }
  }

  // 2) Медицинская лента (как было): partial + roadmap.js
  const medRoot = el.querySelector('#medical-timeline');
  if (medRoot) {
    try {
      const roadmapHtml = await loadPartial('roadmap');
      medRoot.innerHTML = roadmapHtml;

      const mod = Roadmap || (Roadmap = await import('./roadmap.js'));
      await mod.init(medRoot);
      cleanup.push(() => { try { mod.destroy?.(); } catch {} });
    } catch (e) {
      medRoot.innerHTML = '<div class="mtl-error">Failed to load medical timeline.</div>';
      console.error('[timeline] medical block failed:', e);
    }
  }

  // 3) Документы (перенесённый Reporting → Block4), аккуратно добавляем секцию снизу
  try{
    // создаём контейнер, которого ждёт block4.js
    const docsSection = document.createElement('section');
    docsSection.id = 'rep-block4';

    // Заголовок (для консистентности), блок не зависит от него
    const h = document.createElement('h2');
    h.className = 'h2';
    h.setAttribute('data-i18n','reporting.block4.title');
    h.textContent = 'Documents'; // fallback на случай отсутствия локали
    docsSection.appendChild(h);

    // Внутренний host (block4.js рендерит внутрь первого div)
    const host = document.createElement('div');
    docsSection.appendChild(host);

    // Добавляем секцию в конец страницы
    el.appendChild(docsSection);

    // Загрузим локаль reporting.* и применим i18n для заголовка
    const startLang = (typeof getLangFromQuery === 'function') ? getLangFromQuery() : undefined;
    await loadReportingLocale(startLang);
    await applyI18nTo(docsSection);

    // Импортируем и инициализируем сам блок документов
    const b4 = await import('./reporting/block4.js');
    await b4.init(el); // block4 сам найдёт #rep-block4 внутри root

    // При смене языка — подгружаем локаль reporting.*, обновляем заголовок и сам блок
    const un = onI18NLocaleChanged(async ({ lang }) => {
      try {
        await loadReportingLocale(lang);
        await applyI18nTo(docsSection);
        if (typeof b4.onLocaleChanged === 'function') {
          await b4.onLocaleChanged(lang, el);
        }
      } catch (err) {
        console.warn('[timeline] block4 locale refresh failed:', err);
      }
    });
    cleanup.push(un);
  } catch (e){
    console.error('[timeline] documents block failed:', e);
  }
}

export function destroy() {
  try { unmountLegal(); } catch {}
  cleanup.forEach(fn => { try { fn(); } catch {} });
  cleanup = [];
}
