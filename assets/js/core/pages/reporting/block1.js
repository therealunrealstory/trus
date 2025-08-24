// assets/js/core/pages/reporting/block1.js
// Block 1 — "Финансовые метрики" (Collected / Spent / Planned / Over-norm)
// Загружает /data/funds.json, считает агрегаты и рендерит 4 метрики.
// Визуал — компактные плитки; спец-стили локально, остальное — из общих стилей.

import { I18N } from '../../i18n.js';
const t = (k, f='') => I18N[k] ?? f;

let mounted = false;
let lastLang = null;

export async function init(root){
  if (mounted) return; mounted = true;

  // 1) Найти секцию — по id или по заголовку (i18n)
  let section = root.querySelector('#rep-block1');
  if (!section) {
    const h = root.querySelector('[data-i18n="reporting.block1.title"]');
    section = h ? h.closest('section') : null;
  }
  if (!section) { console.warn('[rep-b1] section not found'); return; }

  // 2) Хост-контейнер (внутренний <div> подложки)
  let host = section.querySelector(':scope > div');
  if (!host) { host = document.createElement('div'); section.appendChild(host); }

  injectStyles();

  host.innerHTML = `<div class="rep-b1 muted">${t('reporting.block1.loading','Loading financial metrics…')}</div>`;

  // 3) Загрузка данных
  const data = await loadFunds('/data/funds.json');
  if (!data) {
    host.innerHTML = `<div class="rep-b1 empty">${t('reporting.block1.empty','No financial data yet.')}</div>`;
    return;
  }

  // 4) Расчёты
  const {
    currency = 'USD',
    collected = [],
    spent = [],
    planned = [],
    norm = { target: 0 }
  } = data;

  const totalCollected = lastValue(collected) ?? 0;
  const totalSpent     = sum(spent, 'amount');
  const totalPlanned   = sum(planned, 'amount');
  const normTarget     = Number(norm?.target) || 0;

  const overNormAmount  = Math.max(0, totalCollected - normTarget);
  const overNormPercent = normTarget > 0 ? (totalCollected / normTarget) * 100 : 0;

  // 5) Рендер
  host.innerHTML = '';
  host.appendChild(renderMetrics({
    currency, totalCollected, totalSpent, totalPlanned, normTarget, overNormAmount, overNormPercent,
    updatedAt: data.updated_at || null
  }));

  lastLang = getLang();
}

export function destroy(){ mounted = false; }

export async function onLocaleChanged(){
  if (!mounted) return;
  const cur = getLang(); if (cur === lastLang) return;
  lastLang = cur;

  const section = document.querySelector('#rep-block1')
    || document.querySelector('[data-i18n="reporting.block1.title"]')?.closest('section');
  const host = section?.querySelector(':scope > div'); if (!host) return;

  host.innerHTML = `<div class="rep-b1 muted">${t('reporting.block1.loading','Loading financial metrics…')}</div>`;
  const data = await loadFunds('/data/funds.json');
  if (!data) {
    host.innerHTML = `<div class="rep-b1 empty">${t('reporting.block1.empty','No financial data yet.')}</div>`;
    return;
  }
  const { currency='USD', collected=[], spent=[], planned=[], norm={target:0} } = data;
  const totalCollected = lastValue(collected) ?? 0;
  const totalSpent     = sum(spent, 'amount');
  const totalPlanned   = sum(planned, 'amount');
  const normTarget     = Number(norm?.target) || 0;
  const overNormAmount  = Math.max(0, totalCollected - normTarget);
  const overNormPercent = normTarget > 0 ? (totalCollected / normTarget) * 100 : 0;

  host.innerHTML = '';
  host.appendChild(renderMetrics({
    currency, totalCollected, totalSpent, totalPlanned, normTarget, overNormAmount, overNormPercent,
    updatedAt: data.updated_at || null
  }));
}

/* ---------------- helpers ---------------- */

async function loadFunds(url){
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function renderMetrics(m){
  const wrap = document.createElement('div');
  wrap.className = 'rep-b1 grid';

  // Плитка 1: Collected
  wrap.appendChild(tile({
    label: t('reporting.block1.collected','Collected'),
    value: fmtMoney(m.totalCollected, m.currency),
    sub:   m.normTarget ? `${t('reporting.block1.ofTarget','of target')}: ${fmtMoney(m.normTarget, m.currency)}` : ''
  }));

  // Плитка 2: Spent
  wrap.appendChild(tile({
    label: t('reporting.block1.spent','Spent'),
    value: fmtMoney(m.totalSpent, m.currency),
    sub:   t('reporting.block1.spent.note','Cumulative expenses')
  }));

  // Плитка 3: Planned
  wrap.appendChild(tile({
    label: t('reporting.block1.planned','Planned'),
    value: fmtMoney(m.totalPlanned, m.currency),
    sub:   t('reporting.block1.planned.note','Expected upcoming costs')
  }));

  // Плитка 4: Over-norm
  const pct = clamp(m.overNormPercent, 0, 200); // позволь до 200% на прогрессе
  const bar = progress(pct, m.normTarget ? `${pct.toFixed(0)}%` : '—');
  wrap.appendChild(tile({
    label: t('reporting.block1.overnorm','Over‑norm'),
    value: m.normTarget ? fmtMoney(m.overNormAmount, m.currency) : '—',
    subNode: bar
  }));

  // Доп. подпись "Updated"
  if (m.updatedAt){
    const upd = document.createElement('div');
    upd.className = 'updated muted';
    upd.textContent = `${t('reporting.block1.updated','Updated')}: ${safeDate(m.updatedAt)}`;
    wrap.appendChild(upd);
  }

  return wrap;
}

function tile({ label, value, sub='', subNode=null }){
  const el = document.createElement('div');
  el.className = 'b1-tile';
  const l = document.createElement('div'); l.className='label'; l.textContent = label;
  const v = document.createElement('div'); v.className='value'; v.textContent = value;
  el.appendChild(l); el.appendChild(v);

  if (subNode){
    const box = document.createElement('div'); box.className='sub'; box.appendChild(subNode);
    el.appendChild(box);
  } else if (sub){
    const s = document.createElement('div'); s.className='sub muted'; s.textContent = sub;
    el.appendChild(s);
  }
  return el;
}

function progress(pct, text){
  const box = document.createElement('div');
  box.className = 'b1-progress';
  const track = document.createElement('div'); track.className='track';
  const fill  = document.createElement('div'); fill.className='fill';
  fill.style.width = `${pct}%`;
  const label = document.createElement('div'); label.className='ptext'; label.textContent = text;
  track.appendChild(fill);
  box.appendChild(track);
  box.appendChild(label);
  return box;
}

function lastValue(series){
  // series: [{date:"YYYY-MM-DD", value:Number}, ...] кумулятив
  if (!Array.isArray(series) || series.length===0) return null;
  const last = series[series.length - 1];
  return Number(last?.value) || 0;
}

function sum(arr, key){
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, it) => acc + (Number(it?.[key]) || 0), 0);
}

function fmtMoney(n, cur){
  const v = Number(n) || 0;
  try{
    return new Intl.NumberFormat(undefined, { style:'currency', currency: cur }).format(v);
  }catch{
    // если валюта неизвестна в Intl
    return `${v.toLocaleString()} ${cur}`;
  }
}

function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function getLang(){ return (document.documentElement.getAttribute('lang')||'').toUpperCase(); }
function safeDate(s){ return typeof s==='string' ? s : ''; }

function injectStyles(){
  if (document.getElementById('rep-b1-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для бока храним в файлах блока*/
    .rep-b1.grid{
      display:grid; gap:14px;
      background: transparent !important;
      padding: 0 !important;
      border: 0 !important;
    }
    .b1-tile{
      display:grid; gap:6px;
      border-radius:14px; padding:12px;
      background: rgba(0,0,0,0.18);   /* подложка у плиток */
      border: 0;                      /* без рамок */
    }
    .b1-tile .label{ opacity:.8; font-size:.95rem; }
    .b1-tile .value{ font-weight:700; font-size:1.1rem; }
    .b1-tile .sub{ font-size:.9rem; }
    .rep-b1 .updated{ font-size:.85rem; margin-top:2px; opacity:.75; }

    .b1-progress .track{
      width:100%; height:8px; border-radius:999px; background:rgba(255,255,255,0.12); overflow:hidden;
    }
    .b1-progress .fill{ height:8px; width:0; background:rgba(255,255,255,0.55); }
    .b1-progress .ptext{ margin-top:6px; font-size:.9rem; opacity:.85; }

    @media (min-width:700px){
      .rep-b1.grid{ grid-template-columns: repeat(2, 1fr); }
      .rep-b1 .updated{ grid-column: 1 / -1; }
    }
    @media (min-width:1024px){
      .rep-b1.grid{ grid-template-columns: repeat(4, 1fr); }
    }
  `;
  const st = document.createElement('style');
  st.id = 'rep-b1-styles';
  st.textContent = css;
  document.head.appendChild(st);
}
