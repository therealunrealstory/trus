// assets/js/core/pages/story.js
import { $, $$ } from '../dom.js';
import { t, I18N, DEFAULT_I18N, onLocaleChanged } from '../i18n.js';
import { openModal } from '../modal.js';
import { initSounds, getSoundUrl, onSoundsReady } from '../soundRouter.js';
import { attachStoryReaders } from '../reader.js';

let announceAudio, shortAudio, fullAudio;
let announceBtn, shortBtn, fullBtn;
let announceStatus, shortStatus, fullStatus;

// Seek UI elements
let announceSeek, shortSeek, fullSeek;
let announceTimeCur, announceTimeDur;
let shortTimeCur, shortTimeDur;
let fullTimeCur, fullTimeDur;

let onPauseOthers;
let unLocale;

/* ====== Новое: настройки автопродолжения ====== */
const RESUME_ENABLED = true;
const RESUME_MIN_SECONDS = 15;    // не возобновляем, если слушали меньше 15с
const RESUME_MARGIN_TAIL = 8;     // если оставалось <8с до конца — считаем завершённым
const RESUME_SAVE_INTERVAL = 10000; // сохранять позицию каждые 10с

function label(key, fallback){
  return (I18N[key] || DEFAULT_I18N[key] || fallback);
}

function fmtTime(sec){
  if (!Number.isFinite(sec) || sec < 0) return '--:--';
  sec = Math.floor(sec);
  const h = Math.floor(sec/3600);
  const m = Math.floor((sec%3600)/60);
  const s = sec%60;
  const mm = (h>0 ? String(m).padStart(2,'0') : String(m));
  const hh = String(h);
  const ss = String(s).padStart(2,'0');
  return h>0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

/* ====== Новое: ключи и хранилище прогресса ====== */
function resumeKey(trackKey, lang){ return `seek:${trackKey}:${(lang||'EN').toUpperCase()}`; }
function readResume(trackKey, lang){
  try {
    const v = localStorage.getItem(resumeKey(trackKey, lang));
    const n = v == null ? NaN : Number(v);
    return Number.isFinite(n) ? Math.max(0, n) : NaN;
  } catch { return NaN; }
}
function writeResume(trackKey, lang, seconds){
  try {
    localStorage.setItem(resumeKey(trackKey, lang), String(Math.max(0, Math.floor(seconds||0))));
  } catch {}
}
function clearResumeIfCompleted(trackKey, lang){
  try { localStorage.removeItem(resumeKey(trackKey, lang)); } catch {}
}

function updateMiniLabels(){
  if (announceBtn && announceAudio) {
    announceBtn.textContent = announceAudio.paused ? label('announce.play','▶︎ Play')
                                                   : label('announce.pause','‖ Pause');
  }
  if (shortBtn && shortAudio) {
    shortBtn.textContent = shortAudio.paused ? label('short.play','▶︎ Play')
                                             : label('short.pause','‖ Pause');
  }
  if (fullBtn && fullAudio) {
    fullBtn.textContent = fullAudio.paused ? label('full.play','▶︎ Play')
                                           : label('full.pause','‖ Pause');
  }
}

function setAudioFromRouter(audioEl, key, lang, autoplay=false){
  if (!audioEl) return;

  const trySet = () => {
    const url = getSoundUrl(key, lang);
    if (!url) { return false; }
    // не дублируем установку
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

  if (!trySet()) {
    onSoundsReady(() => { trySet(); updateMiniLabels(); });
  } else {
    updateMiniLabels();
  }
}

// Узкоспециализированные обёртки
function setAnnouncementForLang(l, autoplay=false){
  setAudioFromRouter(announceAudio, 'announcement', l, autoplay);
}
function setShortForLang(l, autoplay=false){
  setAudioFromRouter(shortAudio, 'short', l, autoplay);
}
function setFullForLang(l, autoplay=false){
  setAudioFromRouter(fullAudio, 'full', l, autoplay);
}

/* === Общая настройка мини‑плеера с поддержкой seek + resume === */
function setupMiniPlayer(opts){
  const {
    key,                // 'announcement' | 'short' | 'full'
    audioEl, btnEl, statusEl,
    seekEl, timeCurEl, timeDurEl,
    getLang
  } = opts;
  if (!audioEl || !btnEl) return;

  // не даём i18n перезаписывать подписи на кнопках
  btnEl.setAttribute('data-i18n-skip','');

  // Внутреннее состояние
  let dragging = false;
  let rafId = 0;
  let saveTimer = 0;
  let appliedResumeForLang = null; // чтобы не применять повторно одну и ту же позицию

  // Клик Play/Pause
  btnEl.addEventListener('click', ()=>{
    const L = getLang();

    if (audioEl.paused){
      // лениво подставим src и запустим
      if (key === 'announcement') setAnnouncementForLang(L, true);
      else if (key === 'short')  setShortForLang(L, true);
      else if (key === 'full')   setFullForLang(L, true);

      // Попросим другие плееры замолчать
      document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: audioEl }}));
    } else {
      audioEl.pause();
    }
  });

  // Метаданные → показать длительность и включить слайдер
  const onMeta = ()=>{
    const d = audioEl.duration;
    if (Number.isFinite(d) && d > 0){
      timeDurEl && (timeDurEl.textContent = fmtTime(d));
      if (seekEl){
        seekEl.max = Math.floor(d);
        seekEl.disabled = false;
      }

      // ===== Новое: автопродолжение на основе localStorage =====
      if (RESUME_ENABLED){
        const L = getLang();
        // применяем resume один раз на язык и трек
        if (appliedResumeForLang !== L){
          const saved = readResume(key, L);
          if (Number.isFinite(saved) &&
              saved >= RESUME_MIN_SECONDS &&
              saved < (d - RESUME_MARGIN_TAIL)) {
            try { audioEl.currentTime = saved; } catch {}
            if (seekEl) seekEl.value = Math.floor(audioEl.currentTime || 0);
          } else if (Number.isFinite(saved) && saved >= (d - RESUME_MARGIN_TAIL)) {
            // На финише – считаем завершённым
            clearResumeIfCompleted(key, L);
          }
          appliedResumeForLang = L;
        }
      }
      // ===== /Новое =====

    } else {
      timeDurEl && (timeDurEl.textContent = '--:--');
      if (seekEl){
        seekEl.value = 0; seekEl.max = 0; seekEl.disabled = true;
      }
    }
  };

  // Обновление UI раз в кадр (гладко)
  const tick = ()=>{
    if (!audioEl) return;
    if (!dragging && seekEl){
      const t = audioEl.currentTime || 0;
      if (Number.isFinite(t)) seekEl.value = Math.floor(t);
    }
    timeCurEl && (timeCurEl.textContent = fmtTime(audioEl.currentTime || 0));
    rafId = audioEl.paused ? 0 : requestAnimationFrame(tick);
  };

  audioEl.addEventListener('loadedmetadata', onMeta);

  ['play','playing'].forEach(ev => audioEl.addEventListener(ev, ()=>{
    statusEl && (statusEl.textContent = label('status.playing','Playing…'));
    updateMiniLabels();
    if (!rafId) rafId = requestAnimationFrame(tick);

    // ===== Новое: периодическое сохранение позиции =====
    if (RESUME_ENABLED && !saveTimer){
      const L = getLang();
      saveTimer = setInterval(()=>{
        try {
          const cur = audioEl.currentTime || 0;
          const d = audioEl.duration;
          if (Number.isFinite(d) && d - cur <= RESUME_MARGIN_TAIL){
            clearResumeIfCompleted(key, L);
          } else {
            writeResume(key, L, cur);
          }
        } catch {}
      }, RESUME_SAVE_INTERVAL);
    }
    // ===== /Новое =====
  }));

  ['pause','ended'].forEach(ev => audioEl.addEventListener(ev, ()=>{
    statusEl && (statusEl.textContent = label('status.paused','Paused'));
    updateMiniLabels();
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }

    // ===== Новое: финальный сейв на паузе, очистка по завершению =====
    if (RESUME_ENABLED){
      const L = getLang();
      try {
        const cur = audioEl.currentTime || 0;
        const d = audioEl.duration;
        if (ev === 'ended' || (Number.isFinite(d) && d - cur <= RESUME_MARGIN_TAIL)){
          clearResumeIfCompleted(key, L);
        } else {
          writeResume(key, L, cur);
        }
      } catch {}
      if (saveTimer){ clearInterval(saveTimer); saveTimer = 0; }
    }
    // ===== /Новое =====
  }));

  // Seek взаимодействие
  if (seekEl){
    // Начало перетаскивания
    seekEl.addEventListener('pointerdown', ()=>{ dragging = true; });
    // Во время перетаскивания — сразу показываем текущий таймер
    seekEl.addEventListener('input', ()=>{
      const v = Number(seekEl.value) || 0;
      timeCurEl && (timeCurEl.textContent = fmtTime(v));
    });
    // Завершение — применяем позицию
    const commit = ()=>{
      const v = Number(seekEl.value) || 0;
      if (Number.isFinite(v)) {
        try { audioEl.currentTime = v; } catch {}
        // Новое: мгновенно записываем прогресс при ручной перемотке
        if (RESUME_ENABLED){
          const L = getLang();
          const d = audioEl.duration;
          if (Number.isFinite(d) && d - v <= RESUME_MARGIN_TAIL) clearResumeIfCompleted(key, L);
          else writeResume(key, L, v);
        }
      }
      dragging = false;
      // если играли — UI снова начнёт тикать по rAF
      if (!audioEl.paused && !rafId) rafId = requestAnimationFrame(tick);
    };
    seekEl.addEventListener('change', commit);
    seekEl.addEventListener('pointerup', commit);
    seekEl.addEventListener('pointercancel', ()=>{ dragging = false; });
    seekEl.addEventListener('keydown', (e)=>{
      // Стрелки и Home/End — системные, доп.логика не нужна
      if (e.key === 'Home') { seekEl.value = 0; seekEl.dispatchEvent(new Event('change')); }
      if (e.key === 'End' && Number.isFinite(audioEl.duration)) {
        seekEl.value = Math.floor(audioEl.duration);
        seekEl.dispatchEvent(new Event('change'));
      }
    });
  }

  return {
    // Переключение языка на лету с сохранением позиции
    onLocaleChange(nextLang){
      if (!audioEl) return;
      const wasPlaying = !audioEl.paused;
      const pos = audioEl.currentTime || 0;
      if (key === 'announcement') setAnnouncementForLang(nextLang, false);
      else if (key === 'short')  setShortForLang(nextLang, false);
      else if (key === 'full')   setFullForLang(nextLang, false);

      const resume = ()=>{
        // дождёмся метаданных нового источника
        if (Number.isFinite(audioEl.duration) && audioEl.duration > 0){
          // при смене языка — возвращаемся на ту же позицию
          try { audioEl.currentTime = Math.min(pos, audioEl.duration - 0.25); } catch {}
          if (seekEl) seekEl.value = Math.floor(audioEl.currentTime || 0);
          if (wasPlaying) audioEl.play().catch(()=>{});
          // обновим длительность/состояние слайдера
          const d = audioEl.duration;
          timeDurEl && (timeDurEl.textContent = fmtTime(d));
          if (seekEl){ seekEl.max = Math.floor(d); seekEl.disabled = false; }
        } else {
          // ещё не готов — повторим чуть позже
          setTimeout(resume, 80);
        }
      };
      resume();

      // Смена языка — сбрасываем флаг автоприменения resume (иначе не сработает при новом L)
      appliedResumeForLang = null;
    }
  };
}


/* =======================
   INLINE READER (book.json → modal)
   ======================= */
const _bookCache = new Map(); // key = `${version}:${lang}`
function readerStorageKey(version, lang){ return `reader:last:${version}:${(lang||'EN').toUpperCase()}`; }

async function loadBook(version, lang){
  const L = (lang||'EN').toLowerCase();
  const key = `${version}:${L}`;
  if (_bookCache.has(key)) return _bookCache.get(key);

  const url = `/books/${version}/${L}/book.json?ts=${Date.now()}`;
  let data = null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.ok) data = await res.json();
  } catch {}
  if (!data || !Array.isArray(data?.chapters)) {
    throw new Error('reader.load.failed');
  }
  _bookCache.set(key, data);
  return data;
}

function renderReaderModal(version, lang, startIndex=0){
  // open modal first with skeleton to avoid flicker
  const ttl = 'The Real Unreal Story'; // не переводим по договоренности
  openModal(ttl, `
    <div id="readerWrap">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="text-xs text-gray-300" id="readerMeta"></div>
        <div class="flex gap-2">
          <button class="px-3 py-1 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-xs" data-act="toc">${t('reader.toc','Оглавление')}</button>
          <button class="px-3 py-1 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-xs" data-act="prev">‹ ${t('reader.prev','Предыдущая')}</button>
          <button class="px-3 py-1 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-xs" data-act="next">${t('reader.next','Следующая')} ›</button>
        </div>
      </div>
      <h4 id="readerTitle" class="text-base font-semibold mb-2"></h4>
      <div id="readerBody" class="text-sm leading-relaxed space-y-3"></div>
      <div id="readerToc" class="mt-4 hidden"></div>
      <div class="mt-4 text-right text-[11px] text-gray-400">${t('reader.hint','Стрелки ←/→ — перелистывание, Esc — закрыть')}</div>
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

  let current = Math.max(0, Number(startIndex)||0);
  let book = null;

  const L = (lang||'EN').toUpperCase();

  const savePos = ()=>{
    try { localStorage.setItem(readerStorageKey(version, L), String(current)); } catch {}
  };
  const readPos = ()=>{
    try {
      const v = localStorage.getItem(readerStorageKey(version, L));
      const n = v == null ? NaN : Number(v);
      return Number.isFinite(n) ? Math.max(0, n) : 0;
    } catch { return 0; }
  };

  function updateButtons(total){
    btnPrev.disabled = current <= 0;
    btnNext.disabled = current >= total - 1;
    btnPrev.classList.toggle('opacity-50', btnPrev.disabled);
    btnNext.classList.toggle('opacity-50', btnNext.disabled);
  }

  function renderToc(total){
    const items = [];
    for (let i=0;i<total;i++){
      const ch = book.chapters[i];
      items.push(`<button data-idx="${i}" class="block w-full text-left px-3 py-2 rounded hover:bg-white/5 text-sm">${htmlEscape(ch.title || (t('reader.chapter','Глава')+' '+(i+1)))}</button>`);
    }
    toc.innerHTML = `
      <div class="rounded-2xl border border-gray-700 p-2" style="background:rgba(0,0,0,0.25)">
        ${items.join('')}
      </div>
    `;
    toc.addEventListener('click', (e)=>{
      const b = e.target.closest('button[data-idx]');
      if (!b) return;
      const idx = Number(b.getAttribute('data-idx'))||0;
      openIdx(idx);
      toc.classList.add('hidden');
    }, { once:false });
  }

  function htmlEscape(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function openIdx(i){
    current = Math.max(0, Math.min(i, (book?.chapters?.length||1)-1));
    const total = book.chapters.length;
    const ch = book.chapters[current];
    // header meta
    meta.textContent = `${t('reader.chapter','Глава')} ${current+1} ${t('reader.of','из')} ${total}`;
    // title
    title.textContent = ch.title || `${t('reader.chapter','Глава')} ${current+1}`;
    // content
    body.innerHTML = ch.html || '';
    updateButtons(total);
    savePos();
  }

  // keyboard
  const onKey = (e)=>{
    if (!document.getElementById('modalBody')) return;
    if (e.key === 'ArrowLeft') { btnPrev.click(); e.preventDefault(); }
    if (e.key === 'ArrowRight'){ btnNext.click(); e.preventDefault(); }
  };
  document.addEventListener('keydown', onKey);

  // controls
  btnPrev.addEventListener('click', ()=> openIdx(current-1));
  btnNext.addEventListener('click', ()=> openIdx(current+1));
  btnToc.addEventListener('click', ()=> toc.classList.toggle('hidden'));

  // pause all audios on open
  document.dispatchEvent(new CustomEvent('pause-others', { detail: 'reader' }));

  // load book
  loadBook(version, L).then(b=>{
    book = b;
    if (!Number.isFinite(startIndex)) current = readPos();
    renderToc(book.chapters.length);
    openIdx(current);
  }).catch(()=>{
    body.innerHTML = `<div class="text-red-300">${t('reader.error','Не удалось загрузить книгу. Попробуйте позже.')}</div>`;
  }).finally(()=>{
    // cleanup on modal close
    const modal = document.getElementById('modalBackdrop');
    const obs = new MutationObserver(()=>{
      if (!modal.classList.contains('show')){
        document.removeEventListener('keydown', onKey);
        obs.disconnect();
      }
    });
    obs.observe(modal, { attributes:true, attributeFilter:['class'] });
  });
}

function readerCalloutHTML(kind){
  const note = kind === 'short'
    ? t('short.read.note','Краткая версия истории. Упущены некоторые детали; акцент на хронологии событий.')
    : t('full.read.note','Полная версия истории. Больше деталей и эмоциональных переживаний, взаимодействия с персонажами и понимания их личностей.');
  const btnId = kind === 'short' ? 'shortReadBtn' : 'fullReadBtn';
  return `
    <div class="mt-3 rounded-2xl border border-gray-700 p-4 flex items-center gap-3" style="background:rgba(0,0,0,0.35)">
      <button id="${btnId}" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm pulse">📖 ${t('reader.open','Читать')}</button>
      <div class="text-sm text-gray-200">${note}</div>
    </div>
  `;
}

export function init(root){
attachStoryReaders(root);
  initSounds();

  // DOM
  announceAudio  = root.querySelector('#announceAudio') || root.querySelector('[data-audio="announce"]') || null;
  shortAudio     = root.querySelector('#shortAudio')    || root.querySelector('[data-audio="short"]')    || null;
  fullAudio      = root.querySelector('#fullAudio')     || root.querySelector('[data-audio="full"]')     || null;

  announceBtn    = root.querySelector('#announceBtn');
  announceStatus = root.querySelector('#announceStatus');
  shortBtn       = root.querySelector('#shortBtn');
  shortStatus    = root.querySelector('#shortStatus');
  fullBtn        = root.querySelector('#fullBtn');
  fullStatus     = root.querySelector('#fullStatus');

  // Seek elements
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

  // Инициализируем три мини‑плеера единообразно
  const p1 = setupMiniPlayer({
    key:'announcement',
    audioEl:announceAudio, btnEl:announceBtn, statusEl:announceStatus,
    seekEl:announceSeek, timeCurEl:announceTimeCur, timeDurEl:announceTimeDur,
    getLang: currentLang
  });
  const p2 = setupMiniPlayer({
    key:'short',
    audioEl:shortAudio, btnEl:shortBtn, statusEl:shortStatus,
    seekEl:shortSeek, timeCurEl:shortTimeCur, timeDurEl:shortTimeDur,
    getLang: currentLang
  });
  const p3 = setupMiniPlayer({
    key:'full',
    audioEl:fullAudio, btnEl:fullBtn, statusEl:fullStatus,
    seekEl:fullSeek, timeCurEl:fullTimeCur, timeDurEl:fullTimeDur,
    getLang: currentLang
  });

  // Реакция на смену языка
  unLocale = onLocaleChanged(({ detail })=>{
    const l = (detail?.lang || langSel?.value || 'EN').toUpperCase();
    p1?.onLocaleChange(l);
    p2?.onLocaleChange(l);
    p3?.onLocaleChange(l);
    
  // === Reader: insert callouts under Short & Full mini-players ===
  try {
    const L = currentLang();
    const shortSection = root.querySelector('#shortAudio')?.closest('section');
    const fullSection  = root.querySelector('#fullAudio')?.closest('section');

    if (shortSection && !shortSection.querySelector('#shortReadBtn')) {
      const seek = shortSection.querySelector('.mini-player-seek');
      const holder = document.createElement('div');
      holder.innerHTML = readerCalloutHTML('short');
      (seek?.parentNode || shortSection).appendChild(holder.firstElementChild);
      shortSection.querySelector('#shortReadBtn')?.addEventListener('click', ()=>{
        renderReaderModal('short', currentLang(), NaN /* continue from saved */);
      });
    }
    if (fullSection && !fullSection.querySelector('#fullReadBtn')) {
      const seek = fullSection.querySelector('.mini-player-seek');
      const holder = document.createElement('div');
      holder.innerHTML = readerCalloutHTML('full');
      (seek?.parentNode || fullSection).appendChild(holder.firstElementChild);
      fullSection.querySelector('#fullReadBtn')?.addEventListener('click', ()=>{
        renderReaderModal('full', currentLang(), NaN /* continue from saved */);
      });
    }
  } catch {}

  updateMiniLabels();
  });

  // Когда другие плееры стартуют — останавливаемся
  onPauseOthers = (e)=>{
    const ex = e.detail?.except;
    [announceAudio, shortAudio, fullAudio].forEach(a => { if (a && a !== ex && !a.paused) a.pause(); });
    updateMiniLabels();
  };
  document.addEventListener('pause-others', onPauseOthers);

  // Тайлы/модалки — оставлено как у вас (пример):
  root.querySelector('#tile1')?.addEventListener('click', ()=> openModal(t('tiles.me','I’m Nico'), t('modal.tile1.body','…')));
  root.querySelector('#tile2')?.addEventListener('click', ()=> openModal(t('tiles.about','About Adam'), t('modal.tile2.body','…')));
  root.querySelector('#tile3')?.addEventListener('click', ()=> openModal(t('tiles.others','Other people in the story'), t('modal.tile3.body','…')));

  updateMiniLabels();
}

export function destroy(){
  try { announceAudio?.pause(); } catch {}
  try { shortAudio?.pause(); } catch {}
  try { fullAudio?.pause(); } catch {}
  document.removeEventListener('pause-others', onPauseOthers);
  if (typeof unLocale === 'function') unLocale();

  announceAudio = shortAudio = fullAudio = null;
  announceBtn = shortBtn = fullBtn = announceStatus = shortStatus = fullStatus = null;

  announceSeek = shortSeek = fullSeek = null;
  announceTimeCur = announceTimeDur = shortTimeCur = shortTimeDur = fullTimeCur = fullTimeDur = null;

  onPauseOthers = unLocale = null;
}
