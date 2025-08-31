// assets/js/core/reader.js — CLEAN (single responsibility: modal reader)
import { t } from './i18n.js';
import { openModal } from './modal.js';

const TITLE_STATIC = 'The Real Unreal Story'; // keep original title across languages
const _bookCache = new Map(); // key = `${version}:${langLower}`

function getCurrentLang(){
  const sel = document.querySelector('#lang');
  const v = (sel && sel.value) || document.documentElement.getAttribute('lang') || 'EN';
  return String(v).toUpperCase();
}
function langFolder(lang){ return String(lang||'EN').toLowerCase(); }
function storageKey(version, lang){ return `reader:last:${version}:${String(lang||'EN').toUpperCase()}`; }

async function loadBook(version, langUpper){
  const key = `${version}:${langFolder(langUpper)}`;
  if (_bookCache.has(key)) return _bookCache.get(key);

  const url = `/books/${version}/${langFolder(langUpper)}/book.json?ts=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('reader.load.failed');
  const data = await res.json();
  if (!data || !Array.isArray(data.chapters) || !data.chapters.length) throw new Error('reader.empty');
  _bookCache.set(key, data);
  return data;
}

function htmlEscape(s){
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

export async function openReader(version='full', startIndex=NaN){
  // Pause any audio (the Story page listens for this event)
  document.dispatchEvent(new CustomEvent('pause-others', { detail: 'reader' }));

  // Modal skeleton
  openModal(TITLE_STATIC, `
    <div id="readerWrap">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="text-xs opacity-80" id="readerMeta"></div>
        <div class="flex gap-2">
          <button class="px-3 py-1 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-xs" data-act="toc">${t('reader.toc','Table of contents')}</button>
          <button class="px-3 py-1 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-xs" data-act="prev">‹ ${t('reader.prev','Previous')}</button>
          <button class="px-3 py-1 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-xs" data-act="next">${t('reader.next','Next')} ›</button>
        </div>
      </div>
      <h4 id="readerTitle" class="text-base font-semibold mb-2"></h4>
      <div id="readerBody" class="text-sm leading-relaxed space-y-3"></div>
      <div id="readerToc" class="mt-4 hidden"></div>
      <div class="mt-4 text-right text-[11px] opacity-80">${t('reader.hint','Use ←/→ to navigate, Esc to close')}</div>
    </div>
  `);

  const wrap  = document.getElementById('readerWrap');
  const meta  = document.getElementById('readerMeta');
  const title = document.getElementById('readerTitle');
  const body  = document.getElementById('readerBody');
  const toc   = document.getElementById('readerToc');
  const btnPrev = wrap.querySelector('[data-act="prev"]');
  const btnNext = wrap.querySelector('[data-act="next"]');
  const btnToc  = wrap.querySelector('[data-act="toc"]');

  const L = getCurrentLang();
  let book;
  try {
    book = await loadBook(version, L);
  } catch (e) {
    if (body) body.innerHTML = `<div class="text-red-300">${t('reader.error','Failed to load the book. Please try again later.')}</div>`;
    console.error(e);
    return;
  }

  let current = Number.isFinite(startIndex) ? Math.max(0, startIndex|0) : (Number(localStorage.getItem(storageKey(version, L)))||0);
  current = Math.min(Math.max(0,current), book.chapters.length-1);

  function savePos(){
    try { localStorage.setItem(storageKey(version, L), String(current)); } catch {}
  }
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

  // controls
  btnPrev.addEventListener('click', ()=> openIdx(current-1));
  btnNext.addEventListener('click', ()=> openIdx(current+1));
  btnToc .addEventListener('click', ()=> toc.classList.toggle('hidden'));

  // keyboard
  const onKey = (e)=>{
    if (!document.getElementById('modalBody')) return;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); openIdx(current-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); openIdx(current+1); }
  };
  document.addEventListener('keydown', onKey);

  // build and open
  renderToc();
  openIdx(current);

  // cleanup on modal close
  const modal = document.getElementById('modalBackdrop');
  const obs = new MutationObserver(()=>{
    if (!modal.classList.contains('show')){
      document.removeEventListener('keydown', onKey);
      obs.disconnect();
    }
  });
  obs.observe(modal, { attributes:true, attributeFilter:['class'] });
}