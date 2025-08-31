// assets/js/core/reader.js — v6 (reader card under heading, full-width, no play icon)
import { $, $$ } from './dom.js';
import { t, onLocaleChanged } from './i18n.js';
import { openModal } from './modal.js';

const TITLE_STATIC = 'The Real Unreal Story';

function currentLang(){ return (document.documentElement.getAttribute('lang') || 'en').toLowerCase(); }
function cap(L){ return (L||'en').toLowerCase(); }
function readPos(ver, lang){ try{const v=localStorage.getItem(`reader:last:${ver}:${lang}`); return v==null?0:Math.max(0,parseInt(v,10)||0);}catch{ return 0; } }
function writePos(ver, lang, i){ try{localStorage.setItem(`reader:last:${ver}:${lang}`, String(Math.max(0,i|0)));}catch{} }

async function fetchBook(version, lang){
  const url = `/books/${version}/${cap(lang)}/book.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if(!res.ok) throw new Error(`Failed to load ${url}`);
  const data = await res.json();
  if(!Array.isArray(data?.chapters) || !data.chapters.length) throw new Error('Empty chapters');
  return data;
}

function buildReaderMarkup(){
  return `
  <div id="trusReader" class="reader-wrap">
    <div class="reader-nav" style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.75rem">
      <button id="readerPrev" class="btn">${t('reader.prev','Previous')}</button>
      <button id="readerNext" class="btn">${t('reader.next','Next')}</button>
      <button id="readerToc" class="btn" title="${t('reader.toc','Table of contents')}">${t('reader.toc','Table of contents')}</button>
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
  </div>`;
}

function renderChapter(state){
  const { book } = state;
  const capIdx = (i)=> Math.min(Math.max(i,0), book.chapters.length-1);
  state.idx = capIdx(state.idx);
  const ch = book.chapters[state.idx];

  const titleEl = $('#readerTitle'); if (titleEl) titleEl.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${state.idx+1}`;
  const htmlEl  = $('#readerHtml');  if (htmlEl)  htmlEl.innerHTML = ch?.html  || '';
  const cntEl   = $('#readerCounter'); if (cntEl) cntEl.textContent = `${t('reader.chapter','Chapter')} ${state.idx+1} ${t('reader.of','of')} ${book.chapters.length}`;
  writePos(state.version, state.lang, state.idx);
}

function buildToc(state){
  const wrap = $('#readerTocList'); if (!wrap) return;
  wrap.innerHTML = '';
  state.book.chapters.forEach((ch,i)=>{
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = ch?.title || `${t('reader.chapter','Chapter')} ${i+1}`;
    b.addEventListener('click', ()=>{ state.idx = i; $('#readerTocPanel').style.display='none'; renderChapter(state); });
    wrap.appendChild(b);
  });
}

function pauseAllAudio(){ ['#announceAudio','#shortAudio','#fullAudio'].forEach(sel=>{ const a=document.querySelector(sel); try{a&&a.pause&&a.pause();}catch{} }); }

export async function openReader(version='full'){
  pauseAllAudio();
  openModal(TITLE_STATIC, buildReaderMarkup());

  const lang = currentLang();
  let book;
  try { book = await fetchBook(version, lang); }
  catch(e){ const el=$('#readerHtml'); if(el) el.innerHTML = `<div class="error">${t('reader.error','Failed to load the book. Please try again later.')}</div>`; console.error(e); return; }

  const state = { version, lang, book, idx: readPos(version, lang) };

  const prev=$('#readerPrev'), next=$('#readerNext'), toc=$('#readerToc');
  prev && prev.addEventListener('click', ()=>{ state.idx--; renderChapter(state); });
  next && next.addEventListener('click', ()=>{ state.idx++; renderChapter(state); });
  toc  && toc .addEventListener('click', ()=>{ const p=$('#readerTocPanel'); if(p) p.style.display = (p.style.display==='none'?'block':'none'); });

  document.addEventListener('keydown', function onKey(e){
    if (!$('#trusReader')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key==='ArrowLeft'){ state.idx--; renderChapter(state); }
    if (e.key==='ArrowRight'){ state.idx++; renderChapter(state); }
  });

  buildToc(state);
  renderChapter(state);
}

/* ---------- CTA rendering (cards under headings) ---------- */

// Find the **audio card**: the smallest ancestor that contains BOTH the play button and the seek of given kind
function findAudioCard(root, kind){
  const seek = root.querySelector(kind==='short' ? '#shortSeek, .mini-player-seek[data-kind="short"]'
                                                 : '#fullSeek, .mini-player-seek[data-kind="full"]');
  const btn  = root.querySelector(kind==='short' ? '#shortBtn' : '#fullBtn');
  if (!seek || !btn) return null;

  let node = seek;
  let card = null;
  while (node && node !== root){
    if (node.contains(btn)) { card = node; node = node.parentElement; }
    else break;
  }
  // card is the smallest ancestor containing both
  return card;
}

// Find heading above this audio card (H1–H4 or [role=heading])
function findHeadingAbove(card){
  if (!card || !card.parentElement) return null;
  let prev = card.previousElementSibling;
  while (prev){
    const tag = (prev.tagName||'').toUpperCase();
    if (tag==='H1' || tag==='H2' || tag==='H3' || tag==='H4' || prev.getAttribute('role')==='heading') return prev;
    prev = prev.previousElementSibling;
  }
  return null;
}

function makeReaderCard(version, referenceCard){
  const card = document.createElement('div');
  card.className = referenceCard ? referenceCard.className : 'rounded-xl border border-white/10 bg-white/10 p-3';
  card.style.marginTop = '8px';
  card.style.marginBottom = '12px';
  card.style.gridColumn = '1 / -1'; // span full grid width if parent is grid

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.justifyContent = 'space-between';
  row.style.gap = '10px';

  const note = document.createElement('div');
  note.style.flex = '1 1 auto';
  note.textContent = version==='short'
    ? t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.')
    : t('reader.full.note','Richer descriptive detail and emotional context, with character interactions and a deeper sense of their personalities.');

  const btn = document.createElement('button');
  btn.className = 'px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm pulse';
  btn.setAttribute('aria-label', t('reader.open','Read'));
  btn.textContent = t('reader.open','Read'); // no play symbol
  btn.id = version==='short' ? 'shortReadBtn' : 'fullReadBtn';
  btn.addEventListener('click', (e)=>{ e.preventDefault(); openReader(version); });

  row.appendChild(note);
  row.appendChild(btn);
  card.appendChild(row);
  return card;
}

export function attachStoryReaders(root=document){
  // FULL
  {
    const audioCard = findAudioCard(root, 'full');
    if (audioCard && audioCard.parentElement && !root.querySelector('#fullReadBtn')){
      const readerCard = makeReaderCard('full', audioCard);
      // place **before** audio card -> right under the section heading
      audioCard.parentElement.insertBefore(readerCard, audioCard);
    }
  }
  // SHORT
  {
    const audioCard = findAudioCard(root, 'short');
    if (audioCard && audioCard.parentElement && !root.querySelector('#shortReadBtn')){
      const readerCard = makeReaderCard('short', audioCard);
      audioCard.parentElement.insertBefore(readerCard, audioCard);
    }
  }

  onLocaleChanged(()=>{
    const sBtn = root.querySelector('#shortReadBtn');
    const fBtn = root.querySelector('#fullReadBtn');
    if (sBtn) sBtn.textContent = t('reader.open','Read');
    if (fBtn) fBtn.textContent = t('reader.open','Read');
    const sNote = sBtn ? sBtn.parentElement.querySelector('div') : null;
    const fNote = fBtn ? fBtn.parentElement.querySelector('div') : null;
    if (sNote) sNote.textContent = t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.');
    if (fNote) fNote.textContent = t('reader.full.note','Richer descriptive detail and emotional context, with character interactions and a deeper sense of their personalities.');
  });
}
