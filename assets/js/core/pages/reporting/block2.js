// assets/js/core/reporting/block2.js
// Block 2 — "История кампаний по сбору средств"

import { I18N } from '../i18n.js';

let mounted = false;
let lastLang = null;

function t(key, fallback = '') { return I18N[key] ?? fallback; }

export async function init(root) {
  try {
    console.debug('[rep-b2] init start');
    if (mounted) { console.debug('[rep-b2] already mounted'); return; }
    mounted = true;

    const host = root?.querySelector('#rep-block2 > div');
    if (!host) { console.error('[rep-b2] host not found: #rep-block2 > div'); return; }

    injectStyles();

    // LOADING
    host.innerHTML = `<div class="rep-b2 muted">${t('reporting.block2.loading','Loading fundraising history…')}</div>`;
    console.debug('[rep-b2] loading state shown');

    // FETCH
    const data = await loadData('/data/fundraising_history.json');
    console.debug('[rep-b2] data:', data);

    // Пусто/битый JSON — покажем empty + тест-карточку, чтобы видеть, что блок жив
    if (!data || !Array.isArray(data.platforms) || data.platforms.length === 0) {
      host.innerHTML = `
        <div class="rep-b2">
          <div class="empty">${t('reporting.block2.empty','No campaigns published yet.')}</div>
          <div class="card" style="margin-top:10px">
            <div class="row"><strong>Rep-B2 alive</strong> <span class="muted">• demo</span></div>
            <div class="row"><span class="label">Status:</span> ok (no data)</div>
          </div>
        </div>`;
      console.warn('[rep-b2] empty or invalid data');
      lastLang = getLang();
      return;
    }

    // Нормальный рендер
    host.innerHTML = '';
    host.appendChild(renderPlatforms(data.platforms));
    lastLang = getLang();
    console.debug('[rep-b2] render done');
  } catch (e) {
    console.error('[rep-b2] init error:', e);
    const host = document.querySelector('#rep-block2 > div');
    if (host) {
      host.innerHTML = `<div class="rep-b2 error">⚠ ${t('reporting.block2.error','Failed to load campaigns.')}</div>`;
    }
  }
}

export function destroy() { mounted = false; }

export async function onLocaleChanged() {
  const host = document.querySelector('#rep-block2 > div');
  if (!host || !mounted) return;
  const curLang = getLang();
  if (curLang === lastLang) return;
  lastLang = curLang;

  host.innerHTML = `<div class="rep-b2 muted">${t('reporting.block2.loading','Loading fundraising history…')}</div>`;
  const data = await loadData('/data/fundraising_history.json');
  if (!data || !Array.isArray(data.platforms) || data.platforms.length === 0) {
    host.innerHTML = `<div class="rep-b2 empty">${t('reporting.block2.empty','No campaigns published yet.')}</div>`;
    return;
  }
  host.innerHTML = '';
  host.appendChild(renderPlatforms(data.platforms));
}

/* helpers */

async function loadData(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) { console.warn('[rep-b2] fetch not ok:', r.status); return null; }
    return await r.json();
  } catch (e) {
    console.error('[rep-b2] fetch error:', e);
    return null;
  }
}

function renderPlatforms(platforms) {
  const wrap = document.createElement('div'); wrap.className = 'rep-b2';
  for (const p of platforms) {
    const plat = document.createElement('div'); plat.className = 'platform';
    const title = document.createElement('div'); title.className = 'platform-title';
    title.textContent = p?.name || t('reporting.block2.platform.unknown','Platform');
    plat.appendChild(title);

    const list = document.createElement('div'); list.className = 'campaigns';
    const campaigns = Array.isArray(p?.campaigns) ? p.campaigns : [];
    if (campaigns.length === 0) {
      const empty = document.createElement('div'); empty.className = 'muted';
      empty.textContent = t('reporting.block2.platform.empty','No campaigns on this platform yet.');
      list.appendChild(empty);
    } else {
      for (const c of campaigns) list.appendChild(renderCampaignCard(c, p?.url || null));
    }
    plat.appendChild(list);
    wrap.appendChild(plat);
  }
  return wrap;
}

function renderCampaignCard(c, fallbackUrl) {
  const card = document.createElement('div'); card.className = 'card';

  const row1 = document.createElement('div'); row1.className = 'row';
  const title = document.createElement('div'); title.innerHTML = `<strong>${escapeHtml(c?.title || '-')}</strong>`;
  const status = document.createElement('div'); status.className = 'muted';
  status.textContent = c?.status ? `• ${c.status}` : '';
  row1.appendChild(title); row1.appendChild(status);

  const row2 = document.createElement('div'); row2.className = 'row';
  const period = document.createElement('div');
  const start = safeDate(c?.period?.start) || '';
  const end = c?.period?.end ? safeDate(c.period.end) : null;
  const periodText = end ? `${start} — ${end}` : `${start} — ${t('reporting.block2.period.now','now')}`;
  period.innerHTML = `<span class="label">${t('reporting.block2.period','Period')}:</span> ${periodText}`;

  const spacer = document.createElement('div'); spacer.className = 'spacer';

  const metrics = document.createElement('div');
  const raised = numberOrZero(c?.metrics?.raised);
  const cur = c?.metrics?.currency || '';
  const donors = numberOrZero(c?.metrics?.donors);
  metrics.innerHTML = `<span class="label">${t('reporting.block2.metrics','Raised/Donors')}:</span> ${raised} ${escapeHtml(cur)} / ${donors}`;

  row2.appendChild(period); row2.appendChild(spacer); row2.appendChild(metrics);

  const row3 = document.createElement('div'); row3.className = 'row';
  const url = c?.url || fallbackUrl || null;
  if (url) {
    const link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener'; link.className = 'open-link';
    link.textContent = t('reporting.block2.open','Open campaign');
    row3.appendChild(link);
  } else {
    const noLink = document.createElement('div'); noLink.className = 'muted';
    noLink.textContent = t('reporting.block2.nolink','Link will be added soon.');
    row3.appendChild(noLink);
  }

  card.appendChild(row1); card.appendChild(row2); card.appendChild(row3);
  return card;
}

/* styles (локальные для блока) */
function injectStyles() {
  if (document.getElementById('rep-b2-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для блока храним в файлах блока*/
    .rep-b2 { display: grid; gap: 12px; }
    .rep-b2 .platform-title { font-weight: 600; margin-bottom: 6px; }
    .rep-b2 .campaigns { display: grid; gap: 8px; }
    .rep-b2 .card { border-radius: 14px; padding: 12px; background: rgba(0,0,0,0.18); }
    .rep-b2 .row { display:flex; flex-wrap:wrap; gap:10px; font-size: 0.95rem; }
    .rep-b2 .label { opacity: .75; }
    .rep-b2 .spacer { flex:1 1 auto; }
    .rep-b2 .open-link { text-decoration: underline; }
    .rep-b2 .muted { opacity:.7; font-size:.95rem; }
    .rep-b2 .empty, .rep-b2 .error { opacity:.85; font-size:.95rem; }
  `;
  const style = document.createElement('style');
  style.id = 'rep-b2-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

/* utils */
function getLang() { return (document.documentElement.getAttribute('lang') || '').toUpperCase(); }
function numberOrZero(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function safeDate(s){ return typeof s === 'string' ? s : null; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
