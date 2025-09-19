// assets/js/core/reader.js — modal reader with bottom icon controls + cover-as-stage (stacked, meta+title ABOVE cover)
import { t } from './i18n.js';
import { openModal } from './modal.js';

const DEFAULT_TITLE = 'The Real Unreal Story';
const _bookCache = new Map(); // key = `${version}:${langLower}`

// ---------- utils ----------
function normalizeLang(input){
  const raw = (input || 'en').toString().trim();
  const short = raw.split(/[-_]/)[0].toLowerCase(); // "ru-RU" -> "ru"
  return { upper: short.toUpperCase(), lower: short };
}
function getCurrentLang(){
  const sel = document.querySelector('#lang');
  const raw = (sel && sel.value) || document.documentElement.getAttribute('lang') || 'en';
  return normalizeLang(raw).upper; // "RU"
}
function storageKey(version, langUpper){ return `reader:last:${version}:${langUpper}`; }
function modeKey(version, langUpper, chapterIdx0){ return `reader:mode:${version}:${langUpper}:${chapterIdx0}`; }
function readMode(version, langUpper, chapterIdx0){
  try { return localStorage.getItem(modeKey(version, langUpper, chapterIdx0)) || 'cover'; } catch { return 'cover'; }
}
function writeMode(version, langUpper, chapterIdx0, mode){
  try { localStorage.setItem(modeKey(version, langUpper, chapterIdx0), (mode==='text'?'text':'cover')); } catch {}
}

function htmlEscape(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function svg(name){
  // 24px, currentColor
  if (name === 'book') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 4h9a3 3 0 0 1 3 3v11.5a.5.5 0 0 1-.77.42A6.5 6.5 0 0 0 12 18H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm14 14V7a4 4 0 0 0-4-4H6"
            stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  if (name === 'prev') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (name === 'next') {
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (name === 'mode') {
    // simple book/eye hybrid
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 6.5c1.8-1.2 4-1.8 6.5-1.5 1.3.1 2.6.5 3.8 1.1M21 6.5c-1.8-1.2-4-1.8-6.5-1.5-1.3.1-2.6.5-3.8 1.1M3 17.5c1.8 1.2 4 1.8 6.5 1.5 1.3-.1 2.6-.5 3.8-1.1M21 17.5c-1.8 1.2-4 1.8-6.5 1.5-1.3-.1-2.6-.5-3.8-1.1"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" stroke-width="1.5"/>
    </svg>`;
  }
  return '';
}

function pad3(n){ return String(n).padStart(3,'0'); }

// ---------- covers index (shared for all languages/versions) ----------
async function loadCoversIndex(version, langUpper, book){
  // Приоритеты: (1) явная ссылка в книге (book.coversIndex), (2) общий /books/covers.json
  const tryUrls = [];
  if (book && book.coversIndex) tryUrls.push(book.coversIndex);
  tryUrls.push(`/books/covers.json?ts=${Date.now()}`); // общий для всех языков/версий

  for (const url of tryUrls){
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (data && typeof data === 'object') return data;
    } catch {/* ignore */}
  }
  return null;
}
function resolveCoverUrl(coversIndex, chapterIdx1){
  if (!coversIndex) return null;
  const nnn = pad3(chapterIdx1);
  if (coversIndex.chapters && coversIndex.chapters[String(chapterIdx1)]) {
    return coversIndex.chapters[String(chapterIdx1)];
  }
  if (coversIndex.pattern) {
    return String(coversIndex.pattern).replace('{NNN}', nnn);
  }
  return null;
}

// ---------- data ----------
async function loadBook(version, langUpper){
  const { lower } = normalizeLang(langUpper);
  const cacheKey = `${version}:${lower}`;
  if (_bookCache.has(cacheKey)) return _bookCache.get(cacheKey);

  const url = `/books/${version}/${lower}/book.json?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`reader.load.failed: ${url}`);
  const data = await res.json();
  if (!data || !Array.isArray(data.chapters) || !data.chapters.length) throw new Error('reader.empty');
  _bookCache.set(cacheKey, data);
  return data;
}

// ---------- main ----------
export async function openReader(version='full', startIndex=NaN){
  // пауза аудио
  document.dispatchEvent(new CustomEvent('pause-others', { detail: 'reader' }));

  const L = getCurrentLang();
  let book = null;
  try { book = await loadBook(version, L); }
  catch (e) { console.warn('reader.load.failed', e); }

  // модалка
  openModal(book?.title || DEFAULT_TITLE, `
    <div id="readerWrap" style="max-width:100%;overflow-x:hidden">
      <style>
        /* локальные правки только для модалки ридера */
        #readerWrap .icon-btn{
          display:inline-flex;align-items:center;justify-content:center;
          width:40px;height:40px;border-radius:12px;border:1px solid rgba(148,163,184,.35);
          background:rgba(17,24,39,.4);color:#fff;
        }
        #readerWrap .icon-btn:disabled{opacity:.5;cursor:not-allowed}
        #readerBody{word-break:break-word;overflow-wrap:anywhere}
        #readerToc button{color:#e5e7eb}
      </style>

      <div class="mb-2 text-xs opacity-80" id="readerMeta"></div>
      <h4 id="readerTitle" class="text-base font-semibold mb-2"></h4>

      <div id="readerStack" class="rstack">
        <div id="readerStage" class="rstage">
          <div class="rstage-bg" id="readerBg" role="img" aria-label="${t('reader.cover.alt','Chapter cover')}"></div>
          <div class="rstage-fog" id="readerFog" aria-hidden="true"></div>
          <div class="rstage-overlay" id="readerOverlay">
            <div class="rstage-title" id="rstageTitle"></div>
            <button class="rstage-read" id="rstageReadBtn">${t('reader.read','Read')}</button>
          </div>
        </div>

        <div id="readerBody" class="text-sm leading-relaxed space-y-3"></div>
      </div>

      <div id="readerControls" class="mt-4 flex items-center justify-center gap-3 flex-wrap">
        <button class="icon-btn" data-act="toc" title="${t('reader.toc','Table of contents')}" aria-label="${t('reader.toc','Table of contents')}">
          ${svg('book')}
        </button>
        <button class="icon-btn" data-act="prev" title="${t('reader.prev','Previous')}" aria-label="${t('reader.prev','Previous')}">
          ${svg('prev')}
        </button>
        <button class="icon-btn" data-act="next" title="${t('reader.next','Next')}" aria-label="${t('reader.next','Next')}">
          ${svg('next')}
        </button>
        <button class="icon-btn" data-act="mode" title="${t('reader.mode','Cover/Text')}" aria-label="${t('reader.mode','Cover/Text')}">
          ${svg('mode')}
        </button>
      </div>

      <div id="readerToc" class="mt-3 hidden"></div>
      <div class="mt-3 text-center text-[11px] opacity-80">${t('reader.hint','Use ←/→ to navigate, Esc to close')}</div>
    </div>
  `);

  // DOM ссылки
  const wrap  = document.getElementById('readerWrap');
  const meta  = document.getElementById('readerMeta');
  const title = document.getElementById('readerTitle');
  const body  = document.getElementById('readerBody');
  const toc   = document.getElementById('readerToc');
  const btnPrev = wrap.querySelector('[data-act="prev"]');
  const btnNext = wrap.querySelector('[data-act="next"]');
  const btnToc  = wrap.querySelector('[data-act="toc"]');
  const btnMode = wrap.querySelector('[data-act="mode"]');

  // stack + stage elements
  const stack = document.getElementById('readerStack');
  const stage = document.getElementById('readerStage');
  const bg    = document.getElementById('readerBg');
  const fog   = document.getElementById('readerFog');
  const ovl   = document.getElementById('readerOverlay');
  const ovlTitle = document.getElementById('rstageTitle');
  const ovlBtn   = document.getElementById('rstageReadBtn');

  // если книги нет — показываем ошибку и выходим
  if (!book) {
    if (body) body.innerHTML = `<div class="text-red-300">${t('reader.error','Failed to load the book. Please try again later.')}</div>`;
    return;
  }

  // Загрузим индекс обложек (общий)
  const coversIndex = await loadCoversIndex(version, L, book);

  // состояние
  let current = Number.isFinite(startIndex) ? Math.max(0, startIndex|0)
                                            : (Number(localStorage.getItem(storageKey(version, L)))||0);
  current = Math.min(Math.max(0,current), book.chapters.length-1);

  function savePos(){ try { localStorage.setItem(storageKey(version, L), String(current)); } catch {} }
  function updateButtons(){
    const total = book.chapters.length;
    btnPrev.disabled = current <= 0;
    btnNext.disabled = current >= total - 1;
    btnPrev.classList.toggle('opacity-50', btnPrev.disabled);
    btnNext.classList.toggle('opacity-50', btnNext.disabled);
  }

  // стабильный переключатель режима (без дребезга)
  let toggling = false;
  function safeSetMode(mode){ // 'cover' | 'text'
    if (!stage || toggling) return;
    toggling = true;
    // класс на сцене — для тумана/оверлея
    stage.classList.toggle('is-text', mode==='text');
    if (mode==='text'){ ovl?.classList.add('hidden'); }
    else { ovl?.classList.remove('hidden'); }
    // класс на стеке — для появления слоя текста
    stack?.classList.toggle('is-text', mode==='text');
    writeMode(version, L, current, mode);
    setTimeout(()=> { toggling = false; }, 120);
  }

  function openIdx(i){
    current = Math.min(Math.max(i,0), book.chapters.length-1);
    const ch = book.chapters[current];

    // мета/заголовок/контент
    if (meta)  meta.textContent = `${t('reader.chapter','Chapter')} ${current+1} ${t('reader.of','of')} ${book.chapters.length}`;
    if (title) title.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${current+1}`;
    if (body)  body.innerHTML = ch?.html || '';

    // обложка
    const cu = resolveCoverUrl(coversIndex, current+1);
    if (cu){
      stage?.classList.remove('hidden');
      if (bg) bg.style.backgroundImage = `url("${cu}")`;
      if (ovlTitle) ovlTitle.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${current+1}`;
      // подгоняем реальную пропорцию кадра -> меньше обрезаний
      const probe = new Image();
      probe.onload = () => {
        const w = probe.naturalWidth || 768, h = probe.naturalHeight || 1365;
        // 1. Выставляем aspect-ratio контейнера обложки
        stage.style.aspectRatio = `${w}/${h}`;
        stage.style.minHeight = ''; // страховку можно снять

        // 2. НОВОЕ: Задаем максимальную высоту для текста равной высоте обложки
        if (body) {
          // Даем браузеру отрисовать изменения и потом забираем высоту
          requestAnimationFrame(() => {
            body.style.maxHeight = `${stage.clientHeight}px`;
          });
        }
      };
      probe.src = cu;

      // режим по памяти
      const remembered = readMode(version, L, current);
      safeSetMode(remembered);

      // прелоад соседей
      const prevU = current>0 ? resolveCoverUrl(coversIndex, current) : null;
      const nextU = current<book.chapters.length-1 ? resolveCoverUrl(coversIndex, current+2) : null;
      if (prevU){ const img = new Image(); img.src = prevU; }
      if (nextU){ const img = new Image(); img.src = nextU; }
    } else {
      stage?.classList.add('hidden');
      safeSetMode('text');
    }

    updateButtons();
    savePos();
    // скролл к началу текста при смене главы (на мобиле особенно)
    body?.scrollTo({ top:0, behavior:'smooth' });
  }

  function renderToc(){
    const items = book.chapters.map((ch,i)=> `<button data-idx="${i}" class="block w-full text-left px-3 py-2 rounded hover:bg-white/5 text-sm">${htmlEscape(ch?.title || (t('reader.chapter','Chapter')+' '+(i+1)))}</button>`);
    toc.innerHTML = `<div class="rounded-2xl border border-gray-700 p-2" style="background:rgba(0,0,0,.25)">${items.join('')}</div>`;
    toc.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-idx]'); if (!b) return;
      const idx = Number(b.getAttribute('data-idx'))||0;
      openIdx(idx);
      toc.classList.add('hidden');
    });
  }

  // кнопки
  btnPrev.addEventListener('click', ()=> openIdx(current-1));
  btnNext.addEventListener('click', ()=> openIdx(current+1));
  btnToc .addEventListener('click', ()=> toc.classList.toggle('hidden'));
  btnMode?.addEventListener('click', (e)=> {
    e.preventDefault(); e.stopPropagation();
    const next = (stage?.classList.contains('is-text')) ? 'cover' : 'text';
    safeSetMode(next);
  });
  ovlBtn?.addEventListener('click', (e)=> { e.preventDefault(); e.stopPropagation(); safeSetMode('text'); });
  // бонус: двойной клик по сцене — тоже "читать"
  stage?.addEventListener('dblclick', (e)=> { e.preventDefault(); e.stopPropagation(); safeSetMode('text'); });

  // клавиатура
  const onKey = (e)=>{
    if (!document.getElementById('modalBody')) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); openIdx(current-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); openIdx(current+1); }
  };
  document.addEventListener('keydown', onKey);

  // рендер
  renderToc();
  openIdx(current);

  // снятие слушателя при закрытии модалки
  const modal = document.getElementById('modalBackdrop');
  const obs = new MutationObserver(()=>{
    if (!modal.classList.contains('show')){
      document.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(modal, { attributes:true, attributeFilter:['class'] });
}