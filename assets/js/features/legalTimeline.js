// assets/js/features/legalTimeline.js
// Юридическая шкала (линии + точки + модалка) — локализация + исходный внешний вид.

import { openModal } from '../core/modal.js';
import * as I18N from '../core/i18n.js';

let root = null;
let offLocaleCb = null;
let onResizeHandler = null;
let resizeTimer = null;

// Делегированный обработчик "Подробнее", чтобы не ломался через раз при повторном открытии модалки
let onDocMoreClick = null;
let currentDict = null;

/* ---------- СТИЛИ (как было: вертикальные подписи + мигающая NOW) ---------- */
const TPL_STYLE = `
:root{
  --indigo-300:#a5b4fc;
  --indigo-600:#4f46e5;
  --red-500:#ef4444;

  --tl-gutter-h:6%;
  --tl-gutter-v:8%;
  --lineY:62%;
  --freeze-offset:16px;

  --label-gap:18px;
}

.lt-head{
  background: rgba(0,0,0,0.2);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius:16px;
  padding:16px 18px;
  margin-bottom:16px;
}
.lt-title{ margin:0 0 6px; font-size:22px; line-height:1.25; }
.lt-meta { color:rgba(231,236,243,0.7); font-size:14px; }

.lt-timeline{
  position:relative;
  background: rgba(0,0,0,0.20);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius:16px;
  overflow:hidden;
  width:100%;
}
.lt-track{ position:relative; width:100%; height:360px; }

.lt-pre{ position:absolute; height:2px; background:var(--indigo-300); top:calc(var(--lineY) - 1px); z-index:3; border-radius:2px; }
.lt-base{ position:absolute; height:4px; background:var(--indigo-600); top:var(--lineY); transform:translateY(-50%); z-index:2; }
.lt-freeze{ position:absolute; height:12px; background:var(--red-500); border-radius:8px; top: calc(var(--lineY) + var(--freeze-offset));
  z-index:3; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.25)); }
.lt-future{ position:absolute; height:4px; background:transparent; top:var(--lineY); transform:translateY(-50%); z-index:2;
  border-top:4px dashed var(--indigo-600); }

/* Точка + вертикальная подпись */
.lt-dot{
  position:absolute; width:16px; height:16px; border-radius:50%;
  background:#ffffff; outline:1px solid rgba(255,255,255,0.12);
  box-shadow:0 0 0 2px rgba(79,70,229,0.45);
  cursor:pointer; transform:translate(-50%, -50%); z-index:4;
}
/* ВЕРТИКАЛЬ: надпись «над» точкой, вертикально, вверх ногами (читается снизу вверх) */
.lt-label{
  position:absolute; font-size:12px; color:rgba(231,236,243,0.75);
  white-space:nowrap; text-shadow:0 1px 0 rgba(0,0,0,0.35); line-height:1.1;
}
@media (min-width:821px){
  .lt-label{
    top: var(--lineY);
    transform: translate(-50%, calc(-100% - var(--label-gap))) rotate(180deg);
    writing-mode: vertical-rl; text-orientation: mixed;
  }
}

@keyframes lt-pulse{
  0% { box-shadow:0 0 0 0 rgba(165,180,252,0.60); }
  50%{ box-shadow:0 0 0 6px rgba(165,180,252,0.00); }
  100%{ box-shadow:0 0 0 0 rgba(165,180,252,0.00); }
}
.lt-now{
  position:absolute; background:#a5b4fc; border-radius:2px;
  animation: lt-pulse 1.9s ease-out infinite;
  z-index:5;
}

/* Легенда — отдельным нижним блоком внутри того же контейнера */
.lt-legend{
  display:flex; gap:18px; flex-wrap:wrap;
  padding:10px 12px;
  border-top:1px solid rgba(255,255,255,0.12);
  background: rgba(0,0,0,0.20);
  font-size:13px; color:rgba(231,236,243,0.9);
}

.lt-leg-item{ display:flex; align-items:center; gap:8px; }
.lt-swatch{ display:inline-block; height:4px; border-radius:4px; }
.lt-swatch.pre{ width:44px; background:var(--indigo-300); }
.lt-swatch.base{ width:44px; background:var(--indigo-600); }
.lt-swatch.freeze{ width:44px; height:12px; background:var(--red-500); border-radius:8px; }
.lt-swatch.future{
  background: transparent !important;
  box-shadow: none !important;
  border: 0 !important;
  width: 44px !important;
  height: 0 !important;
  border-top: 4px dashed var(--indigo-600) !important; /* горизонтально, как на шкале */
  border-radius: 0 !important;
}

/* ▼ ДОБАВЛЕНО: образцы для «мигающей линии» и точка в легенде */
.lt-swatch.now{ width:44px; height:4px; background:#a5b4fc; border-radius:4px; animation: lt-pulse 1.9s ease-out infinite; }
.lt-legend .lt-dot{ position:static; transform:none; cursor:default; }

/* MOBILE: вертикальная шкала слева */
@media (max-width:820px){
  .lt-track{ height:1200px; }
  .lt-pre{ left:44px; width:2px; transform:none; }
  .lt-base{ left:44px; width:4px; transform:none; }
  .lt-freeze{ left: calc(44px - var(--freeze-offset)); width:12px; height:auto; }
  .lt-future{ left:44px; width:0; height:auto; border-top:none; border-left:4px dashed var(--indigo-600); transform:none; }
  .lt-label{ transform:none; left:60px; top:auto; writing-mode:initial; text-orientation:initial; }
}
`;

/* ---------- УТИЛИТЫ ---------- */
const NBSP = '\u00A0';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const html = (ss,...vv) => ss.reduce((a,s,i)=> a+s+(vv[i]??''), '');
const parseYM = (s)=>{
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(s+'T00:00:00Z');
  if (/^\d{4}-\d{2}$/.test(s))       return new Date(s+'-01T00:00:00Z');
  if (/^\d{4}$/.test(s))             return new Date(s+'-01-01T00:00:00Z');
  return new Date(s);
};
function posHelpers(){
  const cs = getComputedStyle(document.documentElement);
  const gh = parseFloat(cs.getPropertyValue('--tl-gutter-h'))/100 || 0.06;
  const gv = parseFloat(cs.getPropertyValue('--tl-gutter-v'))/100 || 0.08;
  return {
    posH:r => gh + r * (1 - gh*2),
    posV:r => gv + r * (1 - gv*2)
  };
}
const getLang = () => (I18N.getLangFromQuery?.() || document.documentElement.lang || 'EN').toLowerCase();
const fmt = (tpl, vars={}) => String(tpl||'').replace(/\{(\w+)\}/g,(_,k)=> (vars[k] ?? ''));

/* ---------- ЗАГРУЗКА ДАННЫХ + СЛОВАРЕЙ ---------- */
async function loadBase() {
  const res = await fetch('/partials/legal-timeline.json', { cache:'no-store' });
  if (!res.ok) throw new Error('Failed to load legal-timeline.json');
  return res.json();
}
async function loadDict(lang){
  try{
    const r = await fetch(`/i18n/legalTimeline/${lang}.json`, { cache:'no-store' });
    if (!r.ok) throw 0;
    return await r.json();
  } catch { return {}; }
}
function mergeLocalized(data, dict){
  const out = structuredClone(data || {});
  const map = dict?.items || {};
  if (Array.isArray(out.items)){
    out.items = out.items.map(it=>{
      if (!it?.id) return it;
      const tr = map[it.id];
      if (tr){
        if (tr.when_label) it.when_label = tr.when_label;
        if (tr.title)      it.title      = tr.title;
        if (tr.summary)    it.summary    = tr.summary;
        if (tr.details)    it.details    = tr.details;
      }
      return it;
    });
  }
  return out;
}
const DEFAULT_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtMonthYear = (d, months) => (months[d.getUTCMonth()]||DEFAULT_MONTHS[d.getUTCMonth()]) + NBSP + d.getUTCFullYear();

/* ---------- ЛЕГЕНДА ---------- */
function mountLegend(dict, wrap){
  const tPre    = dict?.legend?.pre    ?? 'Prerequisites';
  const tBase   = dict?.legend?.base   ?? 'Litigation period';
  const tFreeze = dict?.legend?.freeze ?? 'Asset freeze';
  const tFuture = dict?.legend?.future ?? 'Legal prospects';
  const tEventClickable = dict?.legend?.eventClickable ?? 'Event (clickable)'; // ▼ ДОБАВЛЕНО
  const tNow    = dict?.legend?.now    ?? 'Current time';                      // ▼ ДОБАВЛЕНО

  const el = document.createElement('div');
  el.className = 'lt-legend';
  el.innerHTML = html`
    <!-- ▼ ДОБАВЛЕНО: точка события — первым пунктом -->
    <div class="lt-leg-item"><span class="lt-dot" aria-hidden="true"></span><span>${esc(tEventClickable)}</span></div>

    <div class="lt-leg-item"><span class="lt-swatch pre"></span><span>${esc(tPre)}</span></div>
    <div class="lt-leg-item"><span class="lt-swatch base"></span><span>${esc(tBase)}</span></div>
    <div class="lt-leg-item"><span class="lt-swatch freeze"></span><span>${esc(tFreeze)}</span></div>
    <div class="lt-leg-item"><span class="lt-swatch future"></span><span>${esc(tFuture)}</span></div>

    <!-- ▼ ДОБАВЛЕНО: «настоящее время» — мигающий отрезок -->
    <div class="lt-leg-item"><span class="lt-swatch now" aria-hidden="true"></span><span>${esc(tNow)}</span></div>
  `;
  wrap.appendChild(el);
}

/* ---------- МОДАЛКИ ---------- */
function openEventModal(dict, itemOrGroup){
  const tMore   = dict?.modal?.more         ?? 'More details';
  const tClust  = dict?.modal?.clusterTitle ?? 'Events ({count})';
  const tSingle = dict?.modal?.singleTitle  ?? '{when} — {title}';

  if (Array.isArray(itemOrGroup)){
    const body = itemOrGroup.map(it => `
      <div style="padding-top:10px; margin-top:10px; border-top:1px dashed rgba(255,255,255,0.12)">
        <div style="font-weight:600">${esc(it.title||'')}</div>
        <div class="muted" style="margin:4px 0 6px 0">${esc(it.when_label||'')}</div>
        <div>${esc(it.summary||'')}</div>
        ${it.details ? `<div class="js-morebox" style="display:none; font-style:italic; color:#dfe7fb; margin-top:6px">${esc(it.details)}</div>
        <button class="btn js-more" style="margin-top:6px">${esc(tMore)}</button>`:''}
      </div>
    `).join('');
    openModal(fmt(tClust, { count:itemOrGroup.length }), body);
  } else {
    const it = itemOrGroup;
    const more = it.details
      ? `<div class="js-morebox" style="display:none; font-style:italic; color:#dfe7fb; margin-top:6px">${esc(it.details)}</div>
         <p><button class="btn js-more">${esc(tMore)}</button></p>`
      : '';
    openModal(
      fmt(tSingle, { when: esc(it.when_label||''), title: esc(it.title||'') }),
      `<div class="muted" style="margin-bottom:8px">${esc(it.summary||'')}</div>${more}`
    );
  }
}

/* ---------- ЖИЗНЕННЫЙ ЦИКЛ СТРАНИЦЫ ---------- */
export async function mount(container) {
  root = container;
  root.innerHTML = '';

  // локальные стили — как было
  const style = document.createElement('style');
  style.textContent = TPL_STYLE;

  // Шапка
  const head = document.createElement('div');
  head.className = 'lt-head';
  head.innerHTML = `<h3 class="lt-title">Legal Timeline</h3><div class="lt-meta">Loading…</div>`;

  // Таймлайн
  const wrap = document.createElement('div');
  wrap.className = 'lt-timeline';
  wrap.innerHTML = `
    <div class="lt-track">
      <div class="lt-pre"></div>
      <div class="lt-base"></div>
      <div class="lt-freeze"></div>
      <div class="lt-future"></div>
      <div class="lt-now"></div>
    </div>
  `;

  root.append(style, head, wrap);

  // Ссылки на элементы
  const track     = wrap.querySelector('.lt-track');
  const preLine   = wrap.querySelector('.lt-pre');
  const baseLine  = wrap.querySelector('.lt-base');
  const freezeLn  = wrap.querySelector('.lt-freeze');
  const futureLn  = wrap.querySelector('.lt-future');
  const nowEl     = wrap.querySelector('.lt-now');
  const titleEl   = head.querySelector('.lt-title');
  const metaEl    = head.querySelector('.lt-meta');

  // Словарь и данные
  const lang = getLang();
  const dict = await loadDict(lang);
  currentDict = dict;

  // Единый делегированный обработчик «Подробнее» — навешиваем один раз
  if (!onDocMoreClick) {
    onDocMoreClick = (e) => {
      const btn = e.target.closest('.js-more');
      if (!btn) return;

      const isBox = el => el && el.classList && el.classList.contains('js-morebox');

      // Ищем блок подробностей рядом с кнопкой
      let box = btn.previousElementSibling;
      if (!isBox(box)) box = btn.nextElementSibling;

      // fallback: если кнопка в <p>, проверяем соседние элементы
      if (!isBox(box)) {
        const p = btn.closest('p');
        if (p) {
          if (isBox(p.previousElementSibling)) box = p.previousElementSibling;
          else if (isBox(p.nextElementSibling)) box = p.nextElementSibling;
        }
      }
      if (!isBox(box)) return;

      // Переключаем состояние
      const opened = box.style.display !== 'none';
      box.style.display = opened ? 'none' : 'block';

      const d = currentDict || {};
      btn.textContent = opened
        ? (d?.modal?.more ?? 'More details')
        : (d?.modal?.less ?? 'Collapse');
    };
    document.addEventListener('click', onDocMoreClick, { passive: true });
  }

  titleEl.textContent = dict?.page?.title   ?? 'Legal Timeline';
  metaEl.textContent  = dict?.page?.loading ?? 'Loading…';

  const base = await loadBase().catch(() => null);
  if (!base){
    metaEl.textContent = dict?.page?.errorLoadJson ?? 'Failed to load json';
    return;
  }

  // «Updated …» — без версии
  const updated = new Date(base.meta?.updated_at || Date.now());
  const updatedDate = updated.toLocaleDateString(lang, { year:'numeric', month:'long', day:'numeric' });
  const updTpl = (dict?.meta?.updated_short) || (dict?.meta?.updated) || 'Updated: {date} • {user}';
  metaEl.textContent = fmt(updTpl, {
    date: updatedDate,
    user: base.meta?.updated_by || ''
  });

  // Локализуем элементы
  const data = mergeLocalized(base, dict);
  const items = (data.items||[]).slice().sort((a,b)=>{
    const ad = parseYM(a.date_start||a.date_end);
    const bd = parseYM(b.date_start||b.date_end);
    return ad - bd;
  });

  // Домены шкалы
  const PRE_START    = parseYM('2020-09-01');
  const FREEZE_START = parseYM('2021-07-01');
  const COURT_END    = parseYM('2026-11-01');
  const FUTURE_END   = new Date(COURT_END); FUTURE_END.setUTCMonth(FUTURE_END.getUTCMonth()+6);

  const domainStart = PRE_START;
  const domainEnd   = FUTURE_END;
  const spanMs      = domainEnd - domainStart;

  const { posH:PH, posV:PV } = posHelpers();
  const posR = d => clamp((d - domainStart) / spanMs, 0, 1);

  function placeLines(){
    const now = new Date();

    if (matchMedia('(max-width:820px)').matches){
      // Sep 2020 → Jul 2021
      const y0a = PV(posR(PRE_START))*100;
      const y0b = PV(posR(FREEZE_START))*100;
      preLine.style.left = '44px'; preLine.style.width = '2px';
      preLine.style.top = `calc(${y0a}% )`;
      preLine.style.height = Math.max(0.5, y0b - y0a) + '%';
      preLine.style.transform = 'translateX(-50%)';

      // Jul 2021 → Nov 2026
      const y1a = PV(posR(FREEZE_START))*100;
      const y1b = PV(posR(COURT_END))*100;
      baseLine.style.left = '44px'; baseLine.style.width = '4px';
      baseLine.style.top = `calc(${y1a}% )`;
      baseLine.style.height = Math.max(2, y1b - y1a) + '%';
      baseLine.style.transform = 'none';

      // Freeze (красная) — слева от base
      const yf1 = PV(posR(FREEZE_START))*100;
      const yf2 = PV(posR(now))*100;
      freezeLn.style.left = `calc(44px - var(--freeze-offset))`;
      freezeLn.style.top = `calc(${Math.min(yf1,yf2)}% - 6px)`;
      freezeLn.style.height = Math.max(2, Math.abs(yf2 - yf1)) + '%';
      freezeLn.style.width = '12px';

      // Future (пунктир)
      const yfe1 = PV(posR(COURT_END))*100;
      const yfe2 = PV(posR(FUTURE_END))*100;
      futureLn.style.left = '44px';
      futureLn.style.top = `calc(${Math.min(yfe1,yfe2)}% )`;
      futureLn.style.height = Math.max(2, Math.abs(yfe2 - yfe1)) + '%';
      futureLn.style.width = '0';

      // Now — горизонтальная на мобиле
      nowEl.style.left = 0; nowEl.style.width = '100%'; nowEl.style.height = '3px';
      nowEl.style.top = (PV(posR(now))*100) + '%';
    } else {
      const x0a = PH(posR(PRE_START))*100;
      const x0b = PH(posR(FREEZE_START))*100;
      preLine.style.left = x0a+'%';
      preLine.style.width = Math.max(0.5, x0b - x0a) + '%';

      const x1a = PH(posR(FREEZE_START))*100;
      const x1b = PH(posR(COURT_END))*100;
      baseLine.style.left = x1a+'%';
      baseLine.style.width = Math.max(2, x1b - x1a) + '%';

      const xf1 = PH(posR(FREEZE_START))*100;
      const xf2 = PH(posR(new Date()))*100;
      freezeLn.style.left = Math.min(xf1, xf2) + '%';
      freezeLn.style.width = Math.max(2, Math.abs(xf2 - xf1)) + '%';

      const xfe1 = PH(posR(COURT_END))*100;
      const xfe2 = PH(posR(FUTURE_END))*100;
      futureLn.style.left = Math.min(xfe1,xfe2) + '%';
      futureLn.style.width = Math.max(2, Math.abs(xfe2 - xfe1)) + '%';

      // Now — вертикальная (мигает)
      const xr = PH(posR(new Date()))*100;
      nowEl.style.left = xr+'%'; nowEl.style.top = 0; nowEl.style.bottom = 0;
      nowEl.style.width = '3px'; nowEl.style.height = '';
    }
  }

  // Кластеры точек (в пределах 60 дней)
  const TWO_MONTHS = 1000*60*60*24*60;
  const pointItems = items.filter(it => !(it.date_start && it.date_end)).slice().sort((a,b)=>{
    const ad = parseYM(a.date_start||a.date_end);
    const bd = parseYM(b.date_start||b.date_end);
    return ad - bd;
  });

  const clusters = [];
  let bucket = [];
  for (let i=0;i<pointItems.length;i++){
    const cur = pointItems[i];
    const curD = parseYM(cur.date_start||cur.date_end);
    if (bucket.length===0){ bucket.push(cur); continue; }
    const prevD = parseYM(bucket[bucket.length-1].date_start||bucket[bucket.length-1].date_end);
    if (curD - prevD <= TWO_MONTHS) bucket.push(cur);
    else { clusters.push(bucket); bucket=[cur]; }
  }
  if (bucket.length) clusters.push(bucket);

  // Рендер точек и вертикальных подписей
  const monthNames = Array.isArray(dict?.monthShort) && dict.monthShort.length===12 ? dict.monthShort : DEFAULT_MONTHS;
  const tDotTip = dict?.tooltip?.dot ?? 'Event — click for details';
  const tPluralEvent = dict?.legend?.event ?? 'Event';
  const tHint = dict?.legend?.eventHint ?? 'click for details';

  const dots = [];
  clusters.forEach(group => {
    const firstD = parseYM(group[0].date_start||group[0].date_end);
    const lastD  = parseYM(group[group.length-1].date_start||group[group.length-1].date_end);
    const center = new Date((firstD.getTime()+lastD.getTime())/2);

    const dot = document.createElement('div'); dot.className = 'lt-dot';
    const label = document.createElement('div'); label.className = 'lt-label';

    label.textContent = (group.length === 1)
      ? (group[0].when_label || '')
      : `${fmtMonthYear(firstD, monthNames)} – ${fmtMonthYear(lastD, monthNames)}`;

    function place(){
      if (matchMedia('(max-width:820px)').matches){
        const { posV } = posHelpers();
        const y = (posV(posR(center))*100);
        dot.style.top = `calc(${y}% - 8px)`; dot.style.left = '44px';
        label.style.left='60px'; label.style.top = dot.style.top;
      } else {
        const { posH } = posHelpers();
        const x = (posH(posR(center))*100) + '%';
        dot.style.left = x; dot.style.top = 'var(--lineY)';
        label.style.left = x; // top задаёт CSS (writing-mode)
      }
    }
    place();

    if (group.length === 1) {
      dot.title = tDotTip;
      dot.addEventListener('click', () => openEventModal(dict, group[0]));
    } else {
      dot.title = `${group.length} ${tPluralEvent} — ${tHint}`;
      dot.addEventListener('click', () => openEventModal(dict, group));
    }

    track.appendChild(dot);
    track.appendChild(label);
    dots.push({ dot, label, center });
  });

  // Легенда — отдельной нижней полосой (как и раньше)
  mountLegend(dict, wrap);

  // Линии и NOW
  placeLines();

  // Resize (с очисткой)
  onResizeHandler = function(){
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(()=>{
      placeLines();
      dots.forEach(ref=>{
        const center = new Date(ref.center);
        if (matchMedia('(max-width:820px)').matches){
          const { posV } = posHelpers();
          const y = (posV(posR(center))*100);
          ref.dot.style.top = `calc(${y}% - 8px)`; ref.dot.style.left = '44px';
          ref.label.style.left='60px'; ref.label.style.top = ref.dot.style.top;
        } else {
          const { posH } = posHelpers();
          const x = (posH(posR(center))*100) + '%';
          ref.dot.style.left = x; ref.dot.style.top = 'var(--lineY)';
          ref.label.style.left = x;
        }
      });
    }, 120);
  };
  window.addEventListener('resize', onResizeHandler, { passive:true });

  // Перерисовывать при смене языка без изменения внешнего вида
  if (typeof I18N.onLocaleChanged === 'function') {
    offLocaleCb = I18N.onLocaleChanged(() => {
      try { unmount(); } catch {}
      try { mount(container); } catch {}
    });
  }
}

export function unmount(){
  if (onResizeHandler) window.removeEventListener('resize', onResizeHandler);
  onResizeHandler = null;
  if (offLocaleCb) { try { offLocaleCb(); } catch {} offLocaleCb = null; }
  if (onDocMoreClick) { document.removeEventListener('click', onDocMoreClick); onDocMoreClick = null; }
  if (root) { root.innerHTML = ''; root = null; }
}

export default { mount, unmount };
