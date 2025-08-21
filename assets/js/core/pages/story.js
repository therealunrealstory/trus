// assets/js/core/pages/story.js
import { $, $$ } from '../dom.js';
import { t, I18N, DEFAULT_I18N, onLocaleChanged } from '../i18n.js';
import { openModal } from '../modal.js';
import { initSounds, getSoundUrl, onSoundsReady } from '../soundRouter.js';

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

export function init(root){
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
