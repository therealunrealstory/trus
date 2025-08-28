// assets/js/core/pages/timeline.js
import { mount as mountLegal, unmount as unmountLegal } from '../../features/legalTimeline.js';
import { I18N, applyI18nTo, onLocaleChanged as onI18NLocaleChanged, getLangFromQuery } from '../i18n.js';

let Roadmap = null;
let cleanup = [];

/* ---------- robust partial loader ---------- */

function stripCommentsAndCommas(raw) {
  let s = raw.replace(/^\uFEFF/, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/^[ \t]*\/\/.*$/gm, '');
  s = s.replace(/,(\s*[}\]])/g, '$1');
  s = s.replace(/\]\s*\.join\(\s*(["'`])\1\s*\)/g, ']');
  return s;
}

async function loadPartial(name) {
  const res = await fetch(`partials/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load partial: ${name}`);
  const raw = await res.text();
  const cleaned = stripCommentsAndCommas(raw);

  try {
    const json = JSON.parse(cleaned);
    let html = json.html ?? json.markup ?? json.content ?? json.innerHTML ?? '';
    if (Array.isArray(html)) html = html.join('');
    return String(html || '');
  } catch {
    const s = cleaned;
    const key = '"html"';
    const idx = s.indexOf(key);
    if (idx !== -1) {
      let i = idx + key.length;
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === ':') i++;
      while (i < s.length && /\s/.test(s[i])) i++;
      if (s[i] === '[') {
        let start = i, depth = 0, inStr = false, end = -1, esc = false;
        for (; i < s.length; i++) {
          const ch = s[i];
          if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === '"') inStr = false;
          } else {
            if (ch === '"') { inStr = true; continue; }
            if (ch === '[') depth++;
            else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
          }
        }
        if (end !== -1) {
          const arrBody = s.slice(start, end + 1);
          const strings = arrBody.match(/"(?:\\.|[^"\\])*"/g) || [];
          const parts = strings.map(strLit => JSON.parse(strLit));
          return parts.join('');
        }
      }
    }
    const m = s.match(/"html"\s*:\s*("(?:\\.|[^"\\])*")/);
    if (m && m[1]) return String(JSON.parse(m[1]));
    throw new Error(`Partial ${name}: cannot extract html`);
  }
}

/* ---------- i18n loader for reporting.* (нужен для Block4) ---------- */

async function loadReportingLocale(lang){
  const L = (lang || 'EN').toUpperCase();

  async function fetchJson(url){
    try{
      const r = await fetch(url, { cache:'no-store' });
      if (!r.ok) return null;
      const txt = (await r.text() || '').trim();
      if (!txt || (txt[0] !== '{' && txt[0] !== '[')) return null;
      try { return JSON.parse(txt); } catch { return null; }
    }catch{ return null; }
  }

  let data = await fetchJson(`/i18n/reporting/${L}.json`);
  if (!data && L !== 'EN') data = await fetchJson(`/i18n/reporting/EN.json`);
  if (!data) data = {};

  for (const k in data) I18N[k] = data[k];
}

/* ---------- page lifecycle ---------- */

export async function init(rootEl) {
  const el = rootEl || document.querySelector('#subpage');
  if (!el) return;

  // 1) Legal Timeline
  const legalRoot = el.querySelector('#legal-timeline');
  if (legalRoot) {
    try {
      mountLegal(legalRoot);
      cleanup.push(() => { try { unmountLegal(); } catch {} });
    } catch (e) {
      console.error('[timeline] mount legal failed:', e);
    }
  }

  // 2) Medical Timeline
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

  // 3) Documents (перенесённый Reporting → Block4)
  try{
    // Секция, которую ищет block4.js
    const docsSection = document.createElement('section');
    docsSection.id = 'rep-block4';

    // Заголовок в стиле как у других блоков
    const h = document.createElement('h2');
    h.className = 'roadmap-title';         // стиль как у Medical/Legal
    h.setAttribute('data-i18n','reporting.block4.title');
    h.textContent = 'Documents';           // fallback
    docsSection.appendChild(h);

    // Host для контента блока (увеличенный отступ сверху)
    const host = document.createElement('div');
    host.style.marginTop = '16px';
    docsSection.appendChild(host);

    // Добавляем секцию в конец страницы
    el.appendChild(docsSection);

    // Локаль reporting.* + применение i18n
    const startLang = (typeof getLangFromQuery === 'function') ? getLangFromQuery() : undefined;
    await loadReportingLocale(startLang);
    await applyI18nTo(docsSection);

    // Подключаем и инициализируем блок документов
    const b4 = await import('./reporting/block4.js');
    await b4.init(el); // block4 сам найдёт #rep-block4

    // Надёжное обновление при смене языка
    const un = onI18NLocaleChanged(async ({ lang }) => {
      try {
        await loadReportingLocale(lang);
        await applyI18nTo(docsSection);

        if (typeof b4.onLocaleChanged === 'function') {
          await b4.onLocaleChanged();      // пусть блок сам перерисуется
        }

        // Страховка: если по какой-то причине пусто — пересоздаём контент блока
        const hostNow = docsSection.querySelector(':scope > div');
        if (!hostNow || hostNow.children.length === 0) {
          await b4.init(el);
        }
      } catch (err) {
        console.warn('[timeline] block4 locale refresh failed:', err);
        // В крайнем случае пробуем ре-инициализацию
        try { await b4.init(el); } catch {}
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