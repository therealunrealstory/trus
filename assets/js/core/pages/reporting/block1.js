// assets/js/core/pages/reporting/block1.js
// Current support metrics: Collected / Spent / Planned / Available
// - Collected: solid cyan как на Support (cyan500.css)
// - Spent/Planned: показываем covered:% и красим по новым порогам
// - Available: 80% порог + мигающая точка рядом с суммой

import { I18N } from '../../i18n.js';
import { openModal } from '../../modal.js';

const t = (k, f='') => I18N[k] ?? f;

let mounted = false;
let lastLang = null;
let cache = null;

export async function init(root){
  if (mounted) return; mounted = true;

  let section = root.querySelector('#rep-block1')
        || root.querySelector('[data-i18n="reporting.block1.title"]')?.closest('section');
  if (!section) { console.warn('[rep-b1] section not found'); return; }

  let host = section.querySelector(':scope > div');
  if (!host) { host = document.createElement('div'); section.appendChild(host); }

  injectStyles();

  host.innerHTML = `<div class="rep-b1 muted">${t('reporting.block1.loading','Loading financial metrics…')}</div>`;

  cache = await loadFunds('/data/funds.json');
  if (!cache) {
    host.innerHTML = `<div class="rep-b1 empty">${t('reporting.block1.empty','No financial data yet.')}</div>`;
    return;
  }

  renderTiles(host, cache);

  // Делегирование кликов по «+»
  if (!document.__repB1Delegated__) {
    document.__repB1Delegated__ = true;
    document.addEventListener('click', onDelegatedClick, true);
  }

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
  if (!cache) cache = await loadFunds('/data/funds.json');
  if (!cache) {
    host.innerHTML = `<div class="rep-b1 empty">${t('reporting.block1.empty','No financial data yet.')}</div>`;
    return;
  }
  renderTiles(host, cache);
}

/* ---------------- render ---------------- */

function renderTiles(host, data){
  const {
    currency = 'USD',
    collected = [],
    spent = [],
    planned = [],
    norm = { target: 0 },
    updated_at = null,
  } = data;

  const totalCollected = lastValue(collected) ?? 0;
  const totalSpent     = sum(spent, 'amount');
  const totalPlanned   = sum(planned, 'amount');
  const available      = totalCollected - totalSpent - totalPlanned;

  // --- COVERED метрики ---
  // Spent: сколько текущие сборы покрывают ПОДТВЕРЖДЁННЫЕ расходы
  const coveredSpentPct = pctClamp(totalSpent > 0 ? (totalCollected / totalSpent) * 100 : 100);

  // Planned: как в твоём примере: (collected - planned)/spent*100
  let coveredPlannedRaw;
  if (totalSpent > 0) {
    coveredPlannedRaw = ((totalCollected - totalPlanned) / totalSpent) * 100;
  } else {
    // если confirmed расходов нет — считаем по резерву vs планы
    const reserve = totalCollected;
    coveredPlannedRaw = totalPlanned > 0 ? (reserve / totalPlanned) * 100 : 100;
  }
  const coveredPlannedPct = pctClamp(coveredPlannedRaw);

  // --- Тоны карточек ---
  // Spent: <100→red, ≥100→green
  const spentTone   = (coveredSpentPct < 100) ? 'red' : 'green';

  // Planned: <50→red, 50–<100→amber, ≥100→green
  const plannedTone = (coveredPlannedPct >= 100) ? 'green' : (coveredPlannedPct >= 50 ? 'amber' : 'red');

  // Available: safety vs planned с порогом 80%
  const safety = totalPlanned > 0 ? (available / totalPlanned) * 100 : 100;
  const safetyPct = Math.max(0, Math.round(safety));
  const availTone = (available <= 0) ? 'red' : (safetyPct <= 80 ? 'amber' : 'green');

  const normTarget = Number(norm?.target) || 0;
  void normTarget;

  host.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'rep-b1 grid';

  // (1) Collected — solid cyan (как donate-tier на Support)
  grid.appendChild(tile({
    kind: 'collected',
    label: t('reporting.block1.collected','Collected'),
    tone:  'cyan',
    value: fmtMoney(totalCollected, currency),
    onClick: () => openCollectedModal(collected, totalCollected, currency)
  }));

  // (2) Spent + covered%
  grid.appendChild(tile({
    kind: 'spent',
    label: t('reporting.block1.spent','Spent'),
    tone:  spentTone,
    value: fmtMoney(totalSpent, currency),
    sub:   `${t('reporting.block1.covered','covered')}: ${fmtPct(coveredSpentPct)}`,
    onClick: () => openSpentModal(spent, currency)
  }));

  // (3) Planned + covered%
  grid.appendChild(tile({
    kind: 'planned',
    label: t('reporting.block1.planned','Planned'),
    tone:  plannedTone,
    value: fmtMoney(totalPlanned, currency),
    sub:   `${t('reporting.block1.covered','covered')}: ${fmtPct(coveredPlannedPct)}`,
    onClick: () => openPlannedModal(planned, currency)
  }));

  // (4) Available — полоса и мигающая точка
  const bar = progress(
    Math.min(safetyPct, 100),
    t('funds.available.safety','Safety margin: {percent}%').replace('{percent}', String(safetyPct)),
    (safetyPct <= 80 ? 'amber' : 'green')
  );

  const availEl = tile({
    kind: 'available',
    label: t('reporting.block1.available','Available'),
    tone:  availTone,
    value: fmtMoney(available, currency),
    subNode: bar,
    onClick: () => openAvailableModal(available, safetyPct, currency)
  });

  // добавляем «мигающую точку» рядом с суммой
  const v = availEl.querySelector('.value');
  if (v) {
    const dot = document.createElement('span');
    dot.className = 'pulse-dot';
    v.appendChild(dot);
  }

  grid.appendChild(availEl);
  host.appendChild(grid);

  if (updated_at){
    const upd = document.createElement('div');
    upd.className = 'updated muted';
    upd.textContent = `${t('reporting.block1.updated','Updated')}: ${safeDate(updated_at)}`;
    host.appendChild(upd);
  }
}

/* ---------- modal: Collected ---------- */
function openCollectedModal(collected = [], total, currency){
  const title = t('funds.modal.collected.title','Collected over time');

  const items = (Array.isArray(collected) ? collected : []).slice().sort(byDateAsc);
  const rows = items.length ? items.map(x => {
    const val = Number(x?.value ?? x?.amount) || 0;
    const pct = total > 0 ? (val / total) * 100 : 0;

    return `
      <div class="b1-line">
        <div class="line-head">
          <div class="line-title">
            <span class="line-date">${escapeHtml(x?.date || '')}</span>
            <span class="line-amt">${fmtMoney(val, currency)}</span>
          </div>
        </div>
        <div class="bar track">
          <div class="fill indigo" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('') : `<div class="muted">${t('funds.empty','No records yet.')}</div>`;

  const body = `
    ${modalHead(fmtMoney(total, currency))}
    <div class="b1-list">
      ${rows}
    </div>`;

  openModal(title, body);
}

/* ---------- modal: Spent ---------- */
function openSpentModal(spent = [], currency){
  const title = t('funds.modal.spent.title','Confirmed expenses');

  const items = (Array.isArray(spent) ? spent : []).slice().sort(byDateAsc);
  const max = Math.max(0, ...items.map(x => Number(x?.amount) || 0));

  const rows = items.length ? items.map((x, idx) => {
    const amt = Number(x?.amount) || 0;
    const pct = max > 0 ? (amt / max) * 100 : 0;
    const lang = getLang();
    const note = tryNote(x?.note, lang) || escapeHtml(x?.category || '');

    const rowId = `spent-${idx}-${Math.random().toString(36).slice(2,8)}`;
    return `
      <div class="b1-line spend-row" data-row="${rowId}">
        <div class="line-head">
          <div class="line-title">
            <span class="line-date">${escapeHtml(x?.date || '')}</span>
            <span class="line-amt">${fmtMoney(amt, currency)}</span>
          </div>
          <button class="icon-btn expander" type="button"
                  aria-expanded="false" aria-controls="${rowId}"
                  title="${escapeHtml(t('reporting.block1.more','More'))}">
            ${svgPlus()}
          </button>
        </div>
        <div class="bar track"><div class="fill indigo" style="width:${pct}%"></div></div>
        <div id="${rowId}" class="line-note" hidden>${note ? escapeHtml(note) : ''}</div>
      </div>`;
  }).join('') : `<div class="muted">${t('funds.empty','No records yet.')}</div>`;

  const totalSpent = sum(spent, 'amount');
  const body = `
    ${modalHead(fmtMoney(totalSpent, currency))}
    <div class="b1-list b1-list--spent">
      ${rows}
    </div>`;

  openModal(title, body);
}

/* ---------- modal: Planned ---------- */
function openPlannedModal(planned = [], currency){
  const title = t('funds.modal.planned.title','Planned expenses');

  const items = (Array.isArray(planned) ? planned : []).slice();
  const max = Math.max(0, ...items.map(x => Number(x?.amount) || 0));

  const rows = items.length ? items.map((x, idx) => {
    const amt = Number(x?.amount) || 0;
    const pct = max > 0 ? (amt / max) * 100 : 0;
    const lang = getLang();
    const note = tryNote(x?.note, lang) || '';
    const rowId = `planned-${idx}-${Math.random().toString(36).slice(2,8)}`;

    return `
      <div class="b1-line plan-row" data-row="${rowId}">
        <div class="line-head">
          <div class="line-title">
            <span class="line-amt">${fmtMoney(amt, currency)}</span>
          </div>
          <button class="icon-btn expander" type="button"
                  aria-expanded="false" aria-controls="${rowId}"
                  title="${escapeHtml(t('reporting.block1.more','More'))}">
            ${svgPlus()}
          </button>
        </div>
        <div class="bar track"><div class="fill indigo" style="width:${pct}%"></div></div>
        <div id="${rowId}" class="line-note" hidden>${note ? escapeHtml(note) : ''}</div>
      </div>`;
  }).join('') : `<div class="muted">${t('funds.empty','No records yet.')}</div>`;

  const totalPlanned = sum(planned, 'amount');
  const body = `
    ${modalHead(fmtMoney(totalPlanned, currency))}
    <div class="b1-list">
      ${rows}
    </div>`;

  openModal(title, body);
}

/* ---------- modal: Available ---------- */
function openAvailableModal(available, safetyPct, currency){
  const title = t('funds.modal.available.title','Available balance & safety margin');

  let body = '';
  if (available <= 0) {
    body = `
      ${modalHead(fmtMoney(available, currency))}
      <div class="b1-available-msg red">${escapeHtml(t('funds.available.none','No reserve yet — additional support is needed.'))}</div>`;
  } else {
    const tone = (safetyPct <= 80) ? 'amber' : 'green';
    body = `
      ${modalHead(fmtMoney(available, currency))}
      <div class="b1-safety">
        <div class="s-row">
          <div class="s-label">${escapeHtml(t('funds.available.safety','Safety margin: {percent}%').replace('{percent}', String(safetyPct)))}</div>
        </div>
        <div class="b1-progress">
          <div class="track"><div class="fill ${tone}" style="width:${Math.min(safetyPct,100)}%"></div></div>
          <div class="ptext">${safetyPct > 100 ? safetyPct + '%' : ''}</div>
        </div>
        <div class="s-comment muted">${escapeHtml(
          (safetyPct <= 80)
            ? t('funds.reserve.low','Reserve covers less than half of the planned costs.')
            : t('funds.reserve.ok','Reserve sufficiently covers future costs.')
        )}</div>
      </div>`;
  }

  openModal(title, body);
}

/* ---------------- events (delegated) ---------------- */

function onDelegatedClick(e){
  const btn = e.target.closest('.icon-btn.expander');
  if (!btn) return;

  e.preventDefault();
  const row  = btn.closest('[data-row]');
  const id   = btn.getAttribute('aria-controls');
  const note = id ? document.getElementById(id) : null;

  const expanded = btn.getAttribute('aria-expanded') === 'true';
  btn.setAttribute('aria-expanded', String(!expanded));
  btn.classList.toggle('is-open', !expanded);

  if (note) {
    if (expanded) {
      note.setAttribute('hidden','');
      note.style.maxHeight = '0px';
    } else {
      note.removeAttribute('hidden');
      note.style.maxHeight = note.scrollHeight + 'px';
    }
  }
  row?.classList.toggle('active', !expanded);
}

/* ---------------- helpers ---------------- */

async function loadFunds(url){
  try{
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    const json = await r.json();
    return normalize(json);
  }catch{ return null; }
}

function normalize(data){
  if (Array.isArray(data?.collected)) {
    data.collected = data.collected.map(x => ({
      date: x.date,
      value: Number(x.value ?? x.amount) || 0
    }));
  }
  return data || null;
}

function tile({ kind, label, value, sub='', subNode=null, tone='neutral', onClick }){
  const el = document.createElement('div');
  el.className = `b1-tile tone-${tone} ${kind ? ('b1-tile--' + kind) : ''}`;
  el.setAttribute('role','button');
  el.setAttribute('tabindex','0');
  el.addEventListener('click', onClick);
  el.addEventListener('keydown', (e)=>{ if (e.key==='Enter' || e.key===' ') { e.preventDefault(); onClick(); } });

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

function progress(pct, text, tone=null){
  const box = document.createElement('div');
  box.className = 'b1-progress';
  const track = document.createElement('div'); track.className='track';
  const fill  = document.createElement('div'); fill.className='fill';
  if (tone) fill.classList.add(tone);
  fill.style.width = `${pct}%`;
  const label = document.createElement('div'); label.className='ptext'; label.textContent = text;
  track.appendChild(fill);
  box.appendChild(track);
  box.appendChild(label);
  return box;
}

function modalHead(bigText){
  return `<div class="b1-modal-head">${escapeHtml(bigText)}</div>`;
}

function svgPlus(){
  return `
  <svg class="i-plus" viewBox="0 0 24 24" width="20" height="20"
       fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"
       shape-rendering="geometricPrecision" vector-effect="non-scaling-stroke" aria-hidden="true">
    <path d="M12 5v14M5 12h14"/>
  </svg>`;
}

function byDateAsc(a,b){ return String(a?.date||'').localeCompare(String(b?.date||'')); }
function lastValue(series){ if (!Array.isArray(series) || series.length===0) return null; const last = series[series.length - 1]; return Number(last?.value) || 0; }
function sum(arr, key){ if (!Array.isArray(arr)) return 0; return arr.reduce((acc, it) => acc + (Number(it?.[key]) || 0), 0); }
function fmtMoney(n, cur){
  const v = Number(n) || 0;
  try { return new Intl.NumberFormat(undefined, { style:'currency', currency: cur }).format(v); }
  catch { return `${v.toLocaleString()} ${cur}`; }
}
function fmtPct(n){ const v = Math.max(0, Number(n)||0); return (Math.round(v)===v) ? `${v}%` : `${v.toFixed(1)}%`; }
function pctClamp(v){ const x = Number(v); if (!Number.isFinite(x)) return 0; return Math.max(0, Math.round(x)); }
function getLang(){ return (document.documentElement.getAttribute('lang')||'').toUpperCase(); }
function safeDate(s){ return typeof s==='string' ? s : ''; }
function tryNote(noteObj, lang){
  if (!noteObj || typeof noteObj!=='object') return '';
  return noteObj[lang] ?? noteObj.EN ?? noteObj.RU ?? Object.values(noteObj)[0] ?? '';
}
function escapeHtml(str){ return String(str).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------------- styles ---------------- */

function injectStyles(){
  if (document.getElementById('rep-b1-styles')) return;
  const css = `
    /* Сетка */
    .rep-b1.grid { display:grid; gap:12px; grid-template-columns: 1fr; }
    @media (min-width:680px){ .rep-b1.grid { grid-template-columns: 1fr 1fr; } }

    /* Плитки */
    .b1-tile{
      border-radius:14px; padding:14px 14px 12px; position:relative;
      background:rgba(255,255,255,0.06);
      border:1px solid rgba(255,255,255,0.10);
      cursor:pointer; user-select:none;
      box-shadow: 0 1px 2px rgba(0,0,0,0.35);
      transition: transform .02s ease, background .2s ease, border-color .2s ease, box-shadow .2s ease;
    }
    .b1-tile:hover{ background:rgba(255,255,255,0.08); }
    .b1-tile:active{ transform: translateY(1px); }

    .b1-tile .label{ font-size:.9rem; opacity:.85; margin-bottom:4px; }
    .b1-tile .value{ font-size:1.4rem; font-weight:700; letter-spacing:.2px; display:inline-flex; align-items:center; gap:8px; }
    .b1-tile .sub{ margin-top:8px; }

    /* Hover-насыщение для тонов */
    .b1-tile.tone-red   { background: rgba(239, 68, 68, 0.16);  border-color: rgba(239, 68, 68, 0.35); }
    .b1-tile.tone-red:hover   { background: rgba(239, 68, 68, 0.26); border-color: rgba(239, 68, 68, 0.50); }
    .b1-tile.tone-amber { background: rgba(245,158, 11, 0.16);  border-color: rgba(245,158, 11, 0.35); }
    .b1-tile.tone-amber:hover { background: rgba(245,158, 11, 0.26); border-color: rgba(245,158, 11, 0.50); }
    .b1-tile.tone-green { background: rgba( 34,197, 94, 0.16);  border-color: rgba( 34,197, 94, 0.35); }
    .b1-tile.tone-green:hover { background: rgba( 34,197, 94, 0.26); border-color: rgba( 34,197, 94, 0.50); }

    /* Collected — как donate-tier (solid) + hover из cyan500.css */
    .b1-tile--collected{
      background-color: var(--cyan-700);
      border: 1px solid var(--cyan-400);
      color: #ecfeff;
      text-shadow: 0 1px 0 rgba(0,0,0,.12);
      transition: background-color .15s ease, border-color .15s ease, transform .02s ease;
    }
    .b1-tile--collected:hover{
      background-color: var(--cyan-600);
      border-color: var(--cyan-500);
    }

    /* Прогресс-полосы */
    .b1-progress .track{
      height: 8px; border-radius:999px; overflow:hidden;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
    }
    .b1-progress .fill{ height:100%; width:0%; transition: width .35s ease; background: rgba(34,197, 94, 0.7); }
    .b1-progress .fill.amber{ background: rgba(245,158,11, .7); }
    .b1-progress .fill.green{ background: rgba( 34,197,94, .7); }
    .b1-progress .ptext{ margin-top:6px; font-size:.85rem; opacity:.85; }

    /* Пульс-точка в Available */
    .pulse-dot{
      width:10px; height:10px; border-radius:999px; display:inline-block; vertical-align:middle;
      box-shadow:0 0 0 0 rgba(255,255,255,0.0);
      animation: dotPulse 2s infinite;
    }
    .b1-tile.tone-red   .pulse-dot{ background:#ef4444; box-shadow:0 0 0 0 rgba(239,68,68,.55); }
    .b1-tile.tone-amber .pulse-dot{ background:#f59e0b; box-shadow:0 0 0 0 rgba(245,158,11,.55); }
    .b1-tile.tone-green .pulse-dot{ background:#22c55e; box-shadow:0 0 0 0 rgba(34,197,94,.55); }
    @keyframes dotPulse{
      0%{ transform:scale(1); box-shadow:0 0 0 0 rgba(0,0,0,0.0); opacity:.95; }
      70%{ transform:scale(1.06); box-shadow:0 0 0 10px rgba(0,0,0,0); opacity:1; }
      100%{ transform:scale(1); box-shadow:0 0 0 0 rgba(0,0,0,0); opacity:.95; }
    }

    /* Модальная шапка (индиго) — только сумма */
    .b1-modal-head{
      text-align:center; font-size:1.35rem; font-weight:800; letter-spacing:.2px;
      background: rgba(79,70,229,0.14);
      border: 1px solid rgba(79,70,229,0.35);
      border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;
    }

    /* Список в модалках */
    .b1-list{ display:grid; gap:12px; }
    .b1-line .line-head{ display:flex; align-items:center; gap:10px; margin-bottom:6px; }
    .b1-line .line-title{ display:flex; gap:10px; align-items:baseline; }
    .b1-line .line-date{ font-size:.85rem; opacity:.85 }
    .b1-line .line-amt{ font-weight:700 }
    .b1-line .bar.track{
      position:relative;
      height:8px; border-radius:999px; overflow:hidden;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12)
    }
    .b1-line .fill.indigo{ background:#4f46e5; height:100%; position:relative; }

    /* Раскрывающиеся заметки */
    .b1-line .line-note{
      margin-top:6px; font-size:.95rem; line-height:1.35;
      border-left: 3px solid rgba(79,70,229,0.55);
      padding: 6px 8px; background: rgba(79,70,229,0.08);
      border-radius: 8px;
      overflow:hidden; max-height:0; transition:max-height .25s ease;
    }

    /* Кнопка «+» */
    .icon-btn.expander{
      margin-left:auto;
      display:inline-flex; align-items:center; justify-content:center;
      width:28px; height:28px; border-radius:8px;
      background: rgba(255,255,255,0.08);
      border:1px solid rgba(255,255,255,0.14);
      color:#e7ecf3; cursor:pointer;
      transition: background .15s ease, border-color .15s ease, transform .02s ease;
    }
    .icon-btn.expander:hover{ background: rgba(79,70,229,0.10); border-color: rgba(79,70,229,0.35); }
    .icon-btn.expander:active{ transform: translateY(1px); }
    .icon-btn.expander:focus-visible{
      outline:none; box-shadow:0 0 0 2px rgba(79,70,229,0.35);
      border-color: rgba(79,70,229,0.55);
    }
    .icon-btn.expander .i-plus{ transition: transform .18s ease; }
    .icon-btn.expander.is-open .i-plus{ transform: rotate(45deg); }

    /* Available: сообщение при нуле */
    .b1-available-msg.red{
      margin-top:8px; padding:10px 12px;
      background: rgba(239,68,68,0.16); border:1px solid rgba(239,68,68,0.35);
      border-radius:10px; font-weight:600; text-align:center;
    }

    .rep-b1 .muted, .rep-b1 .empty{ opacity:.75; font-size:.95rem; }
    .rep-b1 .updated{ margin-top:8px; font-size:.85rem; opacity:.7; }
  `;
  const st = document.createElement('style');
  st.id = 'rep-b1-styles';
  st.textContent = css;
  document.head.appendChild(st);
}
