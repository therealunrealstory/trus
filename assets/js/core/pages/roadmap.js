// /assets/js/core/pages/roadmap.js
// Вкладка «Хронология»: без блока легенды, пульс перенесён в заголовок "Сейчас".

import * as DOM from '../dom.js';
import * as I18N from '../i18n.js';

const qs        = DOM.qs        || ((sel, root = document) => root.querySelector(sel));
const createEl  = DOM.createEl  || ((tag, attrs = {}) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  return el;
});
const on        = DOM.on        || ((target, type, handler, opts) => {
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
});

const getLocale       = I18N.getLocale       || (() => (document.documentElement.lang || 'en'));
const onLocaleChanged = I18N.onLocaleChanged || (() => () => {});

let cleanup = [];
let state = { locale: null, data: null, i18n: null };

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

function esc(s){ return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function fmtDate(iso){ if(!iso) return ''; try{ return new Date(iso).toLocaleDateString(undefined,{year:'numeric',month:'short'});}catch{return String(iso);} }

function mergeLocalized(data, dict) {
  const clone = structuredClone(data ?? {});
  const mapItem = (it) => {
    if (!it || !it.id) return it;
    const loc = dict?.items?.[it.id];
    if (loc) {
      it.when_label = loc.when_label ?? it.when_label;
      it.title      = loc.title      ?? it.title;
      it.summary    = loc.summary    ?? it.summary;
      it.details    = loc.details    ?? it.details;
    }
    return it;
  };
  clone.items = (clone.items || []).map(mapItem);
  return clone;
}

function statusLabel(s){ return (s==='done')?'done':(s==='current')?'current':(s==='planned')?'planned':(s==='tentative')?'tentative':(s||''); }
function normalizeLabels(it){ if (Array.isArray(it.labels)&&it.labels.length) return it.labels.map(cleanLabel); if (typeof it.type==='string'&&it.type.trim()) return it.type.split('+').map(cleanLabel); return []; }
function cleanLabel(s){ return (s||'').toString().trim().toLowerCase(); }
function pretty(t){ const map={'rt':'RT','car-t':'CAR-T','car-t':'CAR-T','tki':'TKI','mi':'MI'}; if(map[t]) return map[t]; return t.split(' ').map(w=>w?(w[0].toUpperCase()+w.slice(1)):w).join(' '); }

function tLabel(key, dict){
  const k = (key || '').toLowerCase();
  return dict?.labels?.[k] || pretty(k);
}

function labelFromDates(it){ const a=fmtDate(it.date_start); const b=fmtDate(it.date_end); if(a&&b) return `${a} – ${b}`; return a||b||(it.year?String(it.year):'TBD'); }

function confidenceDots(it, dict){
  if(!(it.status==='planned'||it.status==='tentative')) return '';
  const c=(it.confidence||'').toLowerCase();
  const dots = (c==='high')
    ? '<span class="roadmap-dot high"></span><span class="roadmap-dot high"></span><span class="roadmap-dot high"></span>'
    : (c==='medium')
      ? '<span class="roadmap-dot medium"></span><span class="roadmap-dot medium"></span><span class="roadmap-dot"></span>'
      : '<span class="roadmap-dot low"></span><span class="roadmap-dot"></span><span class="roadmap-dot"></span>';
  const word = dict?.ui?.confidence || 'confidence';
  return ` · ${esc(word)} <span class="roadmap-conf">${dots}</span>`;
}

function sortByTime(a,b){
  const getKey=(x)=>{ const y=Number(x.year)||0; const d=x.date_start||x.date_end||`${y}-01-01`; return `${y}-${d}`; };
  return getKey(a)>getKey(b)?1:-1;
}

function render(container, data, dict){
  container.innerHTML='';

  const ui = dict?.ui || {};
  const tTitle=ui.page_title||'Treatment Roadmap';
  const tMetaUpd=ui.meta_updated||'Updated';
  const tSecCompleted=ui.section_completed||'Completed';
  const tSecNow=ui.section_now||'Now';
  const tSecPlans=ui.section_plans||'Plans';
  const tNoEntries=ui.no_entries||'No entries yet.';
  const tBtnDetails=ui.btn_details||'Details';
  const tBtnHide=ui.btn_hide||'Hide';
  const tNotice=ui.notice_tbd||'“TBD” = “to be determined”…';

  const header=createEl('div',{class:'roadmap-head'});
  const h1=createEl('h1',{class:'roadmap-title'}); h1.textContent=tTitle;
  const meta=createEl('div',{class:'roadmap-meta'});
  const when=data?.meta?.updated_at?new Date(data.meta.updated_at).toLocaleString():'—';
  const by=data?.meta?.updated_by?` • ${data.meta.updated_by}`:'';
  meta.textContent=`${tMetaUpd} ${when}${by}`;
  header.append(h1,meta);
  container.appendChild(header);

  const items=(data?.items||[]).slice().sort(sortByTime);
  const done=items.filter(i=>i.status==='done');
  const current=items.filter(i=>i.status==='current').slice(0,1);
  const plans=items.filter(i=>i.status==='planned'||i.status==='tentative');

  const grid=createEl('div',{class:'roadmap-grid'});
  grid.appendChild(makeColumn('completed',tSecCompleted,done,{collapsed:true,tNoEntries,tBtnDetails,tBtnHide}));
  grid.appendChild(makeColumn('now',tSecNow,current,{collapsed:false,tNoEntries,tBtnDetails,tBtnHide,emphasizeNow:true}));
  grid.appendChild(makeColumn('plans',tSecPlans,plans,{collapsed:true,tNoEntries,tBtnDetails,tBtnHide}));
  container.appendChild(grid);

  const notice=createEl('div',{class:'roadmap-notice'});
  notice.innerHTML=esc(tNotice);
  container.appendChild(notice);

  const m=location.hash.match(/^#\/roadmap\/(.+)$/);
  if(m&&m[1]){
    const el=container.querySelector(`[data-id="${CSS.escape(m[1])}"]`);
    if(el){
      const col=el.closest('.roadmap-col');
      if(col?.classList.contains('is-collapsed')){
        col.classList.remove('is-collapsed');
        const btn=col.querySelector('.roadmap-toggle');
        if(btn) btn.setAttribute('aria-expanded','true');
      }
      el.classList.add('highlight');
      el.scrollIntoView({behavior:'smooth',block:'center'});
      const tid=setTimeout(()=>el.classList.remove('highlight'),2200);
      cleanup.push(()=>clearTimeout(tid));
    }
  }
}

function makeColumn(kind,titleText,list,opts){
  const {collapsed=false,tNoEntries,tBtnDetails,tBtnHide,emphasizeNow=false}=opts||{};
  const section=createEl('section',{class:'roadmap-col'+(collapsed?' is-collapsed':'')});
  const header=createEl('header');
  const toggle=createEl('button',{class:'roadmap-toggle','aria-expanded':String(!collapsed),'aria-controls':`list-${kind}`});

  // Добавляем пульсирующую точку в заголовок "Сейчас"
  if (emphasizeNow) {
    toggle.innerHTML=`<span class="roadmap-caret">▾</span><span>${esc(titleText)} <span class="roadmap-nowpulse" style="margin-left:6px"></span></span>`;
  } else {
    toggle.innerHTML=`<span class="roadmap-caret">▾</span><span>${esc(titleText)}</span>`;
  }

  header.appendChild(toggle);

  const listEl=createEl('div',{class:'roadmap-list',id:`list-${kind}`,role:'region','aria-label':titleText});
  const clickHandler=(e)=>{ if(e.target.closest('.roadmap-toggle')!==toggle) return; const isOpen=!section.classList.contains('is-collapsed'); section.classList.toggle('is-collapsed',isOpen); toggle.setAttribute('aria-expanded',String(isOpen?false:true)); };
  header.addEventListener('click',clickHandler);
  cleanup.push(()=>header.removeEventListener('click',clickHandler));

  if(!list?.length){
    const p=createEl('div',{class:'roadmap-item'}); p.textContent=tNoEntries||'No entries yet.'; listEl.appendChild(p);
  }else{
    list.forEach(it=>listEl.appendChild(makeCard(it,{tBtnDetails,tBtnHide,emphasizeNow})));
  }
  section.append(header,listEl);
  return section;
}

function makeCard(it,{tBtnDetails,tBtnHide,emphasizeNow}){
  const wrap=createEl('article',{class:`roadmap-item ${it.status||''}`,'data-id':it.id||''});
  const top=createEl('div',{class:'roadmap-topline'});
  const left=createEl('div');
  const title=createEl('div',{class:'roadmap-title-sm'}); title.textContent=it.title||'';
  const when=createEl('div',{class:'roadmap-when'}); when.innerHTML=`${esc(it.when_label||labelFromDates(it))}${confidenceDots(it, state.i18n)}`;
  left.append(title,when);

  const badges=createEl('div',{class:'roadmap-badges'});
  badges.appendChild(makeBadge(statusLabel(it.status), state.i18n));
  normalizeLabels(it).forEach(l=>badges.appendChild(makeBadge(l, state.i18n)));
  top.append(left,badges);

  const summary=createEl('div',{class:'roadmap-summary'}); summary.textContent=it.summary||'';
  const details=createEl('div',{class:'roadmap-details'}); details.textContent=it.details||'';
  const actions=createEl('div',{class:'roadmap-actions'});
  const btn=createEl('button',{class:'roadmap-btn'}); btn.textContent=tBtnDetails||'Details';
  const onToggle=()=>{ const vis=details.style.display==='block'; details.style.display=vis?'none':'block'; btn.textContent=vis?(tBtnDetails||'Details'):(tBtnHide||'Hide'); };
  btn.addEventListener('click',onToggle);
  cleanup.push(()=>btn.removeEventListener('click',onToggle));
  actions.appendChild(btn);

  wrap.append(top,summary,details,actions);
  return wrap;
}

function makeBadge(text, dict){
  const t=(text||'').toLowerCase();
  const span=createEl('span',{class:'roadmap-badge'+(['done','current','planned','tentative'].includes(t)?(' status-'+t):'')});
  span.textContent=tLabel(t, dict);
  return span;
}

async function loadAll(){
  const locale = getLocale();
  state.locale = locale;
  if(!state.data){ state.data = await loadJSON('/partials/roadmap.json'); }
  const lc = (locale || '').toLowerCase();
  state.i18n = await loadJSON(`/i18n/roadmap/${lc}.json`).catch(() => ({}));
  return mergeLocalized(state.data, state.i18n);
}

export async function init(mountArg){
  let mount = mountArg;
  if (mount && typeof mount === 'object' && 'mount' in mount) mount = mount.mount;
  if (typeof mount === 'string') mount = qs(mount);
  const root = mount || qs('#subpage');
  if (!root) return;

  const page = createEl('section');
  root.innerHTML = '';
  root.appendChild(page);

  const merged = await loadAll();
  render(page, merged, state.i18n);

  const unSub = onLocaleChanged(async () => {
    const merged2 = await loadAll();
    render(page, merged2, state.i18n);
  });
  cleanup.push(unSub);

  const offDoc = on(document, 'click', () => {});
  cleanup.push(offDoc);
}

export function destroy(){
  cleanup.forEach(fn => { try{ fn(); } catch(e){} });
  cleanup = [];
}
