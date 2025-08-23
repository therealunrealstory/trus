// assets/js/core/pages/timeline.js
import { mount as mountLegal, unmount as unmountLegal } from '../../features/legalTimeline.js';

let Roadmap = null;
let cleanup = [];

/* ---------- robust partial loader ---------- */

function stripCommentsAndCommas(raw) {
  // убираем BOM
  let s = raw.replace(/^\uFEFF/, '');
  // блок-комментарии /* ... */
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  // построчные // ...
  s = s.replace(/(^|[^:])\/\/.*$/gm, '$1');
  // убираем висящие запятые перед } или ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  // если встретится "].join("")" — удаляем хвост, оставляем чистый JSON-массив
  s = s.replace(/\]\.join\(\s*["']{0,1}["']{0,1}\s*\)/g, ']');
  return s.trim();
}

function sliceFirstJsonObject(cleaned) {
  // Находим первый полноценный JSON-объект или массив в тексте и возвращаем его срез
  const startIdxObj = cleaned.indexOf('{');
  const startIdxArr = cleaned.indexOf('[');
  let start = -1, opener = '', closer = '';
  if (startIdxObj !== -1 && (startIdxArr === -1 || startIdxObj < startIdxArr)) {
    start = startIdxObj; opener = '{'; closer = '}';
  } else if (startIdxArr !== -1) {
    start = startIdxArr; opener = '['; closer = ']';
  }
  if (start === -1) return null;

  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = false; continue; }
      continue;
    } else {
      if (ch === '"') { inStr = true; continue; }
      if (ch === opener) { depth++; }
      else if (ch === closer) { depth--; if (depth === 0) return cleaned.slice(start, i + 1); }
    }
  }
  return null;
}

async function loadPartial(name) {
  const res = await fetch(`partials/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load partial: ${name}`);

  const raw = await res.text();
  const cleaned = stripCommentsAndCommas(raw);
  const firstJson = sliceFirstJsonObject(cleaned);
  if (!firstJson) throw new Error(`No JSON found in partial: ${name}`);

  const json = JSON.parse(firstJson);
  let html = json.html ?? json.markup ?? json.content ?? json.innerHTML ?? '';
  if (Array.isArray(html)) html = html.join('');
  return String(html);
}

/* ---------- page lifecycle ---------- */

export async function init(rootEl) {
  const el = rootEl || document.querySelector('#subpage');
  if (!el) return;

  const legalRoot = el.querySelector('#legal-timeline');
  const medRoot   = el.querySelector('#medical-timeline');

  // 1) Юридическая
  if (legalRoot) {
    try { mountLegal(legalRoot); } catch (e) { console.error('[timeline] mount legal failed:', e); }
  }

  // 2) Медицинская — сначала подгружаем её partial, затем инициализируем модуль
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
}

export function destroy() {
  try { unmountLegal(); } catch {}
  cleanup.forEach(fn => { try { fn(); } catch {} });
  cleanup = [];
}
