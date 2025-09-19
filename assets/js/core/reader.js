// assets/js/core/reader.js — hardened: modal height >= cover; single-scroll; clears ancestor caps
import { t } from './i18n.js';
import { openModal } from './modal.js';

const DEFAULT_TITLE = 'The Real Unreal Story';
const _bookCache = new Map();

const clamp = (n,min,max)=> Math.min(Math.max(n,min),max);

function normalizeLang(input){
  const raw = (input || 'en').toString().trim();
  const short = raw.split(/[-_]/)[0].toLowerCase();
  return { upper: short.toUpperCase(), lower: short };
}
function getCurrentLang(){
  const sel = document.querySelector('#lang');
  const raw = (sel && sel.value) || document.documentElement.getAttribute('lang') || 'en';
  return normalizeLang(raw).upper;
}
function storageKey(version, langUpper){ return `reader:last:${version}:${langUpper}`; }
function modeKey(version, langUpper, chapterIdx0){ return `reader:mode:${version}:${langUpper}:${chapterIdx0}`; }
function readMode(version, langUpper, chapterIdx0){ try { return localStorage.getItem(modeKey(version, langUpper, chapterIdx0)) || 'cover'; } catch { return 'cover'; } }
function writeMode(version, langUpper, chapterIdx0, mode){ try { localStorage.setItem(modeKey(version, langUpper, chapterIdx0), (mode==='text'?'text':'cover')); } catch {} }

function htmlEscape(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function svg(name){
  if (name === 'book') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 4h9a3 3 0 0 1 3 3v11.5a.5.5 0 0 1-.77.42A6.5 6.5 0 0 0 12 18H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm14 14V7a4 4 0 0 0-4-4H6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (name === 'prev') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (name === 'next') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (name === 'mode') return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 6.5c1.8-1.2 4-1.8 6.5-1.5 1.3.1 2.6.5 3.8 1.1M21 6.5c-1.8-1.2-4-1.8-6.5-1.5-1.3.1-2.6.5-3.8 1.1M3 17.5c1.8 1.2 4 1.8 6.5 1.5 1.3-.1 2.6-.5 3.8-1.1M21 17.5c-1.8 1.2-4 1.8-6.5 1.5-1.3-.1-2.6-.5-3.8-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="12" r="2.4" stroke="currentColor" stroke-width="1.5"/></svg>`;
  return '';
}
function pad3(n){ return String(n).padStart(3,'0'); }

async function loadCoversIndex(version, langUpper, book){
  const tryUrls = [];
  if (book && book.coversIndex) tryUrls.push(book.coversIndex);
  tryUrls.push(`/books/covers.json?ts=${Date.now()}`);
  for (const url of tryUrls){ try { const r = await fetch(url, {cache:'no-store'}); if (!r.ok) continue; const j = await r.json(); if (j && typeof j==='object') return j; } catch {} }
  return null;
}
function resolveCoverUrl(coversIndex, chapterIdx1){
  if (!coversIndex) return null;
  const nnn = pad3(chapterIdx1);
  if (coversIndex.chapters && coversIndex.chapters[String(chapterIdx1)]) return coversIndex.chapters[String(chapterIdx1)];
  if (coversIndex.pattern) return String(coversIndex.pattern).replace('{NNN}', nnn);
  return null;
}
async function loadBook(version, langUpper){
  const { lower } = normalizeLang(langUpper);
  const key = `${version}:${lower}`;
  if (_bookCache.has(key)) return _bookCache.get(key);
  const url = `/books/${version}/${lower}/book.json?ts=${Date.now()}`;
  const res = await fetch(url, { cache:'no-store' });
  if (!res.ok) throw new Error('reader.load.failed');
  const data = await res.json();
  if (!data || !Array.isArray(data.chapters) || !data.chapters.length) throw new Error('reader.empty');
  _bookCache.set(key, data); return data;
}

// --- DOM helpers ---
const byId = id => document.getElementById(id);
const getDlg = () => document.querySelector('.modal-backdrop .modal-dialog') || byId('modalBody')?.parentElement;
const getModalBody = () => byId('modalBody');

// remove height caps on ancestors (with !important)
function clearAncestorCaps(el){
  let cur = el;
  for (let i=0; i<6 && cur; i++){
    ['max-height','height'].forEach(p=> cur.style.setProperty(p,'', 'important'));
    cur = cur.parentElement;
  }
}

// apply caps on dialog to match cover height (+chrome)
function sizeDialogForCover(coverH){
  const dlg = getDlg(); const mBody = getModalBody();
  if (!dlg || !mBody) return;
  // chrome (meta+title+controls+paddings)
  const metaH  = byId('readerMeta')?.offsetHeight || 0;
  const titleH = byId('readerTitle')?.offsetHeight || 0;
  const ctrlsH = byId('readerControls')?.offsetHeight || 0;
  const pads   = 40; // усреднённо
  const desired = Math.ceil(coverH + metaH + titleH + ctrlsH + pads);
  const maxH = Math.floor(window.innerHeight * 0.95);
  const H = clamp(desired, Math.min(360, window.innerHeight*0.6), maxH); // не меньше умеренного минимума

  // сначала очищаем любые внешние блокировки
  clearAncestorCaps(dlg);
  clearAncestorCaps(mBody);

  dlg.style.setProperty('max-height', H+'px', 'important');
  dlg.style.setProperty('height', H+'px', 'important');
  dlg.style.setProperty('overflow-y', 'auto', 'important');

  mBody.style.setProperty('max-height', 'none', 'important');
  mBody.style.setProperty('height', 'auto', 'important');
  mBody.style.setProperty('overflow-y', 'visible', 'important');
}

export async function openReader(version='full', startIndex=NaN){
  document.dispatchEvent(new CustomEvent('pause-others', { detail:'reader' }));

  const L = getCurrentLang();
  let book = null;
  try { book = await loadBook(version, L); } catch(e){ console.warn(e); }

  openModal(book?.title || DEFAULT_TITLE, `
    <div id="readerWrap" style="max-width:100%;overflow-x:hidden">
      <style>
        #readerWrap .icon-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;border:1px solid rgba(148,163,184,.35);background:rgba(17,24,39,.4);color:#fff}
        #readerWrap .icon-btn:disabled{opacity:.5;cursor:not-allowed}
        #readerBody{word-break:break-word;overflow-wrap:anywhere}
        #readerToc button{color:#e5e7eb}
      </style>

      <div class="mb-2 text-xs opacity-80" id="readerMeta"></div>
      <h4 id="readerTitle" class="text-base font-semibold mb-2"></h4>

      <div id="readerStack" class="rstack">
        <div id="readerStage" class="rstage">
          <div class="rstage-bg" id="readerBg"></div>
          <div class="rstage-fog" id="readerFog" aria-hidden="true"></div>
          <div class="rstage-overlay" id="readerOverlay">
            <button class="rstage-read" id="rstageReadBtn">${t('reader.read','Read')}</button>
          </div>
        </div>
        <div id="readerBody" class="text-sm leading-relaxed space-y-3"></div>
      </div>

      <div id="readerControls" class="mt-4 flex items-center justify-center gap-3 flex-wrap">
        <button class="icon-btn" data-act="toc" title="${t('reader.toc','Table of contents')}" aria-label="${t('reader.toc','Table of contents')}">${svg('book')}</button>
        <button class="icon-btn" data-act="prev" title="${t('reader.prev','Previous')}" aria-label="${t('reader.prev','Previous')}">${svg('prev')}</button>
        <button class="icon-btn" data-act="next" title="${t('reader.next','Next')}" aria-label="${t('reader.next','Next')}">${svg('next')}</button>
        <button class="icon-btn" data-act="mode" title="${t('reader.mode','Cover/Text')}" aria-label="${t('reader.mode','Cover/Text')}">${svg('mode')}</button>
      </div>

      <div id="readerToc" class="mt-3 hidden"></div>
      <div class="mt-3 text-center text-[11px] opacity-80">${t('reader.hint','Use ←/→ to navigate, Esc to close')}</div>
    </div>
  `);

  const meta  = byId('readerMeta');
  const title = byId('readerTitle');
  const body  = byId('readerBody');
  const toc   = byId('readerToc');
  const btnPrev = document.querySelector('#readerWrap [data-act="prev"]');
  const btnNext = document.querySelector('#readerWrap [data-act="next"]');
  const btnToc  = document.querySelector('#readerWrap [data-act="toc"]');
  const btnMode = document.querySelector('#readerWrap [data-act="mode"]');

  const stack = byId('readerStack');
  const stage = byId('readerStage');
  const bg    = byId('readerBg');
  const ovl   = byId('readerOverlay');
  const ovlBtn= byId('rstageReadBtn');

  if (!book){ body.innerHTML = `<div class="text-red-300">${t('reader.error','Failed to load the book.')}</div>`; return; }
  const coversIndex = await loadCoversIndex(version, L, book);

  let current = Number.isFinite(startIndex) ? Math.max(0, startIndex|0) : (Number(localStorage.getItem(storageKey(version, L)))||0);
  current = Math.min(Math.max(0,current), book.chapters.length-1);

  function updateButtons(){
    const total = book.chapters.length;
    btnPrev.disabled = current <= 0;
    btnNext.disabled = current >= total - 1;
    btnPrev.classList.toggle('opacity-50', btnPrev.disabled);
    btnNext.classList.toggle('opacity-50', btnNext.disabled);
  }
  function savePos(){ try { localStorage.setItem(storageKey(version, L), String(current)); } catch {} }

  function applyTextModeStyles(coverH){
    // внутри текста — ровно высота обложки
    body.style.setProperty('height', `${Math.round(coverH)}px`, 'important');
    body.style.setProperty('max-height', `${Math.round(coverH)}px`, 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');

    // внешняя модалка — не скроллит
    const dlg = getDlg();
    if (dlg) dlg.style.setProperty('overflow-y','hidden','important');
  }
  function applyCoverModeStyles(coverH){
    // текст свободен
    body.style.setProperty('height', 'auto', 'important');
    body.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('overflow', 'visible', 'important');
    // диалог подгоняем под обложку
    sizeDialogForCover(coverH);
  }

  function measureAndApply(){
    const rect = stage?.getBoundingClientRect();
    const coverH = rect ? rect.height : 0;
    stack?.style.setProperty('--stage-h', `${Math.round(coverH)}px`);
    if (stage?.classList.contains('is-text')) applyTextModeStyles(coverH);
    else applyCoverModeStyles(coverH);
  }

  let toggling = false;
  function setMode(mode){ // 'cover' | 'text'
    if (!stage || toggling) return;
    toggling = true;
    stage.classList.toggle('is-text', mode==='text');
    stack?.classList.toggle('is-text', mode==='text');
    if (mode==='text'){ ovl?.classList.add('hidden'); } else { ovl?.classList.remove('hidden'); }
    writeMode(version, L, current, mode);
    requestAnimationFrame(()=>{ measureAndApply(); toggling=false; });
  }

  function openIdx(i){
    current = Math.min(Math.max(i,0), book.chapters.length-1);
    const ch = book.chapters[current];
    meta.textContent = `${t('reader.chapter','Chapter')} ${current+1} ${t('reader.of','of')} ${book.chapters.length}`;
    title.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${current+1}`;
    body.innerHTML = ch?.html || '';

    const cu = resolveCoverUrl(coversIndex, current+1);
    if (cu){
      stage.classList.remove('hidden');
      bg.style.backgroundImage = `url("${cu}")`;
      const probe = new Image();
      probe.onload = ()=>{
        const w = probe.naturalWidth || 768, h = probe.naturalHeight || 1365;
        stage.style.aspectRatio = `${w}/${h}`;
        stage.style.minHeight = '';
        requestAnimationFrame(measureAndApply);
      };
      probe.src = cu;

      setMode(readMode(version, L, current));
      // preload neighbors
      const p = current>0 ? resolveCoverUrl(coversIndex, current) : null;
      const n = current<book.chapters.length-1 ? resolveCoverUrl(coversIndex, current+2) : null;
      if (p){ const i1 = new Image(); i1.src = p; }
      if (n){ const i2 = new Image(); i2.src = n; }
    } else {
      stage.classList.add('hidden');
      stack.style.removeProperty('--stage-h');
      // без обложки — обычное поведение модалки
      const dlg = getDlg(); const mBody = getModalBody();
      if (dlg){ dlg.style.removeProperty('height'); dlg.style.removeProperty('max-height'); dlg.style.removeProperty('overflow-y'); }
      if (mBody){ mBody.style.removeProperty('height'); mBody.style.removeProperty('max-height'); }
      setMode('text');
    }

    updateButtons(); savePos(); body.scrollTo({ top:0, behavior:'auto' });
  }

  function renderToc(){
    const items = book.chapters.map((ch,i)=> `<button data-idx="${i}" class="block w-full text-left px-3 py-2 rounded hover:bg-white/5 text-sm">${htmlEscape(ch?.title || (t('reader.chapter','Chapter')+' '+(i+1)))}</button>`);
    toc.innerHTML = `<div class="rounded-2xl border border-gray-700 p-2" style="background:rgba(0,0,0,.25)">${items.join('')}</div>`;
    toc.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-idx]'); if (!b) return;
      openIdx(Number(b.getAttribute('data-idx'))||0);
      toc.classList.add('hidden');
    });
  }

  btnPrev.addEventListener('click', ()=> openIdx(current-1));
  btnNext.addEventListener('click', ()=> openIdx(current+1));
  btnToc .addEventListener('click', ()=> toc.classList.toggle('hidden'));
  btnMode.addEventListener('click', (e)=>{ e.preventDefault(); const next = (stage.classList.contains('is-text')?'cover':'text'); setMode(next); });
  ovlBtn.addEventListener('click', (e)=>{ e.preventDefault(); setMode('text'); });
  stage.addEventListener('dblclick', (e)=>{ e.preventDefault(); setMode('text'); });

  const onKey = (e)=>{
    if (!document.getElementById('modalBody')) return;
    if (e.key==='ArrowLeft'){ e.preventDefault(); openIdx(current-1); }
    if (e.key==='ArrowRight'){ e.preventDefault(); openIdx(current+1); }
  };
  document.addEventListener('keydown', onKey);

  const onResize = ()=>{ requestAnimationFrame(measureAndApply); };
  window.addEventListener('resize', onResize);

  renderToc();
  openIdx(current);

  const modal = byId('modalBackdrop');
  const obs = new MutationObserver(()=>{
    if (!modal.classList.contains('show')){
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      const dlg = getDlg(); const mBody = getModalBody();
      if (dlg){ dlg.style.removeProperty('height'); dlg.style.removeProperty('max-height'); dlg.style.removeProperty('overflow-y'); }
      if (mBody){ mBody.style.removeProperty('height'); mBody.style.removeProperty('max-height'); mBody.style.removeProperty('overflow-y'); }
      obs.disconnect();
    }
  });
  obs.observe(modal, { attributes:true, attributeFilter:['class'] });
}
