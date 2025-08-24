// assets/js/core/pages/reporting/block1.js
// Блок 1 — Funds (Collected / Spent / Planned / Available) по плану db7a3031…
// Источник данных: /data/funds.json (meta + collected/spent/planned с мультиязычными note).
// Карточки: мягкие фоны (Cyan/Red/Amber/Green), модалки: горизонтальные линии Indigo-600.
// Дизайн страницы не меняем — только локальные стили блока + стандартная модалка.

import { t } from '../../i18n.js';
import { openModal } from '../../modal.js';

let mounted = false;
let cache = null;         // последний успешный снапшот (нормализованные данные)
let lastLang = null;

export async function init(rootEl) {
  if (mounted) return;
  mounted = true;

  const section =
    rootEl.querySelector('#rep-block1') ||
    rootEl.querySelector('[data-i18n="funds.title"]')?.closest('section') ||
    rootEl;

  injectStyles();

  // pre-skeleton
  section.innerHTML = `
    <div class="funds-grid">
      ${['','','',''].map(()=>`<div class="funds-tile skeleton"></div>`).join('')}
    </div>
  `;

  const data = await loadFunds('/data/funds.json');
  if (!data) {
    section.innerHTML = `<div class="funds-empty">${t('funds.empty','No records yet.')}</div>`;
    return;
  }

  cache = computeSnapshot(data);
  render(section, cache);

  // клики по карточкам → модалки
  section.querySelector('[data-kind="collected"]')?.addEventListener('click', () => openCollectedModal(cache));
  section.querySelector('[data-kind="spent"]')?.addEventListener('click', () => openSpentModal(cache));
  section.querySelector('[data-kind="planned"]')?.addEventListener('click', () => openPlannedModal(cache));
  section.querySelector('[data-kind="available"]')?.addEventListener('click', () => openAvailableModal(cache));

  lastLang = getLang();
}

export function destroy(){ mounted = false; }

export function onLocaleChanged(){
  if (!mounted || !cache) return;
  const cur = getLang();
  if (cur === lastLang) return;
  lastLang = cur;

  const section =
    document.querySelector('#rep-block1') ||
    document.querySelector('[data-i18n="funds.title"]')?.closest('section');
  if (!section) return;

  render(section, cache);
}

/* ---------------- data & model ---------------- */

async function loadFunds(url){
  const LS = 'trus.funds.v1';
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    try{ localStorage.setItem(LS, JSON.stringify(json)); }catch{}
    return json;
  }catch(e){
    try{
      const raw = localStorage.getItem(LS);
      return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  }
}

function computeSnapshot(raw){
  const meta = {
    currency: (raw?.meta?.currency || 'USD').toUpperCase(),
    langDefault: (raw?.meta?.lang_default || 'EN').toUpperCase(),
    updatedAt: raw?.meta?.updated_at || null,
  };

  const collected = Array.isArray(raw?.collected) ? [...raw.collected] : [];
  const spent     = Array.isArray(raw?.spent)     ? [...raw.spent]     : [];
  const planned   = Array.isArray(raw?.planned)   ? [...raw.planned]   : [];

  // нормализация
  collected.forEach(e => { e.amount = clamp(num(e.amount), 0, Infinity); });
  spent.forEach(e => { e.amount = clamp(num(e.amount), 0, Infinity); });
  planned.forEach(e => { e.amount = clamp(num(e.amount), 0, Infinity); });

  // сортировки
  collected.sort(byDateAsc);
  spent.sort(byDateAsc); // planned без дат — оставляем как есть

  const totalCollected = collected.length ? collected[collected.length - 1].amount : 0;
  const totalSpent = spent.reduce((s,x)=>s+num(x.amount),0);
  const totalPlanned = planned.reduce((s,x)=>s+num(x.amount),0);

  const available = totalCollected - totalSpent - totalPlanned;
  const safety = totalPlanned > 0 ? (available / totalPlanned) * 100 : 100;

  // тона карточек
  const spentTone   = toneAgainstCollected(totalSpent, totalCollected);
  const plannedTone = toneAgainstCollected(totalPlanned, totalCollected);
  const availableTone = available <= 0
    ? 'red'
    : (safety <= 50 ? 'amber' : 'green');

  return {
    meta,
    totals: { collected: totalCollected, spent: totalSpent, planned: totalPlanned, available, safety },
    tone: { collected: 'cyan', spent: spentTone, planned: plannedTone, available: availableTone },
    series: { collected, spent, planned }
  };
}

function toneAgainstCollected(value, collected){
  if (collected <= 0) return value>0 ? 'red' : 'green';
  if (value > collected) return 'red';
  const ratio = value / collected;
  if (ratio >= 0.8) return 'amber';
  return 'green';
}

/* ---------------- render ---------------- */

function render(section, m){
  const g = document.createElement('div');
  g.className = 'funds-grid';

  g.appendChild(tile({
    kind: 'collected',
    tone: m.tone.collected,
    label: t('funds.collected','Collected'),
    value: fmtMoney(m.totals.collected, m.meta.currency),
  }));

  g.appendChild(tile({
    kind: 'spent',
    tone: m.tone.spent,
    label: t('funds.spent','Spent'),
    value: fmtMoney(m.totals.spent, m.meta.currency),
  }));

  g.appendChild(tile({
    kind: 'planned',
    tone: m.tone.planned,
    label: t('funds.planned','Planned'),
    value: fmtMoney(m.totals.planned, m.meta.currency),
  }));

  // Available — показывает остаток; подпись статуса (none/low/ok)
  const statusText = m.totals.available <= 0
    ? t('funds.available.none','No reserve yet — additional support is needed.')
    : (m.totals.safety <= 50
        ? t('funds.reserve.low','Reserve covers less than half of the planned costs.')
        : t('funds.reserve.ok','Reserve sufficiently covers future costs.'));
  g.appendChild(tile({
    kind: 'available',
    tone: m.tone.available,
    label: t('funds.available','Available balance'),
    value: fmtMoney(m.totals.available, m.meta.currency),
    sub: statusText
  }));

  // updated at
  const foot = document.createElement('div');
  foot.className = 'funds-updated';
  if (m.meta.updatedAt) {
    const d = new Date(m.meta.updatedAt);
    const dateStr = isNaN(d.getTime()) ? String(m.meta.updatedAt)
      : new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'2-digit' }).format(d);
    foot.textContent = `${t('funds.updated','Updated')}: ${dateStr}`;
  } else {
    foot.textContent = '';
  }

  section.innerHTML = '';
  section.appendChild(g);
  if (foot.textContent) section.appendChild(foot);
}

function tile({ kind, tone, label, value, sub='' }){
  const el = document.createElement('div');
  el.className = `funds-tile tone-${tone}`;
  el.setAttribute('data-kind', kind);
  el.tabIndex = 0; // focusable
  el.innerHTML = `
    <div class="ft-label">${label}</div>
    <div class="ft-value">${value}</div>
    ${sub ? `<div class="ft-sub">${sub}</div>` : ``}
  `;
  // доступность
  el.setAttribute('role','button');
  el.setAttribute('aria-label', `${label}: ${value}`);
  el.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); el.click(); } });
  return el;
}

/* ---------------- modals ---------------- */

function openCollectedModal(m){
  const title = t('funds.modal.collected.title','Collected over time');
  const total = fmtMoney(m.totals.collected, m.meta.currency);

  const lines = (m.series.collected || []).map((e)=>{
    const pct = m.totals.collected>0 ? Math.max(0, Math.min(100, (e.amount / m.totals.collected)*100 )) : 0;
    const date = fmtDate(e.date);
    return `
      <div class="row">
        <div class="row-head">
          <div class="row-date">${date}</div>
          <div class="row-amount">${fmtMoney(e.amount, m.meta.currency)}</div>
        </div>
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('') || `<div class="empty">${t('funds.empty','No records yet.')}</div>`;

  const html = `
    <div class="modal-funds">
      <div class="sticky-summary">
        <div class="sum-label">${t('funds.collected','Collected')}</div>
        <div class="sum-value">${total}</div>
      </div>
      <div class="list">${lines}</div>
      ${footerMeta(m)}
    </div>
  `;
  openModal(title, html);
}

function openSpentModal(m){
  const title = t('funds.modal.spent.title','Confirmed expenses');
  const total = fmtMoney(m.totals.spent, m.meta.currency);
  const lang = getLang(); const def = m.meta.langDefault;

  const max = m.series.spent.reduce((mx, x)=>Math.max(mx, num(x.amount)), 0);

  const lines = (m.series.spent || []).map((e, idx)=>{
    const pct = max>0 ? Math.max(0, Math.min(100, (e.amount / max)*100 )) : 0;
    const date = fmtDate(e.date);
    const id = `spent-${idx}`;
    const note = pickNote(e.note, lang, def);
    const noteBlock = note ? `<div class="note" id="${id}-note" hidden>${escapeHtml(note)}</div>` : '';
    return `
      <div class="row">
        <button class="row-head as-button" aria-expanded="false" aria-controls="${id}-note" data-toggles="${id}-note">
          <div class="row-date">${date}</div>
          <div class="row-amount">${fmtMoney(e.amount, m.meta.currency)}</div>
        </button>
        ${noteBlock}
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('') || `<div class="empty">${t('funds.empty','No records yet.')}</div>`;

  const html = `
    <div class="modal-funds">
      <div class="sticky-summary">
        <div class="sum-label">${t('funds.spent','Spent')}</div>
        <div class="sum-value">${total}</div>
      </div>
      <div class="list">${lines}</div>
      ${footerMeta(m)}
    </div>
  `;
  const modalId = openModal(title, html);
  wireToggles(modalId);
}

function openPlannedModal(m){
  const title = t('funds.modal.planned.title','Planned expenses');
  const total = fmtMoney(m.totals.planned, m.meta.currency);
  const lang = getLang(); const def = m.meta.langDefault;

  const max = m.series.planned.reduce((mx, x)=>Math.max(mx, num(x.amount)), 0);

  const lines = (m.series.planned || []).map((e, idx)=>{
    const pct = max>0 ? Math.max(0, Math.min(100, (e.amount / max)*100 )) : 0;
    const id = `planned-${idx}`;
    const note = pickNote(e.note, lang, def);
    const noteBlock = note ? `<div class="note" id="${id}-note">${escapeHtml(note)}</div>` : '';
    return `
      <div class="row">
        <div class="row-head">
          <div class="row-date">${fmtMoney(e.amount, m.meta.currency)}</div>
        </div>
        ${noteBlock}
        <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      </div>
    `;
  }).join('') || `<div class="empty">${t('funds.empty','No records yet.')}</div>`;

  const html = `
    <div class="modal-funds">
      <div class="sticky-summary">
        <div class="sum-label">${t('funds.planned','Planned')}</div>
        <div class="sum-value">${total}</div>
      </div>
      <div class="list">${lines}</div>
      ${footerMeta(m)}
    </div>
  `;
  openModal(title, html);
}

function openAvailableModal(m){
  const title = t('funds.modal.available.title','Available balance & safety margin');
  const avail = m.totals.available;
  const safety = Math.round(m.totals.safety);
  const safetyText = t('funds.available.safety','Safety margin: {percent}%').replace('{percent}', String(safety));

  let body = `
    <div class="modal-funds">
      <div class="sticky-summary">
        <div class="sum-label">${t('funds.available','Available balance')}</div>
        <div class="sum-value">${fmtMoney(avail, m.meta.currency)}</div>
      </div>
  `;

  if (avail <= 0) {
    body += `
      <div class="list">
        <div class="empty">${t('funds.available.none','No reserve yet — additional support is needed.')}</div>
      </div>
      ${footerMeta(m)}
    </div>`;
    openModal(title, body);
    return;
  }

  // линейная шкала safety (0..100..>100)
  const pct = Math.max(0, safety);
  const tone = pct <= 50 ? 'amber' : 'green';
  const overflow = pct > 100 ? `<div class="gauge-overflow" title="${safetyText}"></div>` : '';
  body += `
      <div class="list">
        <div class="gauge">
          <div class="gauge-track">
            <div class="gauge-fill tone-${tone}" style="width:${Math.min(100,pct)}%"></div>
          </div>
          ${overflow}
          <div class="gauge-label">${safetyText}</div>
        </div>
      </div>
      ${footerMeta(m)}
    </div>
  `;
  openModal(title, body);
}

function footerMeta(m){
  if (!m.meta.updatedAt) return '';
  const d = new Date(m.meta.updatedAt);
  const ds = isNaN(d.getTime()) ? String(m.meta.updatedAt)
    : new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'2-digit' }).format(d);
  return `<div class="mf-meta">${t('funds.updated','Updated')}: ${ds}</div>`;
}

function wireToggles(modalId){
  const modal = modalId ? document.getElementById(modalId) : document.querySelector('.modal');
  if (!modal) return;
  modal.querySelectorAll('[data-toggles]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id = btn.getAttribute('data-toggles');
      const note = modal.querySelector(`#${CSS.escape(id)}-note`) || modal.querySelector(`#${CSS.escape(id)}`);
      if (!note) return;
      const open = note.hasAttribute('hidden') ? false : true;
      if (open) { note.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); }
      else { note.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); }
    });
  });
}

/* ---------------- utils ---------------- */

function getLang(){ return (document.documentElement.getAttribute('lang') || 'EN').toUpperCase(); }
function num(x){ const n = Number(x); return Number.isFinite(n) ? n : 0; }
function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
function byDateAsc(a,b){
  const ta = Date.parse(a?.date||''); const tb = Date.parse(b?.date||'');
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return String(a?.date||'').localeCompare(String(b?.date||''));
}
function fmtMoney(v, cur){
  try{ return new Intl.NumberFormat(undefined, { style:'currency', currency:cur }).format(v||0); }
  catch{ return `${(v||0).toLocaleString()} ${cur}`; }
}
function fmtDate(s){
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s||'');
  return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'2-digit' }).format(d);
}
function pickNote(note, lang, def){
  if (!note || typeof note!=='object') return '';
  return note[lang] ?? note[def] ?? '';
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}

/* ---------------- styles (scoped) ---------------- */

function injectStyles(){
  if (document.getElementById('funds-b1-styles')) return;
  const css = `
  .funds-grid{
    display:grid; gap:12px; grid-template-columns:1fr;
  }
  @media (min-width:560px){ .funds-grid{ grid-template-columns:repeat(2,1fr); } }
  @media (min-width:960px){ .funds-grid{ grid-template-columns:repeat(4,1fr); } }

  .funds-tile{
    border-radius:14px; padding:12px;
    background: rgba(0,0,0,.14);
    border:1px solid rgba(255,255,255,.12);
    cursor:pointer; transition:background .2s ease, border-color .2s ease;
  }
  .funds-tile:focus{ outline:2px solid var(--indigo-600,#4f46e5); outline-offset:2px; }
  .funds-tile .ft-label{ font-weight:600; opacity:.9; }
  .funds-tile .ft-value{ font-weight:700; font-size:1.1rem; margin-top:2px; }
  .funds-tile .ft-sub{ margin-top:4px; opacity:.85; font-size:.94rem; }

  .funds-tile.skeleton{ height:88px; background:linear-gradient(90deg,rgba(255,255,255,.05),rgba(255,255,255,.12),rgba(255,255,255,.05)); background-size:400% 100%; animation:funds-shimmer 1.1s linear infinite; border-color:transparent;}
  @keyframes funds-shimmer{ 0%{background-position:0 0} 100%{background-position:400% 0} }

  /* тона карточек (мягкие RGBA, как в плане) */
  .tone-cyan  { background: rgba(6,182,212,.14);  border-color: rgba(6,182,212,.35); }
  .tone-red   { background: rgba(239,68,68,.16);  border-color: rgba(239,68,68,.35); }
  .tone-amber { background: rgba(245,158,11,.16); border-color: rgba(245,158,11,.35); }
  .tone-green { background: rgba(34,197,94,.16);  border-color: rgba(34,197,94,.35); }
  .tone-cyan:hover, .tone-red:hover, .tone-amber:hover, .tone-green:hover{
    filter:brightness(1.05);
  }

  .funds-updated{ margin-top:6px; opacity:.75; font-size:.92rem; }

  .funds-empty{ opacity:.85; }

  /* Модалки */
  .modal-funds{ display:grid; gap:12px; }
  .modal-funds .sticky-summary{
    position:sticky; top:0; z-index:1;
    padding:10px 0 6px 0; background:inherit;
    backdrop-filter: blur(0px);
    display:flex; align-items:baseline; gap:10px;
    border-bottom:1px solid rgba(255,255,255,.08);
  }
  .modal-funds .sum-label{ font-weight:600; opacity:.92; }
  .modal-funds .sum-value{ font-weight:700; font-size:1.15rem; }

  .modal-funds .list{ display:grid; gap:10px; }
  .modal-funds .row{ display:grid; gap:6px; }
  .modal-funds .row-head{ display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
  .modal-funds .row-date{ opacity:.9; font-size:.95rem; }
  .modal-funds .row-amount{ font-weight:600; }
  .modal-funds .as-button{
    display:flex; justify-content:space-between; gap:10px; align-items:baseline;
    background:none; border:none; padding:0; margin:0; color:inherit; cursor:pointer;
    text-align:left; font:inherit;
  }
  .modal-funds .note{ opacity:.9; }

  /* горизонтальные линии (индиго) */
  .modal-funds .bar{
    height:8px; border-radius:999px; background:rgba(79,70,229,.18); /* светлый трек */
    overflow:hidden;
  }
  .modal-funds .bar-fill{
    height:100%; background:#4f46e5; /* Indigo-600 */
  }

  .modal-funds .empty{ opacity:.8; }

  .mf-meta{ margin-top:6px; opacity:.75; font-size:.92rem; border-top:1px solid rgba(255,255,255,.08); padding-top:6px; }

  /* gauge (available safety) */
  .gauge{ display:grid; gap:8px; }
  .gauge-track{
    position:relative; height:10px; border-radius:999px; background:rgba(255,255,255,.12); overflow:hidden;
  }
  .gauge-fill{ height:100%; }
  .gauge-label{ opacity:.9; }
  .gauge-overflow{
    width:8px; height:14px; border-radius:2px; background:#4f46e5; /* маркер-«хвост» индиго */
    margin-left:auto; transform:translateY(-2px);
  }
  `;
  const style = document.createElement('style');
  style.id = 'funds-b1-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
