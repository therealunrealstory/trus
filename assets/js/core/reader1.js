
// assets/js/core/reader.js (fixed, pure JS)
// Lightweight modal reader for TRUS Story page
import { $, $$ } from './dom.js';
import { t, onLocaleChanged } from './i18n.js';
import { openModal } from './modal.js';

const TITLE_STATIC = 'The Real Unreal Story'; // per your preference — not localized

function currentLang(){
  const L = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  return L;
}
function capLang(L){ return (L||'en').toLowerCase(); }

// localStorage helpers
function readPos(version, lang){
  try{
    const v = localStorage.getItem(`reader:last:${version}:${lang}`);
    const n = v==null ? 0 : Math.max(0, parseInt(v,10)||0);
    return n;
  }catch{ return 0; }
}
function writePos(version, lang, idx){
  try{ localStorage.setItem(`reader:last:${version}:${lang}`, String(Math.max(0, idx|0))); }catch{}
}

async function fetchBook(version, lang){
  const L = capLang(lang);
  const url = `/books/${version}/${L}/book.json`;
  const res = await fetch(url, {cache: 'no-store'});
  if (!res.ok) throw new Error(`Failed to load ${url}`);
  const data = await res.json();
  if (!Array.isArray(data?.chapters) || !data.chapters.length) throw new Error('Empty chapters');
  return data;
}

// Build reader modal content
function buildReaderMarkup(){
  return `
    <div id="trusReader" class="reader-wrap">
      <div class="reader-nav" style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
        <button id="readerPrev" class="btn">${t('reader.prev','Предыдущая')}</button>
        <button id="readerNext" class="btn">${t('reader.next','Следующая')}</button>
        <button id="readerToc"  class="btn" title="${t('reader.toc','Оглавление')}">${t('reader.toc','Оглавление')}</button>
        <div id="readerCounter" class="muted" style="margin-left:auto"></div>
      </div>
      <div id="readerContent">
        <h3 id="readerTitle" class="text-xl"></h3>
        <div id="readerHtml" class="prose" style="line-height:1.6"></div>
      </div>
      <div id="readerTocPanel" style="display:none;margin-top:1rem">
        <div class="muted" style="margin-bottom:.5rem">${t('reader.toc','Оглавление')}</div>
        <div id="readerTocList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.5rem"></div>
      </div>
      <div class="muted" style="margin-top:.75rem">${t('reader.hint','Стрелки ←/→ — перелистывание, Esc — закрыть')}</div>
    </div>
  `;
}

// Render chapter into the open modal
function renderChapter(state){
  const { book, idx, version, lang } = state;
  const cap = (i)=> Math.min(Math.max(i,0), book.chapters.length-1);
  state.idx = cap(idx);

  const ch = book.chapters[state.idx];
  const titleEl = $('#readerTitle');
  if (titleEl) titleEl.textContent = (ch && ch.title) || `${t('reader.chapter','Глава')} ${state.idx+1}`;
  const htmlEl = $('#readerHtml');
  if (htmlEl) htmlEl.innerHTML = (ch && ch.html) || '';

  const counterEl = $('#readerCounter');
  if (counterEl) counterEl.textContent = `${t('reader.chapter','Глава')} ${state.idx+1} ${t('reader.of','из')} ${book.chapters.length}`;
  writePos(version, lang, state.idx);

  // focus mgmt (optional)
  try{ const nxt = $('#readerNext'); nxt && nxt.focus(); }catch{}
}

function buildToc(state){
  const { book } = state;
  const wrap = $('#readerTocList');
  if (!wrap) return;
  wrap.innerHTML = '';
  book.chapters.forEach((ch,i)=>{
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = (ch && ch.title) || `${t('reader.chapter','Глава')} ${i+1}`;
    btn.addEventListener('click', ()=>{
      state.idx = i;
      const p = $('#readerTocPanel');
      if (p) p.style.display = 'none';
      renderChapter(state);
    });
    wrap.appendChild(btn);
  });
}

function pauseAllAudio(){
  ['#announceAudio','#shortAudio','#fullAudio'].forEach(sel=>{
    const a = document.querySelector(sel);
    try{ a && a.pause && a.pause(); }catch{}
  });
}

// Public API: open reader immediately
export async function openReader(version='full'){
  pauseAllAudio();

  // open modal with skeleton & bind events
  openModal(TITLE_STATIC, buildReaderMarkup());

  const lang = currentLang();
  let book;
  try{
    book = await fetchBook(version, lang);
  }catch(e){
    const errEl = $('#readerHtml');
    if (errEl) errEl.innerHTML = `<div class="error">${t('reader.error','Не удалось загрузить книгу. Попробуйте позже.')}</div>`;
    console.error(e);
    return;
  }

  const state = { version, lang, book, idx: readPos(version, lang) };

  // Handlers
  const prev = $('#readerPrev');
  const next = $('#readerNext');
  const tocBtn = $('#readerToc');
  if (prev) prev.addEventListener('click', ()=>{ state.idx = Math.max(0, state.idx-1); renderChapter(state); });
  if (next) next.addEventListener('click', ()=>{ state.idx = Math.min(book.chapters.length-1, state.idx+1); renderChapter(state); });
  if (tocBtn) tocBtn.addEventListener('click', ()=>{
    const p = $('#readerTocPanel');
    if (p) p.style.display = (p.style.display==='none' ? 'block' : 'none');
  });

  // Keyboard navigation
  const onKey = (e)=>{
    if (!$('#trusReader')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowLeft')  { state.idx = Math.max(0, state.idx-1); renderChapter(state); }
    if (e.key === 'ArrowRight') { state.idx = Math.min(book.chapters.length-1, state.idx+1); renderChapter(state); }
  };
  document.addEventListener('keydown', onKey);

  // TOC
  buildToc(state);

  // First render
  renderChapter(state);
}

// Attach two CTA blocks under audio players (short/full) using existing play button style
function makeCta(version, sampleBtn){
  const btn = sampleBtn ? sampleBtn.cloneNode(true) : document.createElement('button');
  if (!sampleBtn){
    btn.className = 'btn';
  }
  btn.id = version === 'short' ? 'shortReadBtn' : 'fullReadBtn';
  btn.textContent = t('reader.open','Читать');

  btn.addEventListener('click', (e)=>{
    e.preventDefault();
    openReader(version);
  });

  const note = document.createElement('div');
  note.className = 'muted';
  note.style.marginTop = '.25rem';
  if (version === 'short'){
    note.textContent = t('short.read.note','Краткая версия истории. Упущены некоторые детали; акцент на хронологии событий.');
  } else {
    note.textContent = t('full.read.note','Полная версия истории. Больше деталей и эмоциональных переживаний, взаимодействия с персонажами и понимания их личностей.');
  }

  const wrap = document.createElement('div');
  wrap.className = 'reader-cta';
  wrap.style.marginTop = '.75rem';
  wrap.appendChild(btn);
  wrap.appendChild(note);
  return wrap;
}

export function attachStoryReaders(root=document){
  // FULL
  const fullBtn = root.querySelector('#fullBtn');
  const fullAudio = root.querySelector('#fullAudio') || root.querySelector('[data-audio="full"]');
  if (fullBtn || fullAudio){
    const target = (fullBtn && fullBtn.parentElement) || (fullAudio && fullAudio.parentElement) || root;
    if (target && !root.querySelector('#fullReadBtn')){
      target.appendChild(makeCta('full', fullBtn));
    }
  }

  // SHORT
  const shortBtn = root.querySelector('#shortBtn');
  const shortAudio = root.querySelector('#shortAudio') || root.querySelector('[data-audio="short"]');
  if (shortBtn || shortAudio){
    const target = (shortBtn && shortBtn.parentElement) || (shortAudio && shortAudio.parentElement) || root;
    if (target && !root.querySelector('#shortReadBtn')){
      target.appendChild(makeCta('short', shortBtn));
    }
  }

  // Update notes when locale changes
  onLocaleChanged(()=>{
    const shortBtnEl = root.querySelector('#shortReadBtn');
    if (shortBtnEl && shortBtnEl.nextElementSibling) {
      shortBtnEl.nextElementSibling.textContent = t('short.read.note','Краткая версия истории. Упущены некоторые детали; акцент на хронологии событий.');
    }
    const fullBtnEl = root.querySelector('#fullReadBtn');
    if (fullBtnEl && fullBtnEl.nextElementSibling) {
      fullBtnEl.nextElementSibling.textContent = t('full.read.note','Полная версия истории. Больше деталей и эмоциональных переживаний, взаимодействия с персонажами и понимания их личностей.');
    }
  });
}
