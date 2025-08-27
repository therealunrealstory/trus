// assets/js/core/reporting/block3.js
// Block 3 — "Лента отчётности по расходам"
// Берёт данные из /.netlify/functions/telegram_reporting?limit=20

import { I18N } from '../../i18n.js';

let mounted = false;
let lastLang = null;

const t = (k, f='') => I18N[k] ?? f;

export async function init(root){
  if (mounted) return; mounted = true;

  // 1) Находим секцию по id или по заголовку
  let section = root.querySelector('#rep-block3');
  if (!section){
    const h = root.querySelector('[data-i18n="reporting.block3.title"]');
    section = h ? h.closest('section') : null;
  }
  if (!section){ console.warn('[rep-b3] section not found'); return; }

  // 2) Хост для списка (делаем его "подложкой" + правильная рамка)
  let host = section.querySelector(':scope > div');
  if (!host){ host = document.createElement('div'); section.appendChild(host); }
  host.classList.remove('border','border-gray-700','rounded-2xl','p-4'); // вдруг остались старые классы
  host.classList.add('b3-pane');

  injectStyles();

  host.innerHTML = `<div class="rep-b3 muted">${t('reporting.block3.loading','Loading expense reports…')}</div>`;
  const data = await loadFeed('/.netlify/functions/telegram_reporting?limit=20');

  if (!Array.isArray(data) || data.length === 0){
    host.innerHTML = `<div class="rep-b3 empty">${t('reporting.block3.empty','No expense reports yet.')}</div>`;
    return;
  }

  host.innerHTML = '';
  host.appendChild(renderFeed(data));
  lastLang = getLang();
}

export function destroy(){ mounted = false; }

export async function onLocaleChanged(){
  if (!mounted) return;
  const cur = getLang(); if (cur === lastLang) return;
  lastLang = cur;

  const section = document.querySelector('#rep-block3')
    || document.querySelector('[data-i18n="reporting.block3.title"]')?.closest('section');
  const host = section?.querySelector(':scope > div');
  if (!host) return;

  host.innerHTML = `<div class="rep-b3 muted">${t('reporting.block3.loading','Loading expense reports…')}</div>`;
  const data = await loadFeed('/.netlify/functions/telegram_reporting?limit=20');
  host.innerHTML = '';
  host.appendChild(
    Array.isArray(data) && data.length
      ? renderFeed(data)
      : (()=>{ const d=document.createElement('div'); d.className='rep-b3 empty'; d.textContent=t('reporting.block3.empty','No expense reports yet.'); return d; })()
  );
}

/* ---------- helpers ---------- */

async function loadFeed(url){
  try{
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) return [];
    const json = await r.json();
    return Array.isArray(json) ? json : [];
  }catch{ return []; }
}

function renderFeed(items){
  const wrap = document.createElement('div');
  wrap.className = 'rep-b3 list';
  for (const it of items) wrap.appendChild(renderItem(it));
  return wrap;
}

function renderItem(x){
  // ожидаемые поля: date, text, amount, currency, tags[], link
  const card = document.createElement('article');
  card.className = 'b3-card';

  const top = document.createElement('div');
  top.className = 'row top';

  const time = document.createElement('div');
  time.className = 'time';
  time.textContent = safeTime(x?.date);

  const amt = document.createElement('div');
  amt.className = 'amt';
  const hasAmt = Number.isFinite(Number(x?.amount));
  amt.textContent = hasAmt ? `${Number(x.amount)} ${x?.currency || ''}`.trim() : t('reporting.block3.noamount','—');

  const body = document.createElement('div');
  body.className = 'body';
  body.innerHTML = escapeHtml((x?.text || '').replace(/\n/g,'\n')).replace(/\n/g,'<br>');

  const meta = document.createElement('div'); meta.className = 'meta';

  if (Array.isArray(x?.tags) && x.tags.length){
    const tg = document.createElement('div'); tg.className = 'tags';
    tg.innerHTML = x.tags.map(s=>`<span class="chip">${escapeHtml(String(s))}</span>`).join('');
    meta.appendChild(tg);
  }

  if (x?.link){
    const a = document.createElement('a');
    a.href = x.link; a.target = '_blank'; a.rel = 'noopener';
    a.className = 'open-link';
    a.textContent = t('reporting.block3.open','Open source post');
    meta.appendChild(a);
  }

  top.appendChild(time); top.appendChild(amt);
  card.appendChild(top); card.appendChild(body);
  if (meta.childNodes.length) card.appendChild(meta);

  return card;
}

function getLang(){ return (document.documentElement.getAttribute('lang')||'').toUpperCase(); }
function safeTime(s){ const d = new Date(s||''); return Number.isFinite(d.getTime()) ? d.toLocaleString() : ''; }
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[m])); }

function injectStyles(){
  if (document.getElementById('rep-b3-styles')) return;
  const css = `
    /* Подложка списка (как у Legal Timeline .roadmap-body) */
    .b3-pane{
      background: rgba(0,0,0,0.20);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 10px;
    }

    /* Сетка карточек */
    .rep-b3.list{ display:grid; gap:10px; }

    /* Карточка операции */
    .b3-card{
      border-radius:14px;
      padding:12px;
      background:rgba(255,255,255,0.04);
      border:1px solid rgba(255,255,255,0.10);
    }
    .b3-card .row.top{ display:flex; align-items:center; gap:10px; }
    .b3-card .time{ font-size:.85rem; opacity:.8 }
    .b3-card .amt{ margin-left:auto; font-weight:600; }
    .b3-card .body{ margin-top:6px; line-height:1.45; font-size:.95rem; }
    .b3-card .meta{ margin-top:8px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .b3-card .chip{
      font-size:.75rem; padding:2px 8px; border-radius:999px;
      border:1px solid rgba(255,255,255,0.14);
      color:rgba(231,236,243,0.9);
      background:rgba(255,255,255,0.04);
    }

    .rep-b3 .open-link{ text-decoration:underline; }
    .rep-b3 .muted, .rep-b3 .empty{ opacity:.75; font-size:.95rem; }
    @media (min-width:700px){ .b3-card{ padding:14px 16px } }
  `;
  const st = document.createElement('style'); st.id='rep-b3-styles'; st.textContent=css;
  document.head.appendChild(st);
}
