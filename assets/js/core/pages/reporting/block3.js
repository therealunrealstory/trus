// assets/js/core/reporting/block3.js
// Block 3 — "Лента отчётности по расходам"
// Тянет данные из serverless: /.netlify/functions/telegram_reporting?limit=20
// Вёрстка и стили — локально внутри блока.

import { I18N } from '../../i18n.js';

let mounted = false;
let lastLang = null;

function t(key, fallback = '') { return I18N[key] ?? fallback; }

export async function init(root){
  if (mounted) return; mounted = true;

  // 1) Находим секцию (id или по заголовку)
  let section = root.querySelector('#rep-block3');
  if (!section) {
    const h = root.querySelector('[data-i18n="reporting.block3.title"]');
    section = h ? h.closest('section') : null;
  }
  if (!section) { console.warn('[rep-b3] section #rep-block3 not found'); return; }

  // 2) Внутренний контейнер-хост
  let host = section.querySelector(':scope > div');
  if (!host) { host = document.createElement('div'); section.appendChild(host); }

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
  const cur = getLang();
  if (cur === lastLang) return;  // уже применено
  lastLang = cur;

  // Перерисовываем заново (лента короткая, запрос лёгкий)
  const section = document.querySelector('#rep-block3')
     || document.querySelector('[data-i18n="reporting.block3.title"]')?.closest('section');
  const host = section?.querySelector(':scope > div');
  if (!host) return;

  host.innerHTML = `<div class="rep-b3 muted">${t('reporting.block3.loading','Loading expense reports…')}</div>`;
  const data = await loadFeed('/.netlify/functions/telegram_reporting?limit=20');
  host.innerHTML = Array.isArray(data) && data.length
    ? ''
    : `<div class="rep-b3 empty">${t('reporting.block3.empty','No expense reports yet.')}</div>`;
  if (Array.isArray(data) && data.length) host.appendChild(renderFeed(data));
}

/* helpers */

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

  for (const it of items){
    wrap.appendChild(renderItem(it));
  }
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
  amt.textContent = hasAmt
    ? `${Number(x.amount)} ${x?.currency || ''}`.trim()
    : t('reporting.block3.noamount','—');
  top.appendChild(time);
  top.appendChild(amt);

  const body = document.createElement('div');
  body.className = 'body';
  body.innerHTML = escapeHtml((x?.text || '').replace(/\n/g,'\n'))
    .replace(/\n/g,'<br>');

  const meta = document.createElement('div');
  meta.className = 'meta';

  // теги (например: "meds", "hospital", "transport")
  if (Array.isArray(x?.tags) && x.tags.length){
    const tg = document.createElement('div');
    tg.className = 'tags';
    tg.innerHTML = x.tags.map(s=>`<span class="chip">${escapeHtml(String(s))}</span>`).join('');
    meta.appendChild(tg);
  }

  // исходная ссылка
  if (x?.link){
    const a = document.createElement('a');
    a.href = x.link; a.target = '_blank'; a.rel='noopener';
    a.className = 'open-link';
    a.textContent = t('reporting.block3.open','Open source post');
    meta.appendChild(a);
  }

  card.appendChild(top);
  card.appendChild(body);
  if (meta.childNodes.length) card.appendChild(meta);

  return card;
}

function injectStyles(){
  if (document.getElementById('rep-b3-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для бока храним в файлах блока*/
    .rep-b3.list { background: transparent; padding: 0; } /* список без подложки */
    .b3-card{
      border-radius:14px; padding:12px;
      background: rgba(0,0,0,0.18);   /* ВОЗВРАЩАЕМ подложку внутренним отсекам */
      border:1px solid rgba(255,255,255,0.08);
    }
    .b3-card .row.top{ display:flex; align-items:center; gap:10px; }
    .b3-card .time{ font-size:.85rem; opacity:.8 }
    .b3-card .amt{ margin-left:auto; font-weight:600; }
    .b3-card .body{ margin-top:6px; line-height:1.45; font-size:.95rem; }
    .b3-card .meta{ margin-top:8px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
    .b3-card .chip{
      font-size:.75rem; padding:2px 8px; border-radius:999px;
      border:1px solid rgba(255,255,255,0.14); color:rgba(231,236,243,.9);
      background:rgba(255,255,255,0.04);
    }
    .rep-b3 .open-link{ text-decoration:underline; }
    .rep-b3 .muted, .rep-b3 .empty{ opacity:.75; font-size:.95rem; }
    @media (min-width:700px){ .b3-card{ padding:14px 16px } }
  `;
  const st = document.createElement('style');
  st.id = 'rep-b3-styles';
  st.textContent = css;
  document.head.appendChild(st);
}

/* utils */
function getLang(){ return (document.documentElement.getAttribute('lang')||'').toUpperCase(); }
function safeTime(s){
  if (!s) return '';
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toLocaleString() : String(s);
}
function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
