// assets/js/core/reporting/block2.js
// Block 2 — "История кампаний по сбору средств"
// Загружает /data/fundraising_history.json и рендерит карточки кампаний.
// Стили блока локальные (вставляются один раз).

import { I18N } from '../../i18n.js';

let mounted = false;
let lastLang = null;

function t(key, fallback = '') {
  return I18N[key] ?? fallback;
}

export async function init(root) {
  if (mounted) return;
  mounted = true;

  // 1) Найти секцию: сначала по id, потом по заголовку (i18n-ключ)
  let section = root.querySelector('#rep-block2');
  if (!section) {
    const h = root.querySelector('[data-i18n="reporting.block2.title"]');
    section = h ? h.closest('section') : null;
  }
  if (!section) {
    console.warn('[rep-b2] section #rep-block2 not found');
    return;
  }

  // 2) Внутренний хост-контейнер (создадим, если нет)
  let host = section.querySelector(':scope > div');
  if (!host) {
    host = document.createElement('div');
    section.appendChild(host);
  }

  injectStyles();

  host.innerHTML = `<div class="rep-b2 muted">${t('reporting.block2.loading', 'Loading fundraising history…')}</div>`;

  const data = await loadData('/data/fundraising_history.json');

  if (!data || !Array.isArray(data.platforms) || data.platforms.length === 0) {
    host.innerHTML = `<div class="rep-b2 empty">${t('reporting.block2.empty', 'No campaigns published yet.')}</div>`;
    return;
  }

  host.innerHTML = '';
  host.appendChild(renderPlatforms(data.platforms));
  lastLang = getLang();
}

export function destroy() {
  mounted = false;
}

// Перерисовка при смене языка
export async function onLocaleChanged() {
  const section = document.querySelector('#rep-block2')
    || document.querySelector('[data-i18n="reporting.block2.title"]')?.closest('section');
  const host = section?.querySelector(':scope > div');
  if (!host || !mounted) return;

  const curLang = getLang();
  if (curLang === lastLang) return;
  lastLang = curLang;

  host.innerHTML = `<div class="rep-b2 muted">${t('reporting.block2.loading', 'Loading fundraising history…')}</div>`;
  const data = await loadData('/data/fundraising_history.json');
  if (!data || !Array.isArray(data.platforms) || data.platforms.length === 0) {
    host.innerHTML = `<div class="rep-b2 empty">${t('reporting.block2.empty', 'No campaigns published yet.')}</div>`;
    return;
  }
  host.innerHTML = '';
  host.appendChild(renderPlatforms(data.platforms));
}

/* ---------------- helpers ---------------- */

async function loadData(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

function renderPlatforms(platforms) {
  const wrap = document.createElement('div');
  wrap.className = 'rep-b2';

  const listOfPlatforms = Array.isArray(platforms) ? platforms : [];

  for (const p of listOfPlatforms) {
    if (p?.hidden) continue; // скрыть всю платформу

    const campaignsRaw = Array.isArray(p?.campaigns) ? p.campaigns : [];
    const campaigns = campaignsRaw.filter(c => c && !c.hidden); // скрыть кампании с hidden:true

    // если после фильтра нет ни одной видимой кампании — не рендерим даже заголовок платформы
    if (campaigns.length === 0) continue;

    const plat = document.createElement('div');
    plat.className = 'platform';

    const platformTitle = document.createElement('div');
    platformTitle.className = 'platform-title';
    platformTitle.textContent = localize(p?.name) || t('reporting.block2.platform.unknown', 'Platform');
    plat.appendChild(platformTitle);

    const list = document.createElement('div');
    list.className = 'campaigns';

    for (const c of campaigns) {
      list.appendChild(renderCampaignCard(c, p?.url || null));
    }

    plat.appendChild(list);
    wrap.appendChild(plat);
  }

  // если все скрыто, покажем общий пустой текст (иначе секция будет совсем пустой)
  if (!wrap.children.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = t('reporting.block2.empty', 'No campaigns published yet.');
    wrap.appendChild(empty);
  }

  return wrap;
}

function renderCampaignCard(c, fallbackUrl) {
  const card = document.createElement('div');
  card.className = 'card';

  // Row 1: только статус (title убран по требованию)
  const row1 = document.createElement('div');
  row1.className = 'row';

  const statusEl = document.createElement('div');
  const statusRaw = String(c?.status || '').toLowerCase();

  // Ключи: reporting.block2.status.active / .finished (есть fallback на исходный статус)
  const statusText = t(`reporting.block2.status.${statusRaw}`, c?.status || '');

  if (statusRaw === 'active') {
    statusEl.className = 'status active';
    // текст + пульсирующая зелёная точка после него
    statusEl.innerHTML = `${escapeHtml(statusText)} <span class="dot" aria-hidden="true"></span>`;
  } else if (statusRaw === 'finished') {
    statusEl.className = 'status finished';
    statusEl.textContent = statusText;
  } else {
    statusEl.className = 'status';
    statusEl.textContent = statusText;
  }

  row1.appendChild(statusEl);

  // Row 2: период + метрики
  const row2 = document.createElement('div');
  row2.className = 'row';

  const period = document.createElement('div');
  const start = safeDate(c?.period?.start) || '';
  const endRaw = c?.period?.end;
  const end = endRaw ? safeDate(endRaw) : null;
  const periodText = end ? `${start} — ${end}` : `${start} — ${t('reporting.block2.period.now', 'now')}`;
  period.innerHTML = `<span class="label">${t('reporting.block2.period', 'Period')}:</span> ${periodText}`;

  const spacer = document.createElement('div');
  spacer.className = 'spacer';

  const metrics = document.createElement('div');
  const raised = numberOrZero(c?.metrics?.raised);
  const cur = c?.metrics?.currency || '';
  const donors = numberOrZero(c?.metrics?.donors);
  metrics.innerHTML = `<span class="label">${t('reporting.block2.metrics', 'Raised/Donors')}:</span> ${raised} ${escapeHtml(cur)} / ${donors}`;

  row2.appendChild(period);
  row2.appendChild(spacer);
  row2.appendChild(metrics);

  // Row 3: кнопка/ссылка
  const row3 = document.createElement('div');
  row3.className = 'row';
  const url = c?.url || fallbackUrl || null;
  if (url) {
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'open-btn';
    link.textContent = t('reporting.block2.open', 'Open campaign');
    row3.appendChild(link);
  } else {
    const noLink = document.createElement('div');
    noLink.className = 'muted';
    noLink.textContent = t('reporting.block2.nolink', 'Link will be added soon.');
    row3.appendChild(noLink);
  }

  card.appendChild(row1);
  card.appendChild(row2);
  card.appendChild(row3);
  return card;
}

/* ---------- styles ---------- */

function injectStyles() {
  if (document.getElementById('rep-b2-styles')) return;
  const css = `
    /* Локальные стили блока 2 */
    .rep-b2 { display: grid; gap: 12px; }
    .rep-b2 .platform-title { font-weight: 600; margin-bottom: 6px; }
    .rep-b2 .campaigns { display: grid; gap: 8px; }

    /* Подложка карточки кампании: как в блоке 4 (тонкая окантовка) */
    .rep-b2 .card {
      border-radius: 14px;
      padding: 12px;
      background: rgba(0,0,0,0.18);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: 0 1px 2px rgba(0,0,0,0.25);
    }

    .rep-b2 .row { display:flex; flex-wrap:wrap; gap:10px; font-size: 0.95rem; }
    .rep-b2 .label { opacity: .75; }
    .rep-b2 .spacer { flex:1 1 auto; }
    .rep-b2 .muted { opacity:.7; font-size:.95rem; }
    .rep-b2 .empty { opacity:.8; font-size:.95rem; }

    /* Статус */
    .rep-b2 .status { opacity:.9; }
    .rep-b2 .status.finished { opacity:.85; } /* без спец-стайлинга */
    .rep-b2 .status.active {
      color: #22c55e;                /* green-500 */
      display:inline-flex; align-items:center; gap:6px;
      font-weight:600; opacity:1;
    }
    .rep-b2 .status.active .dot{
      width: 8px; height: 8px; border-radius: 999px; background: #22c55e;
      box-shadow: 0 0 0 0 rgba(34,197,94,0.65);
      animation: repb2Pulse 1.8s infinite;
      display:inline-block; vertical-align:middle;
    }
    @keyframes repb2Pulse{
      0%   { box-shadow: 0 0 0 0   rgba(34,197,94,0.65); transform: scale(1); }
      70%  { box-shadow: 0 0 0 12px rgba(34,197,94,0.00); transform: scale(1.05); }
      100% { box-shadow: 0 0 0 0   rgba(34,197,94,0.00); transform: scale(1); }
    }

    /* Кнопка «Open campaign» — как open-btn из блока 4 */
    .rep-b2 .open-btn{
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
    .rep-b2 .card:hover .open-btn{
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.22);
    }
    .rep-b2 .open-btn:active{ transform: translateY(1px); }
    .rep-b2 .open-btn:focus-visible{
      outline:2px solid rgba(79,70,229,0.45);
      outline-offset:2px;
    }

    @media (min-width: 700px) {
      .rep-b2 { gap: 16px; }
      .rep-b2 .card { padding: 14px 16px; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'rep-b2-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/* ---------------- tiny utils ---------------- */

function getLang() {
  return (document.documentElement.getAttribute('lang') || '').toUpperCase();
}
function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function safeDate(s) { return typeof s === 'string' ? s : null; }
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

/** Универсальная локализация строкового/объектного поля
 *  Пример: name = "GoFundMe" ИЛИ name = { EN:"GoFundMe", RU:"…" }
 */
function localize(val){
  if (val && typeof val === 'object') {
    const L = getLang();
    return val[L] ?? val.EN ?? Object.values(val)[0] ?? '';
  }
  return typeof val === 'string' ? val : '';
}