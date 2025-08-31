// assets/js/core/reader.js — place reader directly under each block heading
import { $, $$ } from './dom.js';
import { t, onLocaleChanged } from './i18n.js';
import { openModal } from './modal.js';

const TITLE_STATIC = 'The Real Unreal Story';

function currentLang(){
  const L = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
  return L;
}
function capLang(L){ return (L||'en').toLowerCase(); }

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

function buildReaderMarkup(){
  return `
    <div id="trusReader" class="reader-wrap">
      <div class="reader-nav" style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
        <button id="readerPrev" class="btn">${t('reader.prev','Previous')}</button>
        <button id="readerNext" class="btn">${t('reader.next','Next')}</button>
        <button id="readerToc"  class="btn" title="${t('reader.toc','Table of contents')}">${t('reader.toc','Table of contents')}</button>
        <div id="readerCounter" class="opacity-80 text-sm" style="margin-left:auto"></div>
      </div>
      <div id="readerContent">
        <h3 id="readerTitle" class="text-xl font-semibold mb-1"></h3>
        <div id="readerHtml" class="prose" style="line-height:1.6"></div>
      </div>
      <div id="readerTocPanel" style="display:none;margin-top:1rem">
        <div class="opacity-80 text-sm mb-2">${t('reader.toc','Table of contents')}</div>
        <div id="readerTocList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:.5rem"></div>
      </div>
      <div class="opacity-80 text-sm mt-3">${t('reader.hint','Use ←/→ to navigate, Esc to close')}</div>
    </div>
  `;
}

function renderChapter(state){
  const { book, idx, version, lang } = state;
  const cap = (i)=> Math.min(Math.max(i,0), book.chapters.length-1);
  state.idx = cap(idx);

  const ch = book.chapters[state.idx];
  const titleEl = $('#readerTitle');
  if (titleEl) titleEl.textContent = (ch && ch.title) || `${t('reader.chapter','Chapter')} ${state.idx+1}`;
  const htmlEl = $('#readerHtml');
  if (htmlEl) htmlEl.innerHTML = (ch && ch.html) || '';

  const counterEl = $('#readerCounter');
  if (counterEl) counterEl.textContent = `${t('reader.chapter','Chapter')} ${state.idx+1} ${t('reader.of','of')} ${book.chapters.length}`;
  writePos(version, lang, state.idx);

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
    btn.textContent = (ch && ch.title) || `${t('reader.chapter','Chapter')} ${i+1}`;
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

export async function openReader(version='full'){
  pauseAllAudio();
  openModal(TITLE_STATIC, buildReaderMarkup());

  const lang = currentLang();
  let book;
  try{
    book = await fetchBook(version, lang);
  }catch(e){
    const errEl = $('#readerHtml');
    if (errEl) errEl.innerHTML = `<div class="error">${t('reader.error','Failed to load the book. Please try again later.')}</div>`;
    console.error(e);
    return;
  }

  const state = { version, lang, book, idx: readPos(version, lang) };

  const prev = $('#readerPrev');
  const next = $('#readerNext');
  const tocBtn = $('#readerToc');
  if (prev) prev.addEventListener('click', ()=>{ state.idx = Math.max(0, state.idx-1); renderChapter(state); });
  if (next) next.addEventListener('click', ()=>{ state.idx = Math.min(book.chapters.length-1, state.idx+1); renderChapter(state); });
  if (tocBtn) tocBtn.addEventListener('click', ()=>{
    const p = $('#readerTocPanel');
    if (p) p.style.display = (p.style.display==='none' ? 'block' : 'none');
  });

  const onKey = (e)=>{
    if (!$('#trusReader')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'ArrowLeft')  { state.idx = Math.max(0, state.idx-1); renderChapter(state); }
    if (e.key === 'ArrowRight') { state.idx = Math.min(book.chapters.length-1, state.idx+1); renderChapter(state); }
  };
  document.addEventListener('keydown', onKey);

  buildToc(state);
  renderChapter(state);
}

/* ---------------- CTA rendering ---------------- */

function svgTriangle(){
  return `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>`;
}
function makeButton(){
  const b = document.createElement('button');
  b.className = 'px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm pulse';
  b.setAttribute('aria-label', t('reader.open','Read'));
  b.innerHTML = `${svgTriangle()} <span>${t('reader.open','Read')}</span>`;
  return b;
}

function makeReaderCard(version, referenceCard, referenceRow){
  const card = document.createElement('div');
  card.className = referenceCard ? referenceCard.className : 'rounded-xl border border-white/10 bg-white/10 p-3';
  // a bit more gap under heading
  card.style.marginTop = '8px';
  card.style.marginBottom = '12px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '10px';
  if (referenceRow && referenceRow.className) row.className = referenceRow.className; // font consistency

  const note = document.createElement('div');
  note.style.flex = '1 1 auto';
  note.textContent = version === 'short'
    ? t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.')
    : t('reader.full.note','Richer descriptive detail and emotional context, with character interactions and a deeper sense of their personalities.');

  const btn = makeButton();
  btn.id = version === 'short' ? 'shortReadBtn' : 'fullReadBtn';
  btn.addEventListener('click', (e)=>{ e.preventDefault(); openReader(version); });

  row.appendChild(note);
  row.appendChild(btn);
  card.appendChild(row);
  return card;
}

// find the heading node above each player card and insert right after it
function findHeadingAnchor(card){
  if (!card) return null;
  let parent = card.parentElement;
  if (!parent) return null;
  // scan previous siblings until we hit a heading element (h1..h4) or node with role=heading
  let prev = card.previousElementSibling;
  while (prev){
    const tag = (prev.tagName || '').toUpperCase();
    const isHeading = tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'H4' || prev.getAttribute('role') === 'heading';
    if (isHeading) return prev;
    prev = prev.previousElementSibling;
  }
  return null;
}

function findPlayerParts(root, version){
  // card = the outer card container of the mini player
  const seek = root.querySelector(version==='short' ? '#shortSeek, .mini-player-seek[data-kind="short"]' : '#fullSeek, .mini-player-seek[data-kind="full"]');
  const row  = seek ? seek.previousElementSibling : null;
  const card = row ? row.parentElement : (seek ? seek.parentElement : null);
  return { seek, row, card };
}

export function attachStoryReaders(root=document){
  // FULL — insert after heading of this block
  {
    const { seek, row, card } = findPlayerParts(root, 'full');
    if (card && !root.querySelector('#fullReadBtn')){
      const heading = findHeadingAnchor(card);
      const readerCard = makeReaderCard('full', card, row);
      if (heading && heading.parentElement){
        heading.parentElement.insertBefore(readerCard, heading.nextSibling);
      } else {
        // fallback: above player card
        card.parentElement.insertBefore(readerCard, card);
      }
    }
  }
  // SHORT — insert after heading of this block
  {
    const { seek, row, card } = findPlayerParts(root, 'short');
    if (card && !root.querySelector('#shortReadBtn')){
      const heading = findHeadingAnchor(card);
      const readerCard = makeReaderCard('short', card, row);
      if (heading && heading.parentElement){
        heading.parentElement.insertBefore(readerCard, heading.nextSibling);
      } else {
        card.parentElement.insertBefore(readerCard, card);
      }
    }
  }

  // Update texts on locale change
  onLocaleChanged(()=>{
    const sBtn = root.querySelector('#shortReadBtn');
    const fBtn = root.querySelector('#fullReadBtn');
    if (sBtn) sBtn.innerHTML = `${svgTriangle()} <span>${t('reader.open','Read')}</span>`;
    if (fBtn) fBtn.innerHTML = `${svgTriangle()} <span>${t('reader.open','Read')}</span>`;
    const sNote = sBtn ? sBtn.parentElement.querySelector('div') : null;
    const fNote = fBtn ? fBtn.parentElement.querySelector('div') : null;
    if (sNote) sNote.textContent = t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.');
    if (fNote) fNote.textContent = t('reader.full.note','Richer descriptive detail and emotional context, with character interactions and a deeper sense of their personalities.');
  });
}