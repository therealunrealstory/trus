// assets/js/core/pages/reporting/block4.js
// Block 4 — "Документы (медицинские и юридические)"
// Загружает /data/documents_index.json и отрисовывает карточки документов по группам.

import { I18N } from '../../i18n.js';

let mounted = false;
let lastLang = null;

const t = (k, f='') => I18N[k] ?? f;

export async function init(root){
  if (mounted) return; mounted = true;

  // 1) Ищем секцию: по id либо по заголовку с ключом i18n
  let section = root.querySelector('#rep-block4');
  if (!section){
    const h = root.querySelector('[data-i18n="reporting.block4.title"]');
    section = h ? h.closest('section') : null;
  }
  if (!section){ console.warn('[rep-b4] section not found'); return; }

  // 2) Внутренний контейнер-хост
  let host = section.querySelector(':scope > div');
  if (!host){ host = document.createElement('div'); section.appendChild(host); }

  injectStyles();

  host.innerHTML = `<div class="rep-b4 muted">${t('reporting.block4.loading','Loading documents…')}</div>`;

  const data = await loadDocs('/data/documents_index.json');

  if (!data || (!Array.isArray(data.medical) && !Array.isArray(data.legal)) ||
      ((data.medical?.length||0)===0 && (data.legal?.length||0)===0)) {
    host.innerHTML = `<div class="rep-b4 empty">${t('reporting.block4.empty','No documents available yet.')}</div>`;
    return;
  }

  host.innerHTML = '';
  host.appendChild(renderDocs(data));
  lastLang = getLang();
}

export function destroy(){ mounted = false; }

export async function onLocaleChanged(){
  if (!mounted) return;
  const cur = getLang(); if (cur===lastLang) return;
  lastLang = cur;

  const section = document.querySelector('#rep-block4')
    || document.querySelector('[data-i18n="reporting.block4.title"]')?.closest('section');
  const host = section?.querySelector(':scope > div'); if (!host) return;

  host.innerHTML = `<div class="rep-b4 muted">${t('reporting.block4.loading','Loading documents…')}</div>`;
  const data = await loadDocs('/data/documents_index.json');

  host.innerHTML = '';
  if (!data || ((!data.medical||!data.medical.length) && (!data.legal||!data.legal.length))){
    host.innerHTML = `<div class="rep-b4 empty">${t('reporting.block4.empty','No documents available yet.')}</div>`;
    return;
  }
  host.appendChild(renderDocs(data));
}

/* ---------------- helpers ---------------- */

async function loadDocs(url){
  try{
    const r = await fetch(url,{ cache:'no-store' });
    if (!r.ok) return null;
    return await r.json();
  }catch{ return null; }
}

function renderDocs(data){
  const wrap = document.createElement('div'); wrap.className='rep-b4 list';

  if (Array.isArray(data.medical) && data.medical.length){
    wrap.appendChild(renderGroup('medical', data.medical));
  }
  if (Array.isArray(data.legal) && data.legal.length){
    wrap.appendChild(renderGroup('legal', data.legal));
  }
  return wrap;
}

function renderGroup(kind, arr){
  const sec = document.createElement('div'); sec.className='b4-group';

  const title = document.createElement('h3');
  title.className='group-title';
  title.textContent = kind==='medical'
    ? t('reporting.block4.group.medical','Medical documents')
    : t('reporting.block4.group.legal','Legal documents');
  sec.appendChild(title);

  const grid = document.createElement('div'); grid.className='doc-grid';

  for (const d of arr){
    grid.appendChild(renderDocCard(d));
  }

  sec.appendChild(grid);
  return sec;
}

function renderDocCard(d){
  // Ожидается: { id, title, date, kind, url, thumb?, ext?, size?, summary? }
  const a = document.createElement('a');
  a.className='doc-card';
  a.href = d?.url || '#';
  a.target='_blank'; a.rel='noopener';

  const thumbBox = document.createElement('div');
  thumbBox.className='thumbbox';

  if (d?.thumb){
    const img = document.createElement('img');
    img.src = d.thumb; img.alt = d.title || '';
    img.className='thumb';
    thumbBox.appendChild(img);
  } else {
    const ph = document.createElement('div');
    ph.className = 'thumb ph';
    ph.textContent = (d?.ext || '').toUpperCase() || 'PDF';
    thumbBox.appendChild(ph);
  }

  const meta = document.createElement('div');
  meta.className='meta';

  const h4 = document.createElement('div');
  h4.className='doc-title';
  h4.textContent = d?.title || t('reporting.block4.untitled','Untitled');
  meta.appendChild(h4);

  const sub = document.createElement('div');
  sub.className='doc-sub';
  const date = safeDate(d?.date) || '';
  const ext = (d?.ext || '').toUpperCase();
  const size = d?.size ? ` • ${formatSize(d.size)}` : '';
  sub.textContent = `${date}${ext?` • ${ext}`:''}${size}`;
  meta.appendChild(sub);

  if (d?.summary){
    const sm = document.createElement('div');
    sm.className='doc-summary';
    sm.textContent = d.summary;
    meta.appendChild(sm);
  }

  // Кнопка «Open document» теперь под текстом
  const btn = document.createElement('div');
  btn.className='open-btn';
  btn.textContent = t('reporting.block4.open','Open document');

  a.appendChild(thumbBox);
  a.appendChild(meta);
  a.appendChild(btn);

  return a;
}

function injectStyles(){
  if (document.getElementById('rep-b4-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для бока храним в файлах блока*/
    .rep-b4.list { display:grid; gap:18px; }
    .b4-group { display:grid; gap:12px; background: transparent; padding: 0; border: none; }
    .b4-group .group-title { font-weight:600; opacity:.92; }
    .doc-grid { display:grid; gap:10px; grid-template-columns: 1fr; }
    @media (min-width:700px){ .doc-grid{ grid-template-columns: repeat(2, 1fr); } }
    @media (min-width:1024px){ .doc-grid{ grid-template-columns: repeat(3, 1fr); } }

    .doc-card{
      display:grid;
      grid-template-columns: 88px 1fr;     /* thumb | content */
      grid-auto-rows: auto;                /* кнопка уходит на следующую строку */
      gap:12px;
      align-items:start;
      border-radius:14px; padding:12px;
      background: rgba(0,0,0,0.18);
      text-decoration:none; color:inherit;
      border:1px solid rgba(255,255,255,0.08);
    }
    .doc-card:hover{ background: rgba(255,255,255,0.08); }

    .thumbbox{ width:88px; height:88px; display:flex; align-items:center; justify-content:center; grid-row:1 / span 2; }
    .thumb{
      max-width:100%; max-height:100%; border-radius:10px; display:block; object-fit:cover;
      background: rgba(255,255,255,0.06);
    }
    .thumb.ph{
      width:100%; height:100%; border-radius:10px; display:flex; align-items:center; justify-content:center;
      font-weight:700; letter-spacing:.04em; opacity:.85; background: rgba(255,255,255,0.06);
    }

    .meta{ display:grid; gap:4px; grid-column:2; }
    .doc-title{ font-weight:600; }
    .doc-sub{ opacity:.75; font-size:.9rem; }
    .doc-summary{ opacity:.9; font-size:.95rem; line-height:1.35; }

    /* Лёгкая "ghost"-кнопка — под текстом, выравнена по колонке контента */
    .open-btn{
      grid-column:2;                       /* под текстом, в правой колонке */
      width:fit-content;
      margin-top:6px;
      padding:8px 12px;
      border-radius:10px;
      font-size:.92rem;
      background: rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.14);
      color:rgba(231,236,243,.95);
      text-decoration:none;
      transition: background .18s ease, border-color .18s ease, transform .02s ease, color .18s ease;
      box-shadow: 0 1px 2px rgba(0,0,0,0.25);
    }
    .doc-card:hover .open-btn{
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.22);
    }
    .open-btn:active{ transform: translateY(1px); }
    .open-btn:focus-visible{
      outline:2px solid rgba(79,70,229,0.45);
      outline-offset:2px;
    }

    .rep-b4 .muted, .rep-b4 .empty{ opacity:.75; font-size:.95rem; }
  `;
  const st = document.createElement('style');
  st.id = 'rep-b4-styles';
  st.textContent = css;
  document.head.appendChild(st);
}

/* utils */
function getLang(){ return (document.documentElement.getAttribute('lang')||'').toUpperCase(); }
function safeDate(s){ return typeof s==='string' ? s : ''; }
function formatSize(n){
  const b = Number(n)||0;
  if (b < 1024) return `${b} B`;
  const kb = b/1024; if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb/1024; return `${mb.toFixed(mb<10?1:0)} MB`;
}
