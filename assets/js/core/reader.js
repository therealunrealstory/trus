// assets/js/core/reader.js — modal reader with bottom icon controls
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
  return '';
}

// ---------- main ----------
export async function openReader(version='full', startIndex=NaN){
  // пауза аудио
  document.dispatchEvent(new CustomEvent('pause-others', { detail: 'reader' }));

  const L = getCurrentLang();
  let book = null;
  try { book = await loadBook(version, L); }
  catch (e) { console.warn('reader.load.failed', e); }

  // модалка: заголовок из книги или дефолт; управление — снизу
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
      <div id="readerBody" class="text-sm leading-relaxed space-y-3"></div>

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

  // если книги нет — показываем ошибку и выходим
  if (!book) {
    if (body) body.innerHTML = `<div class="text-red-300">${t('reader.error','Failed to load the book. Please try again later.')}</div>`;
    return;
  }

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
  function openIdx(i){
    current = Math.min(Math.max(i,0), book.chapters.length-1);
    const ch = book.chapters[current];
    if (meta)  meta.textContent = `${t('reader.chapter','Chapter')} ${current+1} ${t('reader.of','of')} ${book.chapters.length}`;
    if (title) title.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${current+1}`;
    if (body)  body.innerHTML = ch?.html || '';
    updateButtons();
    savePos();
    // скроллим к началу текста при смене главы (мобайл-юзабилити)
    body?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
