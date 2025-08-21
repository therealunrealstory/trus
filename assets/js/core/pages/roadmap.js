// /assets/js/core/pages/roadmap.js
// Вкладка «Хронология». Без изменений содержимого: только устойчивый init()
// и корректная загрузка локалей из /i18n/roadmap/<lc>.json.

import * as DOM from '../dom.js';
import * as I18N from '../i18n.js';

const qs       = DOM.qs || ((sel, root = document) => root.querySelector(sel));
const createEl = (tag, attrs = {}) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  return el;
};

const getLocale       = I18N.getLocale       || (() => (document.documentElement.lang || 'en'));
const onLocaleChanged = I18N.onLocaleChanged || (() => () => {});

let cleanup = [];
let state = { data: null, i18n: null, locale: null };

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function mergeLocalized(data, dict) {
  const clone = structuredClone(data ?? {});
  clone.items = (clone.items || []).map(it => {
    if (!it || !it.id) return it;
    const loc = dict?.items?.[it.id];
    if (loc) {
      it.when_label = loc.when_label ?? it.when_label;
      it.title      = loc.title      ?? it.title;
      it.summary    = loc.summary    ?? it.summary;
      it.details    = loc.details    ?? it.details;
    }
    return it;
  });
  return clone;
}

function cleanLabel(s){ return (s||'').toString().trim().toLowerCase(); }
function normalizeLabels(it){
  if (Array.isArray(it.labels)&&it.labels.length) return it.labels.map(cleanLabel);
  if (typeof it.type==='string'&&it.type.trim()) return it.type.split('+').map(cleanLabel);
  return [];
}
function tLabel(key, dict){
  const k = (key||'').toLowerCase();
  const lbl = dict?.labels?.[k];
  if (lbl) return lbl;
  const map={'rt':'RT','car‑t':'CAR‑T','car-t':'CAR‑T','tki':'TKI','mi':'MI'};
  if (map[k]) return map[k];
  return k.split(' ').map(w => w ? (w[0].toUpperCase()+w.slice(1)) : '').join(' ');
}
function makeBadge(text, dict){
  const t=(text||'').toLowerCase();
  const span=createEl('span',{class:'roadmap-badge'+(['done','current','planned','tentative'].includes(t)?(' status-'+t):'')});
  span.textContent=tLabel(t, dict);
  return span;
}

function card(it, dict, emphasizeNow=false){
  const wrap=createEl('article',{class:'roadmap-card'});
  const top=createEl('header',{class:'roadmap-card-top'});
  const title=createEl('h4',{class:'roadmap-card-title'}); title.textContent=it.title || '';
  const date=createEl('span',{class:'roadmap-when'}); date.textContent=it.when_label || '';
  const badges=createEl('span',{class:'roadmap-badges'});
  (normalizeLabels(it)).forEach(l => badges.appendChild(makeBadge(l, dict)));
  if (it.status) badges.appendChild(makeBadge(it.status, dict));
  top.append(title, createEl('span',{class:'spacer'}), badges);

  const summary=createEl('p',{class:'roadmap-summary'}); summary.textContent=it.summary || '';
  const details=createEl('div',{class:'roadmap-details', style:'display:none'}); details.innerHTML = esc(it.details || '');
  const actions=createEl('div',{class:'roadmap-actions'});
  const tBtnDetails = dict?.ui?.btn_details || 'Details';
  const tBtnHide    = dict?.ui?.btn_hide    || 'Hide';
  const btn=createEl('button',{class:'roadmap-btn'}); btn.textContent=tBtnDetails;
  const onToggle=()=>{ const vis=details.style.display==='block'; details.style.display=vis?'none':'block'; btn.textContent=vis?tBtnDetails:tBtnHide; };
  btn.addEventListener('click', onToggle);
  cleanup.push(()=>btn.removeEventListener('click', onToggle));
  actions.appendChild(btn);

  wrap.append(top, createEl('div',{class:'roadmap-row'}), date, summary, (it.details?details:null), actions);

  if (emphasizeNow && (it.status==='current')) {
    const pulse=createEl('span',{class:'roadmap-nowpulse',title:'Now'});
    title.append(' ', pulse);
  }
  return wrap;
}

function render(root, data, dict){
  root.innerHTML='';
  const title = createEl('h2', { class: 'page-title', 'data-i18n': 'ui.page_title' });
  title.textContent = dict?.ui?.page_title || 'Medical timeline';
  root.appendChild(title);

  const grid = createEl('div', { class: 'roadmap-grid' });

  const colDone = createEl('section', { class: 'roadmap-col done' });
  const hDone   = createEl('h3', { 'data-i18n': 'ui.section_completed' });
  hDone.textContent = dict?.ui?.section_completed || 'Completed';
  colDone.appendChild(hDone);
  (data.items || []).filter(x => x.status === 'done').forEach(it => colDone.appendChild(card(it, dict)));

  const colNow = createEl('section', { class: 'roadmap-col now' });
  const hNow   = createEl('h3', { 'data-i18n': 'ui.section_now' });
  hNow.textContent = dict?.ui?.section_now || 'Now';
  const pulse  = createEl('span', { class: 'roadmap-nowpulse', title: 'Now' });
  hNow.append(' ', pulse);
  colNow.appendChild(hNow);
  (data.items || []).filter(x => x.status === 'current').forEach(it => colNow.appendChild(card(it, dict, true)));

  const colPlan = createEl('section', { class: 'roadmap-col future' });
  const hPlan   = createEl('h3', { 'data-i18n': 'ui.section_plans' });
  hPlan.textContent = dict?.ui?.section_plans || 'Plans';
  colPlan.appendChild(hPlan);

  const confLabel = createEl('div', { class: 'roadmap-confidence-h' });
  confLabel.textContent = (dict?.ui?.confidence || 'confidence');
  colPlan.appendChild(confLabel);

  (data.items || []).filter(x => x.status === 'planned' || x.status === 'tentative')
    .forEach(it => {
      const row = card(it, dict);
      if (typeof it.confidence !== 'undefined') {
        const c = createEl('div', { class: 'roadmap-confidence' });
        c.textContent = `${dict?.ui?.confidence || 'confidence'}: ${it.confidence}`;
        row.appendChild(c);
      }
      colPlan.appendChild(row);
    });

  grid.append(colDone, colNow, colPlan);
  root.appendChild(grid);
}

async function loadAll(){
  const locale = (getLocale() || 'en').toLowerCase();
  state.locale = locale;
  if (!state.data) state.data = await loadJSON('/partials/roadmap.json');
  state.i18n = await loadJSON(`/i18n/roadmap/${locale}.json`).catch(() => ({})); // строго строчно
  return mergeLocalized(state.data, state.i18n);
}

export async function init(mountArg){
  // ВАЖНО: не переопределяем "mount" — избегаем TDZ
  let rootEl = null;
  if (mountArg && mountArg.nodeType === 1) {
    rootEl = mountArg;
  } else if (typeof mountArg === 'string') {
    rootEl = qs(mountArg);
  } else if (mountArg && typeof mountArg === 'object' && 'mount' in mountArg) {
    const m = mountArg.mount;
    rootEl = (m && m.nodeType === 1) ? m : (typeof m === 'string' ? qs(m) : null);
  }
  if (!rootEl) rootEl = qs('#subpage');
  if (!rootEl) return;

  const page = createEl('section');
  rootEl.innerHTML = '';
  rootEl.appendChild(page);

  const merged = await loadAll();
  render(page, merged, state.i18n);

  const unSub = onLocaleChanged(async () => {
    const merged2 = await loadAll();
    render(page, merged2, state.i18n);
  });
  cleanup.push(unSub);
}

export function destroy(){
  cleanup.forEach(fn => { try{ fn(); } catch{} });
  cleanup = [];
}
