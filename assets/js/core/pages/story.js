// assets/js/core/pages/story.js — readers + tiles + responsive
import { $ } from '../dom.js';
import { t, I18N, DEFAULT_I18N, onLocaleChanged } from '../i18n.js';
import { openModal } from '../modal.js';
import { initSounds, getSoundUrl, onSoundsReady } from '../soundRouter.js';
import { openReader } from '../reader.js';

let announceAudio, shortAudio, fullAudio;
let announceBtn, shortBtn, fullBtn;
let announceStatus, shortStatus, fullStatus;
let announceSeek, shortSeek, fullSeek;
let announceTimeCur, announceTimeDur, shortTimeCur, shortTimeDur, fullTimeCur, fullTimeDur;
let onPauseOthers, unLocale;
let respCleanup = null; // для снятия responsive-слушателей

/* ====== Resume settings ====== */
const RESUME_ENABLED = true;
const RESUME_MIN_SECONDS = 15;
const RESUME_MARGIN_TAIL = 8;
const RESUME_SAVE_INTERVAL = 10000;

function label(key, fallback){ return (I18N[key] || DEFAULT_I18N[key] || fallback); }
function fmtTime(sec){
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
  return h>0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
}
function resumeKey(trackKey, lang){ return `seek:${trackKey}:${(lang||'EN').toUpperCase()}`; }
function readResume(trackKey, lang){
  try { const v = localStorage.getItem(resumeKey(trackKey, lang)); const n = v==null?NaN:Number(v); return Number.isFinite(n)?Math.max(0,n):NaN; } catch { return NaN; }
}
function writeResume(trackKey, lang, seconds){ try { localStorage.setItem(resumeKey(trackKey, lang), String(Math.max(0, Math.floor(seconds||0)))); } catch {} }
function clearResumeIfCompleted(trackKey, lang){ try { localStorage.removeItem(resumeKey(trackKey, lang)); } catch {} }

function updateMiniLabels(){
  if (announceBtn && announceAudio) announceBtn.textContent = announceAudio.paused ? label('announce.play','▶︎ Play') : label('announce.pause','‖ Pause');
  if (shortBtn && shortAudio)       shortBtn.textContent    = shortAudio.paused    ? label('short.play','▶︎ Play')     : label('short.pause','‖ Pause');
  if (fullBtn && fullAudio)         fullBtn.textContent     = fullAudio.paused     ? label('full.play','▶︎ Play')      : label('full.pause','‖ Pause');
}

function setAudioFromRouter(audioEl, key, lang, autoplay=false){
  if (!audioEl) return;
  const trySet = () => {
    const url = getSoundUrl(key, lang);
    if (!url) return false;
    if (audioEl.src && (audioEl.src === url || audioEl.src.endsWith(url))) {
      if (autoplay && audioEl.paused) audioEl.play().catch(()=>{});
      return true;
    }
    try { audioEl.pause(); } catch {}
    audioEl.preload = 'none';
    audioEl.crossOrigin = 'anonymous';
    audioEl.src = url;
    if (autoplay) audioEl.play().catch(()=>{});
    return true;
  };
  if (!trySet()) onSoundsReady(() => { trySet(); updateMiniLabels(); });
  else updateMiniLabels();
}

function setAnnouncementForLang(l, autoplay=false){ setAudioFromRouter(announceAudio, 'announcement', l, autoplay); }
function setShortForLang(l, autoplay=false){       setAudioFromRouter(shortAudio,    'short',       l, autoplay); }
function setFullForLang(l, autoplay=false){        setAudioFromRouter(fullAudio,     'full',        l, autoplay); }

function setupMiniPlayer({ key, audioEl, btnEl, statusEl, seekEl, timeCurEl, timeDurEl, getLang }){
  if (!audioEl || !btnEl) return;
  btnEl.setAttribute('data-i18n-skip','');

  let dragging=false, rafId=0, saveTimer=0, appliedResumeForLang=null;

  btnEl.addEventListener('click', ()=>{
    const L = getLang();
    if (audioEl.paused){
      if (key === 'announcement') setAnnouncementForLang(L, true);
      else if (key === 'short')   setShortForLang(L, true);
      else if (key === 'full')    setFullForLang(L, true);
      document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: audioEl }}));
    } else audioEl.pause();
  });

  const onMeta = ()=>{
    const d = audioEl.duration;
    if (Number.isFinite(d) && d>0){
      timeDurEl && (timeDurEl.textContent = fmtTime(d));
      if (seekEl){ seekEl.max = Math.floor(d); seekEl.disabled = false; }
      if (RESUME_ENABLED && appliedResumeForLang !== getLang()){
        const saved = readResume(key, getLang());
        if (Number.isFinite(saved) && saved >= RESUME_MIN_SECONDS && saved < (d - RESUME_MARGIN_TAIL)){
          try { audioEl.currentTime = saved; } catch {}
          if (seekEl) seekEl.value = Math.floor(audioEl.currentTime || 0);
        } else if (Number.isFinite(saved) && saved >= (d - RESUME_MARGIN_TAIL)) {
          clearResumeIfCompleted(key, getLang());
        }
        appliedResumeForLang = getLang();
      }
    } else {
      timeDurEl && (timeDurEl.textContent='--:--');
      if (seekEl){ seekEl.value = 0; seekEl.max = 0; seekEl.disabled = true; }
    }
  };
  audioEl.addEventListener('loadedmetadata', onMeta);

  const tick = ()=>{
    if (!dragging && seekEl){
      const t = audioEl.currentTime || 0;
      if (Number.isFinite(t)) seekEl.value = Math.floor(t);
    }
    timeCurEl && (timeCurEl.textContent = fmtTime(audioEl.currentTime || 0));
    rafId = audioEl.paused ? 0 : requestAnimationFrame(tick);
  };

  ['play','playing'].forEach(ev => audioEl.addEventListener(ev, ()=>{
    statusEl && (statusEl.textContent = (I18N['status.playing']||'Playing…'));
    updateMiniLabels();
    if (!rafId) rafId = requestAnimationFrame(tick);
    if (RESUME_ENABLED && !saveTimer){
      const L = getLang();
      saveTimer = setInterval(()=>{
        try {
          const cur = audioEl.currentTime || 0, d = audioEl.duration;
          if (Number.isFinite(d) && d - cur <= RESUME_MARGIN_TAIL) clearResumeIfCompleted(key, L);
          else writeResume(key, L, cur);
        } catch {}
      }, RESUME_SAVE_INTERVAL);
    }
  }));

  ['pause','ended'].forEach(ev => audioEl.addEventListener(ev, ()=>{
    statusEl && (statusEl.textContent = (I18N['status.paused']||'Paused'));
    updateMiniLabels();
    if (rafId){ cancelAnimationFrame(rafId); rafId = 0; }
    if (RESUME_ENABLED){
      const L = getLang();
      try {
        const cur = audioEl.currentTime || 0, d = audioEl.duration;
        if (ev === 'ended' || (Number.isFinite(d) && d - cur <= RESUME_MARGIN_TAIL)) clearResumeIfCompleted(key, L);
        else writeResume(key, L, cur);
      } catch {}
      if (saveTimer){ clearInterval(saveTimer); saveTimer = 0; }
    }
  }));

  if (seekEl){
    seekEl.addEventListener('pointerdown', ()=>{ dragging = true; });
    seekEl.addEventListener('input', ()=>{ const v=Number(seekEl.value)||0; timeCurEl && (timeCurEl.textContent = fmtTime(v)); });
    const commit = ()=>{
      const v = Number(seekEl.value)||0;
      if (Number.isFinite(v)) {
        try { audioEl.currentTime = v; } catch {}
        if (RESUME_ENABLED){
          const L = getLang();
          const d = audioEl.duration;
          if (Number.isFinite(d) && d - v <= RESUME_MARGIN_TAIL) clearResumeIfCompleted(key, L);
          else writeResume(key, L, v);
        }
      }
      dragging = false;
      if (!audioEl.paused && !rafId) rafId = requestAnimationFrame(tick);
    };
    seekEl.addEventListener('change', commit);
    seekEl.addEventListener('pointerup', commit);
    seekEl.addEventListener('pointercancel', ()=>{ dragging = false; });
    seekEl.addEventListener('keydown', (e)=>{
      if (e.key==='Home'){ seekEl.value = 0; seekEl.dispatchEvent(new Event('change')); }
      if (e.key==='End' && Number.isFinite(audioEl.duration)){ seekEl.value = Math.floor(audioEl.duration); seekEl.dispatchEvent(new Event('change')); }
    });
  }

  return {
    onLocaleChange(nextLang){
      const wasPlaying = !audioEl.paused;
      const pos = audioEl.currentTime || 0;
      if (key==='announcement') setAnnouncementForLang(nextLang,false);
      else if (key==='short')   setShortForLang(nextLang,false);
      else if (key==='full')    setFullForLang(nextLang,false);
      const resume = ()=>{
        if (Number.isFinite(audioEl.duration) && audioEl.duration>0){
          try { audioEl.currentTime = Math.min(pos, audioEl.duration - 0.25); } catch {}
          if (seekEl) seekEl.value = Math.floor(audioEl.currentTime || 0);
          if (wasPlaying) audioEl.play().catch(()=>{});
          const d = audioEl.duration;
          timeDurEl && (timeDurEl.textContent = fmtTime(d));
          if (seekEl){ seekEl.max = Math.floor(d); seekEl.disabled = false; }
        } else setTimeout(resume, 80);
      };
      resume();
      appliedResumeForLang = null;
    }
  };
}

/* =======================
   Reader callouts UNDER HEADINGS
   ======================= */
function readerCalloutNode(kind, playCard){
  const wrap = document.createElement('div');
  wrap.className = playCard ? playCard.className : 'rounded-2xl border border-gray-700 p-4';
  wrap.classList.add('reader-card');  
  wrap.style.background = 'rgba(0,0,0,0.35)';
  wrap.style.marginTop = '8px';
  wrap.style.marginBottom = '12px';

  const row = document.createElement('div');
  row.className = 'flex items-center gap-3 trus-reader-row';
  row.style.justifyContent = 'flex-start';
  row.style.flexWrap = 'nowrap'; // по умолчанию (десктоп) — одна строка
  row.classList.add('reader-row'); 

  const btn = document.createElement('button');
  btn.id = (kind==='short') ? 'shortReadBtn' : 'fullReadBtn';
  btn.className = 'px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm pulse';
  btn.textContent = t('reader.open','Read');
  btn.style.whiteSpace = 'nowrap';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.addEventListener('click', ()=> openReader(kind));

  const note = document.createElement('div');
  note.className = 'text-sm text-gray-200';
  note.style.flex = '1 1 auto';
  note.style.minWidth = '0';
  note.textContent = (kind==='short')
    ? t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.')
    : t('reader.full.note','Richer descriptive detail and emotional context, with character interactions and a deeper sense of their personalities.');

  row.appendChild(btn);
  row.appendChild(note);
  wrap.appendChild(row);
  return wrap;
}

function insertReaders(root){
  // SHORT
  {
    const section = root.querySelector('#shortBtn')?.closest('section') || root.querySelector('#shortSeek')?.closest('section');
    if (section && !section.querySelector('#shortReadBtn')){
      const heading = section.querySelector('h2,[role="heading"]');
      const playerCard = (root.querySelector('#shortBtn') || root.querySelector('#shortSeek'))?.closest('div');
      const node = readerCalloutNode('short', playerCard);
      if (heading && heading.parentNode) heading.parentNode.insertBefore(node, heading.nextSibling);
      else section.insertBefore(node, section.firstChild);
    }
  }
  // FULL
  {
    const section = root.querySelector('#fullBtn')?.closest('section') || root.querySelector('#fullSeek')?.closest('section');
    if (section && !section.querySelector('#fullReadBtn')){
      const heading = section.querySelector('h2,[role="heading"]');
      const playerCard = (root.querySelector('#fullBtn') || root.querySelector('#fullSeek'))?.closest('div');
      const node = readerCalloutNode('full', playerCard);
      if (heading && heading.parentNode) heading.parentNode.insertBefore(node, heading.nextSibling);
      else section.insertBefore(node, section.firstChild);
    }
  }
}

// пометить карточки аудиоплееров
function markAudioCards(root){
  ['announce','short','full'].forEach(id=>{
    const btn = root.querySelector(`#${id}Btn`);
    const card = btn ? btn.closest('div') : null;   // ближайшая "карточка"
    if (card) card.classList.add('mini-player-card');
  });
}

/* ---------- Responsive layout for reader & players ---------- */
function applyResponsiveLayout(root){
  const isMobile = window.matchMedia('(max-width: 768px)').matches;

  // РИДЕРЫ
  root.querySelectorAll('.trus-reader-row').forEach(row=>{
    const btn  = row.querySelector('button');
    const note = row.querySelector('.text-sm');
    if (btn) { btn.style.whiteSpace = 'nowrap'; btn.style.display = 'inline-flex'; btn.style.alignItems = 'center'; }
    if (isMobile){
      row.style.flexDirection = 'column';
      row.style.flexWrap = 'nowrap';
      if (note){ note.style.width = '100%'; note.style.marginTop = '8px'; }
    } else {
      row.style.flexDirection = 'row';
      row.style.flexWrap = 'nowrap';
      if (note){ note.style.flex = '1 1 auto'; note.style.marginTop = '0'; }
    }
  });

  // АУДИОПЛЕЕРЫ: подпись под кнопкой на мобилке, в линию — на десктопе
  const sets = [
    { btn: announceBtn, status: announceStatus },
    { btn: shortBtn,    status: shortStatus    },
    { btn: fullBtn,     status: fullStatus     },
  ];
  sets.forEach(({btn, status})=>{
    if (!btn) return;
    const row = btn.parentElement; // контейнер кнопки и подписи
    if (!row) return;

    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';

    // фикс «двух строк» на кнопке (▶︎ и текст вместе)
    btn.style.whiteSpace = 'nowrap';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';

    if (isMobile){
      row.style.flexDirection = 'column';
      row.style.flexWrap = 'nowrap';
      if (status){ status.style.width = '100%'; status.style.marginTop = '8px'; status.style.flex = '0 0 auto'; }
    } else {
      row.style.flexDirection = 'row';
      row.style.flexWrap = 'nowrap';
      if (status){ status.style.flex = '1 1 auto'; status.style.marginTop = '0'; status.style.minWidth = '0'; }
    }
  });
}
/* ---------------------------------------------------------------- */

export function init(root){
  initSounds();

  // Bind DOM
  announceAudio  = root.querySelector('#announceAudio') || root.querySelector('[data-audio="announce"]') || null;
  shortAudio     = root.querySelector('#shortAudio')    || root.querySelector('[data-audio="short"]')    || null;
  fullAudio      = root.querySelector('#fullAudio')     || root.querySelector('[data-audio="full"]')     || null;

  announceBtn    = root.querySelector('#announceBtn');
  announceStatus = root.querySelector('#announceStatus');
  shortBtn       = root.querySelector('#shortBtn');
  shortStatus    = root.querySelector('#shortStatus');
  fullBtn        = root.querySelector('#fullBtn');
  fullStatus     = root.querySelector('#fullStatus');

  announceSeek   = root.querySelector('#announceSeek');
  announceTimeCur= root.querySelector('#announceTimeCur');
  announceTimeDur= root.querySelector('#announceTimeDur');

  shortSeek      = root.querySelector('#shortSeek');
  shortTimeCur   = root.querySelector('#shortTimeCur');
  shortTimeDur   = root.querySelector('#shortTimeDur');

  fullSeek       = root.querySelector('#fullSeek');
  fullTimeCur    = root.querySelector('#fullTimeCur');
  fullTimeDur    = root.querySelector('#fullTimeDur');

  const langSel  = $('#lang');
  const currentLang = () => (langSel?.value || 'EN').toUpperCase();

  // Mini players
  const p1 = setupMiniPlayer({ key:'announcement', audioEl:announceAudio, btnEl:announceBtn, statusEl:announceStatus, seekEl:announceSeek, timeCurEl:announceTimeCur, timeDurEl:announceTimeDur, getLang: currentLang });
  const p2 = setupMiniPlayer({ key:'short',        audioEl:shortAudio,    btnEl:shortBtn,    statusEl:shortStatus,    seekEl:shortSeek,    timeCurEl:shortTimeCur,    timeDurEl:shortTimeDur,    getLang: currentLang });
  const p3 = setupMiniPlayer({ key:'full',         audioEl:fullAudio,     btnEl:fullBtn,     statusEl:fullStatus,     seekEl:fullSeek,     timeCurEl:fullTimeCur,     timeDurEl:fullTimeDur,     getLang: currentLang });

  // Reader cards under headings
  insertReaders(root);
  
  // Reader cards under headings
insertReaders(root);
// помечаем аудио-карточки для мобильной подстройки
markAudioCards(root);

  // Responsive: применяем и подписываемся
  applyResponsiveLayout(root);
  const mql = window.matchMedia('(max-width: 768px)');
  const onResp = ()=> applyResponsiveLayout(root);
  if (mql.addEventListener) mql.addEventListener('change', onResp);
  else mql.addListener(onResp);
  window.addEventListener('resize', onResp);
  respCleanup = ()=> {
    if (mql.removeEventListener) mql.removeEventListener('change', onResp);
    else mql.removeListener(onResp);
    window.removeEventListener('resize', onResp);
  };

  // Locale change
  unLocale = onLocaleChanged(({ detail })=>{
    const l = (detail?.lang || langSel?.value || 'EN').toUpperCase();
    p1?.onLocaleChange(l); p2?.onLocaleChange(l); p3?.onLocaleChange(l);
    const sBtn = root.querySelector('#shortReadBtn'); const fBtn = root.querySelector('#fullReadBtn');
    if (sBtn) sBtn.textContent = t('reader.open','Read');
    if (fBtn) fBtn.textContent = t('reader.open','Read');
    const sNote = sBtn ? sBtn.parentElement.querySelector('.text-sm') : null;
    const fNote = fBtn ? fBtn.parentElement.querySelector('.text-sm') : null;
    if (sNote) sNote.textContent = t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.');
    if (fNote) fNote.textContent = t('reader.full.note','Richer descriptive detail and emotional context, with character interactions and a deeper sense of their personalities.');
    updateMiniLabels();
  });

  // Pause other players on play
  onPauseOthers = (e)=>{
    const ex = e.detail?.except;
    [announceAudio, shortAudio, fullAudio].forEach(a => { if (a && a !== ex && !a.paused) a.pause(); });
    updateMiniLabels();
  };
  document.addEventListener('pause-others', onPauseOthers);

  // --- Tile modals (image-buttons above announcement) ---
  const bindTile = (sel, titleKey, titleFallback, bodyKey, bodyFallback) => {
    const el = root.querySelector(sel);
    if (!el) return;
    el.addEventListener('click', (e)=>{
      if (e && e.preventDefault) e.preventDefault();
      if (e && e.stopPropagation) e.stopPropagation();
      openModal(t(titleKey, titleFallback), t(bodyKey, bodyFallback));
    });
  };
  bindTile('#tile1', 'tiles.me', 'I\u2019m Nico', 'modal.tile1.body', '…');
  bindTile('#tile2', 'tiles.about', 'About Adam', 'modal.tile2.body', '…');
  bindTile('#tile3', 'tiles.others', 'Other people in the story', 'modal.tile3.body', '…');
  // ------------------------------------------------------

  updateMiniLabels();
}

export function destroy(){
  try { announceAudio?.pause(); } catch {}
  try { shortAudio?.pause(); } catch {}
  try { fullAudio?.pause(); } catch {}

  document.removeEventListener('pause-others', onPauseOthers);
  if (typeof unLocale === 'function') unLocale();
  if (typeof respCleanup === 'function') { try { respCleanup(); } catch {} respCleanup = null; }

  announceAudio = shortAudio = fullAudio = null;
  announceBtn = shortBtn = fullBtn = announceStatus = shortStatus = fullStatus = null;
  announceSeek = shortSeek = fullSeek = null;
  announceTimeCur = announceTimeDur = shortTimeCur = shortTimeDur = fullTimeCur = fullTimeDur = null;
  onPauseOthers = unLocale = null;
}
