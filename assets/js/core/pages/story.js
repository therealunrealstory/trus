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
  try { const v = localStorage.getItem(resumeKey(trackKey, lang)); if (v==null) return NaN; const n = Number(v); return Number.isFinite(n)?Math.max(0,n):NaN; } catch { return NaN; }
}
function writeResume(trackKey, lang, seconds){ try { localStorage.setItem(resumeKey(trackKey,lang), String(Math.max(0, Math.floor(seconds||0)))); } catch {} }
function clearResumeIfCompleted(trackKey, lang){ try { localStorage.removeItem(resumeKey(trackKey, lang)); } catch {} }

function updateMiniLabels(){
  if (announceBtn && announceAudio) announceBtn.textContent = announceAudio.paused ? label('announce.play','▶︎ Play') : label('announce.pause','‖ Pause');
  if (shortBtn && shortAudio)       shortBtn.textContent    = shortAudio.paused    ? label('short.play','▶︎ Play')     : label('short.pause','‖ Pause');
  if (fullBtn && fullAudio)         fullBtn.textContent     = fullAudio.paused     ? label('full.play','▶︎ Play')      : label('full.pause','‖ Pause');
}

function setAudioFromRouter(audioEl, key, lang, autoplay=false){
  if (!audioEl) return false;
  const url = getSoundUrl(key, lang);
  const trySet = ()=>{
    const cur = !audioEl.paused ? audioEl.currentTime : 0;
    if (audioEl.src && audioEl.src.endsWith(url)){
      // если уже на нужном языке — просто авто-проигрываем (если надо)
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
      document.dispatchEvent(new CustomEvent('pause-others', { detail:{ except: audioEl } }));
    } else audioEl.pause();
  });

  onPauseOthers = (e)=>{
    const ex = e?.detail?.except;
    [announceAudio, shortAudio, fullAudio].forEach(a => { if (a && a !== ex && !a.paused) a.pause(); });
  };
  document.addEventListener('pause-others', onPauseOthers);

  audioEl.addEventListener('play', ()=>{
    statusEl && (statusEl.textContent = (I18N['status.playing']||'Playing…'));
    updateMiniLabels();
    const loop = ()=>{
      if (!audioEl || audioEl.paused) return;
      const cur = audioEl.currentTime || 0;
      if (!dragging && seekEl){ seekEl.value = Math.floor(cur); }
      timeCurEl && (timeCurEl.textContent = fmtTime(cur));
      rafId = requestAnimationFrame(loop);
    };
    if (rafId){ cancelAnimationFrame(rafId); }
    rafId = requestAnimationFrame(loop);

    // Resume-on-first-play per language
    if (RESUME_ENABLED){
      const L = getLang();
      if (appliedResumeForLang === L) return;
      const p = readResume(key, L);
      const resume = ()=>{
        if (!audioEl || audioEl.readyState < 1) { setTimeout(resume, 80); return; }
        if (Number.isFinite(p) && p >= RESUME_MIN_SECONDS){
          const wasPlaying = !audioEl.paused;
          try { audioEl.currentTime = Math.max(0, Math.min(audioEl.duration || p, p)); } catch {}
          if (wasPlaying) audioEl.play().catch(()=>{});
          const d = audioEl.duration;
          timeDurEl && (timeDurEl.textContent = fmtTime(d));
          if (seekEl){ seekEl.max = Math.floor(d); seekEl.disabled = false; }
        } else setTimeout(resume, 80);
      };
      resume();
      appliedResumeForLang = null;
    }
  });

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
    const finalize = ()=>{
      dragging = false;
      try { const v=Number(seekEl.value)||0; audioEl.currentTime = v; } catch {}
      if (!audioEl.paused) audioEl.play().catch(()=>{});
    };
    seekEl.addEventListener('pointerup', finalize);
    seekEl.addEventListener('change', finalize);
  }

  audioEl.addEventListener('loadedmetadata', ()=>{
    const d = audioEl.duration;
    if (seekEl){ seekEl.max = Math.floor(d||0); seekEl.disabled = !Number.isFinite(d); }
    timeDurEl && (timeDurEl.textContent = fmtTime(d));
    if (RESUME_ENABLED){
      const L = getLang();
      const p = readResume(key, L);
      if (Number.isFinite(p) && p >= RESUME_MIN_SECONDS){
        try { audioEl.currentTime = Math.max(0, Math.min(d||p, p)); } catch {}
        timeCurEl && (timeCurEl.textContent = fmtTime(audioEl.currentTime||0));
      }
    }
  });

  audioEl.addEventListener('play', ()=>{
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
}

/* =======================
   Reader callouts UNDER HEADINGS
   ======================= */
function readerCalloutNode(kind, playCard){
  const wrap = document.createElement('div');
  wrap.className = 'my-2';
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
  btn.addEventListener('click', (e)=>{
    e?.preventDefault?.();
    const langSel = document.querySelector('#lang') || document.querySelector('[data-lang-select]');
    const L = (langSel?.value || 'EN').toUpperCase();
    openReader({ kind, lang: L });
  });

  const note = document.createElement('div');
  note.className = 'text-sm text-gray-500';
  note.textContent = (kind==='short')
    ? t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.')
    : t('reader.full.note','Covers the complete story arc with extensive detail.');

  const btnRow = document.createElement('div');
  btnRow.className = 'flex items-center gap-3';
  btnRow.appendChild(btn);

  const right = document.createElement('div');
  right.className = 'flex-1 min-w-0';
  right.appendChild(note);

  wrap.appendChild(btnRow);
  wrap.appendChild(right);

  // если есть карточка плеера (с мини-кнопкой), дублируем её статус справа
  if (playCard){
    const mini = playCard.cloneNode(true);
    // чистим лишние id, чтобы не дублировать
    ['announceBtn','shortBtn','fullBtn','announceSeek','shortSeek','fullSeek','announceStatus','shortStatus','fullStatus','announceTimeCur','announceTimeDur','shortTimeCur','shortTimeDur','fullTimeCur','fullTimeDur'].forEach(id=>{
      const el = mini.querySelector('#'+id); if (el) el.removeAttribute('id');
    });
    mini.querySelectorAll('button').forEach(b=>{ b.disabled = true; b.classList.remove('pulse'); });
    right.appendChild(mini);
  }

  return wrap;
}

function ensureReaderCallouts(root){
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
  sets.forEach(({btn,status})=>{
    if (!btn || !status) return;
    if (isMobile){
      status.style.display = 'block';
      status.style.marginTop = '6px';
    } else {
      status.style.display = 'inline';
      status.style.marginTop = '0';
      status.style.marginLeft = '8px';
    }
  });
}

export function init(root){
  initSounds();

  // Bind DOM
  // --- Ensure block order: move Short section below Full section ---
  try {
    const shortSection = (root.querySelector('#shortBtn') || root.querySelector('#shortSeek'))?.closest('section');
    const fullSection  = (root.querySelector('#fullBtn')  || root.querySelector('#fullSeek'))?.closest('section');
    if (shortSection && fullSection && fullSection.nextSibling !== shortSection) {
      fullSection.parentNode.insertBefore(shortSection, fullSection.nextSibling);
    }
    // Optional: hide Short block via data-flag (set data-hide-short="true" on <main> or container)
    const shouldHideShort = root.closest('[data-hide-short="true"]') || root.querySelector('[data-hide-short="true"]');
    if (shouldHideShort && shortSection) { shortSection.classList.add('hidden'); }
  } catch {}
  // ---------------------------------------------------------------

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
  shortSeek      = root.querySelector('#shortSeek');
  fullSeek       = root.querySelector('#fullSeek');

  announceTimeCur= root.querySelector('#announceTimeCur');
  announceTimeDur= root.querySelector('#announceTimeDur');
  shortTimeCur   = root.querySelector('#shortTimeCur');
  shortTimeDur   = root.querySelector('#shortTimeDur');
  fullTimeCur    = root.querySelector('#fullTimeCur');
  fullTimeDur    = root.querySelector('#fullTimeDur');

  const langSel = document.querySelector('#lang') || document.querySelector('[data-lang-select]');
  const currentLang = ()=> (langSel?.value || 'EN').toUpperCase();

  const p1 = setupMiniPlayer({ key:'announcement', audioEl:announceAudio, btnEl:announceBtn, statusEl:announceStatus, seekEl:announceSeek, timeCurEl:announceTimeCur, timeDurEl:announceTimeDur, getLang: currentLang });
  const p2 = setupMiniPlayer({ key:'short',        audioEl:shortAudio,    btnEl:shortBtn,    statusEl:shortStatus,    seekEl:shortSeek,    timeCurEl:shortTimeCur,    timeDurEl:shortTimeDur,    getLang: currentLang });
  const p3 = setupMiniPlayer({ key:'full',         audioEl:fullAudio,     btnEl:fullBtn,     statusEl:fullStatus,     seekEl:fullSeek,     timeCurEl:fullTimeCur,     timeDurEl:fullTimeDur,     getLang: currentLang });

  // Первичная загрузка по языку
  const L = currentLang();
  setAnnouncementForLang(L,false);
  setShortForLang(L,false);
  setFullForLang(L,false);

  // Reader callouts (под заголовками)
  ensureReaderCallouts(root);

  // Responsive
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

    setAnnouncementForLang(l,false);
    setShortForLang(l,false);
    setFullForLang(l,false);

    // обновляем подписи в карточках мини-плееров
    const sNote = root.querySelector('.trus-reader-row .text-sm');
    if (sNote) sNote.textContent = t('reader.short.note','Some details are omitted. The text focuses on the chronology of events and the overall arc.');
    updateMiniLabels();
  });

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
  // --------------------------------

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
