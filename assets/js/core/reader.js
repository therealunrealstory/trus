// assets/js/core/reader.js — cover fitted to dialog; text height = cover; single-scroll
import { t } from './i18n.js';
import { openModal } from './modal.js';

const DEFAULT_TITLE = 'The Real Unreal Story';
const _bookCache = new Map();

// ---------- utils ----------
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad3 = n => String(n).padStart(3,'0');
function normLang(raw){
  const short = (raw||'en').toString().split(/[-_]/)[0].toLowerCase();
  return { upper: short.toUpperCase(), lower: short };
}
function getCurrentLang(){
  const sel = document.querySelector('#lang');
  const raw = (sel && sel.value) || document.documentElement.getAttribute('lang') || 'en';
  return normLang(raw).upper;
}
function storageKey(version, L){ return `reader:last:${version}:${L}`; }
function modeKey(version, L, i){ return `reader:mode:${version}:${L}:${i}`; }
const readMode  = (v,L,i) => { try{ return localStorage.getItem(modeKey(v,L,i))||'cover'; }catch{ return 'cover'; } };
const writeMode = (v,L,i,m) => { try{ localStorage.setItem(modeKey(v,L,i), (m==='text'?'text':'cover')); }catch{} };

// ---------- data ----------
async function loadBook(version, L){
  const { lower } = normLang(L);
  const k = `${version}:${lower}`;
  if (_bookCache.has(k)) return _bookCache.get(k);
  const url = `/books/${version}/${lower}/book.json?ts=${Date.now()}`;
  const r = await fetch(url, { cache:'no-store' });
  if (!r.ok) throw new Error('reader.load.failed');
  const data = await r.json();
  if (!data || !Array.isArray(data.chapters) || !data.chapters.length) throw new Error('reader.empty');
  _bookCache.set(k, data);
  return data;
}

async function loadCoversIndex(version, L, book){
  const urls = [];
  if (book && book.coversIndex) urls.push(book.coversIndex);
  urls.push(`/books/covers.json?ts=${Date.now()}`);
  for (const u of urls){
    try{
      const r = await fetch(u, { cache:'no-store' });
      if (!r.ok) continue;
      const j = await r.json();
      if (j && typeof j==='object') return j;
    }catch{}
  }
  return null;
}
function coverUrl(covers, chapterIdx1){
  if (!covers) return null;
  const nnn = pad3(chapterIdx1);
  if (covers.chapters && covers.chapters[String(chapterIdx1)]) return covers.chapters[String(chapterIdx1)];
  if (covers.pattern) return String(covers.pattern).replace('{NNN}', nnn);
  return null;
}

// ---------- helpers ----------
const byId = id => document.getElementById(id);
const dialog = () => document.querySelector('.modal-backdrop .modal-dialog');
function chromeHeight(){
  const meta  = byId('readerMeta')?.offsetHeight || 0;
  const title = byId('readerTitle')?.offsetHeight || 0;
  const ctrls = byId('readerControls')?.offsetHeight || 0;
  const pads  = 40; // внутренние паддинги карточки
  return meta + title + ctrls + pads;
}

// computes stage height so that: 
//   1) it honors the image ratio (imgH/imgW)
//   2) it fits into the current dialog's max usable height (dialogHeightBudget)
function fittedStageHeight(imgW, imgH, stageEl){
  const stageW = stageEl?.clientWidth || 1;
  const desired = Math.round(stageW * (imgH && imgW ? (imgH/imgW) : (16/9)));
  const dlg = dialog();
  // если у диалога есть max-height (часто 80vh), то нам доступно:
  const maxDlg = Math.max(dlg?.clientHeight || Math.floor(window.innerHeight*0.8), 320);
  const usable = Math.max(maxDlg - chromeHeight(), 200);
  return Math.min(desired, usable);
}

// ---------- main ----------
export async function openReader(version='full', startIndex=NaN){
  document.dispatchEvent(new CustomEvent('pause-others', { detail:'reader' }));
  const L = getCurrentLang();
  let book = null;
  try{ book = await loadBook(version, L); }catch(e){ console.warn(e); }

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
        <button class="icon-btn" data-act="toc" title="${t('reader.toc','Table of contents')}" aria-label="${t('reader.toc','Table of contents')}">📖</button>
        <button class="icon-btn" data-act="prev" title="${t('reader.prev','Previous')}" aria-label="${t('reader.prev','Previous')}">◀</button>
        <button class="icon-btn" data-act="next" title="${t('reader.next','Next')}" aria-label="${t('reader.next','Next')}">▶</button>
        <button class="icon-btn" data-act="mode" title="${t('reader.mode','Cover/Text')}" aria-label="${t('reader.mode','Cover/Text')}">⤳</button>
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
  const covers = await loadCoversIndex(version, L, book);

  let current = Number.isFinite(startIndex) ? Math.max(0, startIndex|0) : (Number(localStorage.getItem(storageKey(version, L)))||0);
  current = Math.min(Math.max(0,current), book.chapters.length-1);

  let imgW=0, imgH=0; // natural size cache

  function updateButtons(){
    const total = book.chapters.length;
    btnPrev.disabled = current <= 0;
    btnNext.disabled = current >= total - 1;
  }
  const savePos = () => { try{ localStorage.setItem(storageKey(version, L), String(current)); }catch{} };

  function applyLayout(mode){
    const h = fittedStageHeight(imgW, imgH, stage);
    stack?.style.setProperty('--stage-h', h+'px');
    // фиксируем stage визуально корректно
    if (imgW && imgH) stage.style.aspectRatio = `${imgW}/${imgH}`;
    if (mode==='text'){
      stage.classList.add('is-text'); stack.classList.add('is-text'); ovl.classList.add('hidden');
      // у текста ровно высота сцены, один скролл внутри текста
      body.style.height = h+'px'; body.style.maxHeight = h+'px'; body.style.overflowY = 'auto';
      // модалка — без собственного скролла
      const dlg = dialog(); if (dlg) dlg.style.overflowY = 'hidden';
    } else {
      stage.classList.remove('is-text'); stack.classList.remove('is-text'); ovl.classList.remove('hidden');
      // текст — без скролла
      body.style.height = 'auto'; body.style.maxHeight='none'; body.style.overflow='visible';
      // модалка — скроллит, кнопки видны, сцена не больше её бюджета
      const dlg = dialog(); if (dlg) dlg.style.overflowY = 'auto';
    }
  }

  function openIdx(i){
    current = Math.min(Math.max(i,0), book.chapters.length-1);
    const ch = book.chapters[current];
    meta.textContent = `${t('reader.chapter','Chapter')} ${current+1} ${t('reader.of','of')} ${book.chapters.length}`;
    title.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${current+1}`;
    body.innerHTML = ch?.html || '';

    const cu = coverUrl(covers, current+1);
    if (cu){
      stage.classList.remove('hidden');
      bg.style.backgroundImage = `url("${cu}")`;
      const probe = new Image();
      probe.onload = ()=>{
        imgW = probe.naturalWidth || 768;
        imgH = probe.naturalHeight || 1365;
        requestAnimationFrame(()=> applyLayout(readMode(version, L, current)));
      };
      probe.src = cu;
    } else {
      stage.classList.add('hidden');
      stack.style.removeProperty('--stage-h');
      const dlg = dialog(); if (dlg) dlg.style.overflowY='auto';
      // обычный текст (как раньше)
      stage.classList.add('is-text'); stack.classList.add('is-text'); ovl.classList.add('hidden');
      body.style.height=''; body.style.maxHeight=''; body.style.overflowY='auto';
    }

    updateButtons(); savePos(); body.scrollTo({top:0, behavior:'auto'});
  }

  function renderToc(){
    const items = book.chapters.map((ch,i)=> `<button data-idx="${i}" class="block w-full text-left px-3 py-2 rounded hover:bg:white/5 text-sm">${esc(ch?.title || (t('reader.chapter','Chapter')+' '+(i+1)))}</button>`);
    toc.innerHTML = `<div class="rounded-2xl border border-gray-700 p-2" style="background:rgba(0,0,0,.25)">${items.join('')}</div>`;
    toc.addEventListener('click', e=>{
      const b = e.target.closest('button[data-idx]'); if (!b) return;
      openIdx(Number(b.getAttribute('data-idx'))||0);
      toc.classList.add('hidden');
    });
  }

  btnPrev.addEventListener('click', ()=> openIdx(current-1));
  btnNext.addEventListener('click', ()=> openIdx(current+1));
  btnToc .addEventListener('click', ()=> toc.classList.toggle('hidden'));
  btnMode.addEventListener('click', e=>{ e.preventDefault();
    const next = stage.classList.contains('is-text') ? 'cover' : 'text';
    writeMode(version, L, current, next);
    applyLayout(next);
  });
  ovlBtn.addEventListener('click', e=>{ e.preventDefault(); writeMode(version, L, current, 'text'); applyLayout('text'); });
  stage.addEventListener('dblclick', e=>{ e.preventDefault(); writeMode(version, L, current, 'text'); applyLayout('text'); });

  const onKey = (e)=>{
    if (!document.getElementById('modalBody')) return;
    if (e.key==='ArrowLeft'){ e.preventDefault(); openIdx(current-1); }
    if (e.key==='ArrowRight'){ e.preventDefault(); openIdx(current+1); }
  };
  document.addEventListener('keydown', onKey);

  const onResize = ()=>{ requestAnimationFrame(()=> applyLayout(readMode(version, L, current))); };
  window.addEventListener('resize', onResize);

  renderToc();
  openIdx(current);

  const modal = document.getElementById('modalBackdrop');
  const obs = new MutationObserver(()=>{
    if (!modal.classList.contains('show')){
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      // cleanup
      const dlg = dialog(); if (dlg){ dlg.style.overflowY=''; }
      const b = byId('readerBody'); if (b){ b.style.height=''; b.style.maxHeight=''; b.style.overflow=''; }
      obs.disconnect();
    }
  });
  obs.observe(modal, { attributes:true, attributeFilter:['class'] });
}
