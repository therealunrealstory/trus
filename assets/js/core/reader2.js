
// assets/js/core/reader.js — place CTA under seek bar, with own card
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
  if (!Array.isArray(data && data.chapters) || !data.chapters.length) throw new Error('Empty chapters');
  return data;
}

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

function renderChapter(state){
  const { book, idx, version, lang } = state;
  const cap = (i)=> Math.min(Math.max(i,0), book.chapters.length-1);
  state.idx = cap(idx);

  const ch = book.chapters[state.idx];
  const titleEl = $('#readerTitle');       if (titleEl) titleEl.textContent = (ch && ch.title) || `${t('reader.chapter','Глава')} ${state.idx+1}`;
  const htmlEl  = $('#readerHtml');        if (htmlEl)  htmlEl.innerHTML     = (ch && ch.html)  || '';
  const counter = $('#readerCounter');     if (counter) counter.textContent  = `${t('reader.chapter','Глава')} ${state.idx+1} ${t('reader.of','из')} ${book.chapters.length}`;
  writePos(version, lang, state.idx);

  try{ const nxt = $('#readerNext'); nxt && nxt.focus(); }catch{}
}

function buildToc(state){
  const { book } = state;
  const wrap = $('#readerTocList'); if (!wrap) return;
  wrap.innerHTML = '';
  book.chapters.forEach((ch,i)=>{
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = (ch && ch.title) || `${t('reader.chapter','Глава')} ${i+1}`;
    btn.addEventListener('click', ()=>{
      state.idx = i;
      const p = $('#readerTocPanel'); if (p) p.style.display = 'none';
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
    if (errEl) errEl.innerHTML = `<div class="error">${t('reader.error','Не удалось загрузить книгу. Попробуйте позже.')}</div>`;
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

// ---- CTA placement under seek bar ----
function lowestCommonAncestor(a, b){
  if (!a || !b) return null;
  const set = new Set();
  let n=a; while(n){ set.add(n); n=n.parentElement; }
  n=b; while(n){ if (set.has(n)) return n; n=n.parentElement; }
  return null;
}
function after(node, newNode){
  if (!node || !node.parentNode) return;
  if (node.nextSibling) node.parentNode.insertBefore(newNode, node.nextSibling);
  else node.parentNode.appendChild(newNode);
}

function makeCardLike(container){
  const wrap = document.createElement('div');
  // Try to mirror container's classes for look & feel
  if (container && container.className) {
    wrap.className = container.className;
  } else {
    // Fallback subtle card
    wrap.style.background = 'rgba(255,255,255,0.05)';
    wrap.style.border = '1px solid rgba(255,255,255,0.12)';
    wrap.style.borderRadius = '12px';
    wrap.style.padding = '10px 12px';
    wrap.style.marginTop = '10px';
  }
  return wrap;
}

function makeRow(){
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '12px';
  return row;
}

function makeCtaButton(version, sampleBtn){
  const btn = sampleBtn ? sampleBtn.cloneNode(true) : document.createElement('button');
  // ensure unique id and proper label
  btn.id = version === 'short' ? 'shortReadBtn' : 'fullReadBtn';
  btn.textContent = t('reader.open','Читать');
  // make sure pulse effect stays
  try{ btn.classList.add('pulse'); }catch{}
  btn.addEventListener('click', (e)=>{ e.preventDefault(); openReader(version); });
  return btn;
}

function makeNote(version){
  const note = document.createElement('div');
  note.className = 'muted';
  note.style.marginTop = '0';
  note.textContent = version === 'short'
    ? t('short.read.note','Краткая версия истории. Упущены некоторые детали; акцент на хронологии событий.')
    : t('full.read.note','Полная версия истории. Больше деталей и эмоциональных переживаний, взаимодействия с персонажами и понимания их личностей.');
  return note;
}

function insertReaderCta(root, version, btnSel, audioSel, seekSel){
  const btnEl   = root.querySelector(btnSel);
  const audioEl = root.querySelector(audioSel);
  const seekEl  = root.querySelector(seekSel);
  const seekRow = seekEl ? (seekEl.closest('.mini-player-seek') || seekEl) : null;

  if (!btnEl && !audioEl) return;

  // find common mini-player container (the one that visually looks like a card)
  const container = lowestCommonAncestor(btnEl || audioEl, seekEl || (btnEl || audioEl));
  if (!container) return;

  // Avoid duplicates
  const readId = version==='short' ? '#shortReadBtn' : '#fullReadBtn';
  if (root.querySelector(readId)) return;

  // Build card
  const card = makeCardLike(container);
  const row = makeRow();
  const ctaBtn = makeCtaButton(version, btnEl);
  const note = makeNote(version);
  row.appendChild(ctaBtn);
  row.appendChild(note);
  card.appendChild(row);

  if (seekRow) {
    after(seekRow, card);
  } else {
    // fallback: append at end of container
    container.appendChild(card);
  }
}

export function attachStoryReaders(root=document){
  insertReaderCta(root, 'full',  '#fullBtn',  '#fullAudio',  '#fullSeek');
  insertReaderCta(root, 'short', '#shortBtn', '#shortAudio', '#shortSeek');

  onLocaleChanged(()=>{
    // Only update hint texts if buttons already exist
    const sNote = root.querySelector('#shortReadBtn')?.nextElementSibling;
    if (sNote) sNote.textContent = t('short.read.note','Краткая версия истории. Упущены некоторые детали; акцент на хронологии событий.');
    const fNote = root.querySelector('#fullReadBtn')?.nextElementSibling;
    if (fNote) fNote.textContent = t('full.read.note','Полная версия истории. Больше деталей и эмоциональных переживаний, взаимодействия с персонажами и понимания их личностей.');
  });
}
