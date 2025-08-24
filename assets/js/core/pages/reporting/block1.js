// assets/js/core/pages/reporting/block1.js
// Block 1 — Финансовые метрики: Collected / Spent / Planned — линии; Over-norm — процент-индикатор.
// Данные: /data/funds.json (единственный источник правды).
// В модалках — подробности + крупная линия (цвет indigo-600).

import { I18N } from '../../i18n.js';
import { openModal } from '../../modal.js';

const t = (k, f = '') => (I18N[k] ?? f);

let mounted = false;
let lastLang = null;
let lastSnapshot = null;   // кэш загруженных и посчитанных данных для повторных рендеров

export async function init(root) {
  if (mounted) return;
  mounted = true;

  // 1) Находим секцию блока по id или по заголовку c i18n-ключом
  let section = root.querySelector('#rep-block1');
  if (!section) {
    const h = root.querySelector('[data-i18n="reporting.block1.title"]');
    section = h ? h.closest('section') : null;
  }
  if (!section) { console.warn('[rep-b1] section not found'); return; }

  // 2) Внутренний хост
  let host = section.querySelector(':scope > div');
  if (!host) { host = document.createElement('div'); section.appendChild(host); }

  injectStyles();

  // 3) Прелоадер
  host.innerHTML = `<div class="rep-b1">
    <div class="b1-skeleton">
      <div class="sk-tile"></div><div class="sk-tile"></div>
      <div class="sk-tile"></div><div class="sk-tile"></div>
    </div>
  </div>`;

  // 4) Загрузка данных
  const data = await loadFunds('/data/funds.json');

  if (!data) {
    host.innerHTML = `<div class="rep-b1 empty">${t('reporting.block1.empty','No financial data yet.')}</div>`;
    return;
  }

  // 5) Подсчёты и нормализация
  const snapshot = computeSnapshot(data);
  lastSnapshot = snapshot;

  // 6) Рендер
  host.innerHTML = '';
  host.appendChild(renderTiles(snapshot));

  // 7) Клики по плиткам → модалки
  host.querySelectorAll('.b1-tile[data-kind]').forEach(tile => {
    tile.addEventListener('click', () => openDetailsModal(tile.getAttribute('data-kind'), snapshot));
  });

  lastLang = getLang();
}

export function destroy() { mounted = false; }

export async function onLocaleChanged() {
  if (!mounted) return;
  const cur = getLang();
  if (cur === lastLang) return;
  lastLang = cur;

  // Перерисуем на том же снапшоте данных (повторный fetch не нужен)
  const section = document.querySelector('#rep-block1')
    || document.querySelector('[data-i18n="reporting.block1.title"]')?.closest('section');
  const host = section?.querySelector(':scope > div'); if (!host) return;

  if (!lastSnapshot) { host.innerHTML = `<div class="rep-b1 empty">${t('reporting.block1.empty','No financial data yet.')}</div>`; return; }
  host.innerHTML = '';
  host.appendChild(renderTiles(lastSnapshot));

  host.querySelectorAll('.b1-tile[data-kind]').forEach(tile => {
    tile.addEventListener('click', () => openDetailsModal(tile.getAttribute('data-kind'), lastSnapshot));
  });
}

/* ---------------- data ---------------- */

async function loadFunds(url) {
  const LS_KEY = 'trus.reporting.funds.v1';
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();

    // мягкая валидация
    if (!json || typeof json !== 'object') throw new Error('invalid json');

    // кэшируем «последний успешный»
    try { localStorage.setItem(LS_KEY, JSON.stringify(json)); } catch {}
    return json;
  } catch (e) {
    console.warn('[rep-b1] fetch funds failed, fallback to cache:', e?.message || e);
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}

function computeSnapshot(data) {
  const currency   = (data.currency || 'USD').toUpperCase();
  const normTarget = numberOrZero(data?.norm?.target);

  const collected = Array.isArray(data.collected) ? [...data.collected] : [];
  const spent     = Array.isArray(data.spent)     ? [...data.spent]     : [];
  const planned   = Array.isArray(data.planned)   ? [...data.planned]   : [];

  // сортируем серии по дате (YYYY-MM-DD / ISO)
  collected.sort(byDateAsc);
  spent.sort(byDateAsc);
  planned.sort(byDateAsc);

  // значения — только числа ≥ 0
  for (const p of collected) p.value  = clamp(numberOrZero(p.value), 0, Infinity);
  for (const p of spent)     p.amount = clamp(numberOrZero(p.amount), 0, Infinity);
  for (const p of planned)   p.amount = clamp(numberOrZero(p.amount), 0, Infinity);

  const totalCollected = collected.length ? collected[collected.length - 1].value : 0;
  const totalSpent     = spent.reduce((s, x) => s + x.amount, 0);
  const totalPlanned   = planned.reduce((s, x) => s + x.amount, 0);

  const overNormAmount  = Math.max(0, totalCollected - normTarget);
  const overNormPercent = normTarget > 0 ? (totalCollected / normTarget) * 100 : 0;

  // для линий spent/planned — делаем кумулятив
  const spentCum   = cumulate(spent.map(x => ({ date: x.date, value: x.amount })));
  const plannedCum = cumulate(planned.map(x => ({ date: x.date, value: x.amount })));

  return {
    currency,
    updatedAt: data.updated_at || null,
    normTarget,
    totals: { collected: totalCollected, spent: totalSpent, planned: totalPlanned },
    over: { amount: overNormAmount, percent: overNormPercent },
    series: {
      collected,
      spent, spentCum,
      planned, plannedCum,
    }
  };
}

/* ---------------- rendering ---------------- */

function renderTiles(m) {
  const wrap = document.createElement('div');
  wrap.className = 'rep-b1 grid';

  // 1) Collected — линия
  wrap.appendChild(tile({
    kind: 'collected',
    label: t('reporting.block1.collected','Collected'),
    value: fmtMoney(m.totals.collected, m.currency),
    subNode: sparkline(m.series.collected, { aria: t('reporting.block1.collected','Collected') })
  }));

  // 2) Spent — линия по кумулятиву расходов
  wrap.appendChild(tile({
    kind: 'spent',
    label: t('reporting.block1.spent','Spent'),
    value: fmtMoney(m.totals.spent, m.currency),
    sub: t('reporting.block1.spent.note','All-time expenses'),
    subNode: sparkline(m.series.spentCum, { aria: t('reporting.block1.spent','Spent') })
  }));

  // 3) Planned — линия по кумулятиву планов
  wrap.appendChild(tile({
    kind: 'planned',
    label: t('reporting.block1.planned','Planned'),
    value: fmtMoney(m.totals.planned, m.currency),
    sub: t('reporting.block1.planned.note','Upcoming budget'),
    subNode: sparkline(m.series.plannedCum, { aria: t('reporting.block1.planned','Planned') })
  }));

  // 4) Over-norm — процентный индикатор (не линия)
  const pct = clamp(m.over.percent, 0, 200); // до 200% визуально
  wrap.appendChild(tile({
    kind: 'overnorm',
    label: t('reporting.block1.overnorm','Over-norm'),
    value: m.normTarget ? fmtMoney(m.over.amount, m.currency) : '—',
    subNode: percentRing(pct, {
      label: m.normTarget
        ? `${pct.toFixed(0)}% ${t('reporting.block1.ofTarget','of target')}`
        : '—',
      tone: pct <= 100 ? 'ok' : 'over'
    }),
    clickable: false // модалка не обязательна, хотим лишь визуальный индикатор
  }));

  // Updated-at
  if (m.updatedAt) {
    const upd = document.createElement('div');
    upd.className = 'updated muted';
    try {
      const d = new Date(m.updatedAt);
      upd.textContent = `${t('reporting.block1.updated','Updated')}: ${
        Number.isFinite(d.getTime())
          ? d.toLocaleDateString()
          : String(m.updatedAt)
      }`;
    } catch {
      upd.textContent = `${t('reporting.block1.updated','Updated')}: ${String(m.updatedAt)}`;
    }
    wrap.appendChild(upd);
  }

  return wrap;
}

function tile({ kind, label, value, sub = '', subNode = null, clickable = true }) {
  const el = document.createElement('div');
  el.className = 'b1-tile';
  if (kind) el.setAttribute('data-kind', kind);
  if (clickable) el.classList.add('is-clickable');
  if (!clickable) el.classList.add('is-static');

  const l = document.createElement('div'); l.className = 'label'; l.textContent = label;
  const v = document.createElement('div'); v.className = 'value'; v.textContent = value;
  el.appendChild(l); el.appendChild(v);

  if (subNode) {
    const box = document.createElement('div'); box.className = 'sub'; box.appendChild(subNode);
    el.appendChild(box);
  } else if (sub) {
    const s = document.createElement('div'); s.className = 'sub muted'; s.textContent = sub;
    el.appendChild(s);
  }

  return el;
}

/* ---------------- modal (details) ---------------- */

function openDetailsModal(kind, m) {
  let title = '';
  let series = [];
  switch (kind) {
    case 'collected':
      title = t('reporting.block1.collected','Collected');
      series = m.series.collected;
      break;
    case 'spent':
      title = t('reporting.block1.spent','Spent');
      series = m.series.spentCum;
      break;
    case 'planned':
      title = t('reporting.block1.planned','Planned');
      series = m.series.plannedCum;
      break;
    default:
      return;
  }

  const svg = bigLineChart(series);
  const total =
    kind === 'collected' ? m.totals.collected :
    kind === 'spent'     ? m.totals.spent     :
                           m.totals.planned;

  const html = `
    <div class="b1-modal">
      <div class="m-summary">
        <div class="m-label">${title}</div>
        <div class="m-value">${fmtMoney(total, m.currency)}</div>
      </div>
      <div class="m-chart">${svg}</div>
      <div class="m-meta muted">
        <span>${t('reporting.block1.ofTarget','of target')} — ${fmtMoney(m.normTarget, m.currency)}</span>
        <span class="dot">•</span>
        <span>${t('reporting.block1.updated','Updated')}: ${m.updatedAt ? escapeHtml(String(m.updatedAt)) : '—'}</span>
      </div>
    </div>
  `;
  openModal(title, html);
}

/* ---------------- small visuals ---------------- */

function sparkline(series, { width = 260, height = 48, aria = '' } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'spark');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  if (aria) svg.setAttribute('aria-label', aria);

  const path = seriesToPath(series, width, height);
  const p = document.createElementNS(svg.namespaceURI, 'path');
  p.setAttribute('d', path);
  p.setAttribute('class', 'spark-line');
  svg.appendChild(p);

  return svg;
}

function percentRing(pct, { label = '', tone = 'ok' } = {}) {
  // conic-gradient: ок до 200% — остаток серый
  const box = document.createElement('div');
  box.className = `ring ${tone === 'over' ? 'ring-over' : 'ring-ok'}`;
  box.style.setProperty('--pct', String(clamp(pct, 0, 200)));

  const inner = document.createElement('div'); inner.className = 'ring-inner';
  const txt = document.createElement('div'); txt.className = 'ring-text';
  txt.textContent = `${pct.toFixed(0)}%`;
  const sub = document.createElement('div'); sub.className = 'ring-sub';
  sub.textContent = label;

  inner.appendChild(txt);
  box.appendChild(inner);

  const wrap = document.createElement('div'); wrap.className = 'ring-wrap';
  wrap.appendChild(box);
  wrap.appendChild(sub);

  return wrap;
}

/* ---------------- big chart for modal ---------------- */

function bigLineChart(series, { width = 640, height = 220 } = {}) {
  const path = seriesToPath(series, width, height - 20); // оставим низ под отступ
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'bigline');

  // сетка (4 горизонтальные линии)
  const grid = document.createElementNS(ns, 'g');
  grid.setAttribute('class', 'grid');
  const rows = 4;
  for (let i = 0; i <= rows; i++) {
    const y = Math.round((i / rows) * (height - 20)) + 0.5;
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', '0'); line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(width)); line.setAttribute('y2', String(y));
    grid.appendChild(line);
  }
  svg.appendChild(grid);

  // линия indigo-600
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', path);
  p.setAttribute('class', 'bigline-path');
  svg.appendChild(p);

  return svg.outerHTML;
}

/* ---------------- helpers ---------------- */

function seriesToPath(series, width, height) {
  const pts = (Array.isArray(series) ? series : []).filter(x => isFinite(Number(x?.value ?? x?.amount ?? x)));
  if (!pts.length) return `M0 ${height} H${width}`;

  const values = pts.map(p => Number(p.value ?? p.amount ?? p));
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1e-9);

  const n = pts.length;
  const stepX = n > 1 ? width / (n - 1) : width;

  let d = '';
  for (let i = 0; i < n; i++) {
    const x = Math.round(i * stepX);
    const v = (values[i] - min) / span;     // 0..1
    const y = Math.round((1 - v) * (height - 2)) + 1;
    d += (i === 0 ? `M${x} ${y}` : ` L${x} ${y}`);
  }
  return d;
}

function cumulate(series) {
  let s = 0;
  return series.map(p => ({ date: p.date, value: (s += (Number(p.value) || 0)) }));
}

function byDateAsc(a, b) {
  const ta = Date.parse(a?.date || '');
  const tb = Date.parse(b?.date || '');
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
  return String(a?.date || '').localeCompare(String(b?.date || ''));
}

function numberOrZero(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function fmtMoney(n, cur) {
  const v = Number(n) || 0;
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(v); }
  catch { return `${v.toLocaleString()} ${cur}`; }
}
function getLang() { return (document.documentElement.getAttribute('lang') || '').toUpperCase(); }
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------------- styles (scoped to block) ---------------- */

function injectStyles() {
  if (document.getElementById('rep-b1-styles')) return;
  const css = `
    /* Стили блока 1 (храним локально в файле блока) */
    .rep-b1.grid {
      display: grid; gap: 12px;
      grid-template-columns: 1fr;
    }
    @media (min-width: 560px){ .rep-b1.grid { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 960px){ .rep-b1.grid { grid-template-columns: repeat(4, 1fr); } }

    .b1-tile{
      border-radius: 14px; padding: 12px;
      background: rgba(0,0,0,0.18);
      border: 1px solid rgba(255,255,255,0.08);
      display: grid; gap: 6px; cursor: pointer;
    }
    .b1-tile.is-static{ cursor: default; }
    .b1-tile.is-clickable:hover{ background: rgba(255,255,255,0.08); }
    .b1-tile .label{ opacity: .85; font-weight: 600; }
    .b1-tile .value{ font-weight: 700; font-size: 1.05rem; }
    .b1-tile .sub{ margin-top: 2px; }
    .rep-b1 .updated{ margin-top: 4px; font-size:.92rem; }

    /* skeleton */
    .b1-skeleton{ display:grid; gap:12px; grid-template-columns: 1fr; }
    @media (min-width:560px){ .b1-skeleton{ grid-template-columns: repeat(2,1fr); } }
    @media (min-width:960px){ .b1-skeleton{ grid-template-columns: repeat(4,1fr); } }
    .sk-tile{
      height: 84px; border-radius:14px;
      background: linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.12), rgba(255,255,255,0.05));
      background-size: 400% 100%;
      animation: b1-shimmer 1.1s linear infinite;
    }
    @keyframes b1-shimmer{ 0%{background-position:0 0} 100%{background-position:400% 0} }

    /* small sparkline */
    .spark{ width: 100%; height: 48px; display:block; }
    .spark-line{
      fill: none;
      stroke: var(--indigo-600, #4f46e5);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
    }

    /* percent ring (over-norm) */
    .ring-wrap{ display:grid; gap:6px; align-items:center; justify-items:center; }
    .ring{
      --size: 72px;
      width: var(--size); height: var(--size);
      border-radius: 50%;
      background:
        conic-gradient(
          var(--ring-color) calc(var(--pct) * 1%),
          rgba(255,255,255,0.08) 0
        );
      position: relative;
    }
    .ring::after{
      content:""; position:absolute; inset:10px; border-radius:50%;
      background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08);
    }
    .ring-inner{
      position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
      font-weight:700;
    }
    .ring-text{ position:relative; z-index:1; }
    .ring-sub{ font-size:.9rem; opacity:.85; text-align:center; }
    .ring-ok{ --ring-color: var(--indigo-600, #4f46e5); }
    .ring-over{ --ring-color: var(--red-500, #ef4444); }

    /* big modal chart */
    .b1-modal{ display:grid; gap:10px; }
    .b1-modal .m-summary{ display:flex; align-items:baseline; gap:10px; }
    .b1-modal .m-summary .m-label{ font-weight:600; opacity:.92; }
    .b1-modal .m-summary .m-value{ font-weight:700; font-size:1.15rem; }
    .b1-modal .m-chart{ border-radius:12px; background: rgba(0,0,0,0.15); padding: 10px; }
    .bigline{ width:100%; height:auto; display:block; }
    .bigline .grid line{
      stroke: rgba(255,255,255,0.12);
      stroke-width: 1;
      shape-rendering: crispEdges;
    }
    .bigline-path{
      fill:none;
      stroke: var(--indigo-600, #4f46e5);
      stroke-width: 2.25;
    }

    .muted{ opacity:.75 }
    .empty{ opacity:.8 }
  `;
  const style = document.createElement('style');
  style.id = 'rep-b1-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
