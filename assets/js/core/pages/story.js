// assets/js/core/pages/story.js
import { $, $$ } from '../dom.js';
import { t, I18N, DEFAULT_I18N, onLocaleChanged } from '../i18n.js';
import { openModal } from '../modal.js';
import { initSounds, getSoundUrl, onSoundsReady } from '../soundRouter.js';

let announceAudio, shortAudio, fullAudio;
let announceBtn, shortBtn, fullBtn;
let announceStatus, shortStatus, fullStatus;
let onPauseOthers;
let unLocale;

function label(key, fallback){
  return (I18N[key] || DEFAULT_I18N[key] || fallback);
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
    // звуки ещё не подгружены — дождёмся реестра
    onSoundsReady(() => {
      trySet();
      updateMiniLabels();
    });
  } else {
    updateMiniLabels();
  }
}

// Узкоспециализированные обёртки (для читабельности)
function setAnnouncementForLang(l, autoplay=false){
  setAudioFromRouter(announceAudio, 'announcement', l, autoplay);
}
function setShortForLang(l, autoplay=false){
  setAudioFromRouter(shortAudio, 'short', l, autoplay);
}
function setFullForLang(l, autoplay=false){
  setAudioFromRouter(fullAudio, 'full', l, autoplay);
}

export function init(root){
  // Инициируем загрузку реестра звуков
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

  const langSel  = $('#lang');
  const currentLang = () => (langSel?.value || 'EN').toUpperCase();

  // ——— Защита от перезаписи переводом: только на аудиокнопки мини‑плееров ———
  [announceBtn, shortBtn, fullBtn].forEach(btn => btn && btn.setAttribute('data-i18n-skip',''));

  // Обработчики кликов + события для каждого мини‑плеера
  if (announceBtn && announceAudio) {
    announceBtn.addEventListener('click', ()=>{
      if (announceAudio.paused){
        setAnnouncementForLang(currentLang(), true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: announceAudio }}));
      } else {
        announceAudio.pause();
      }
    });
    ['play','playing'].forEach(ev => announceAudio.addEventListener(ev, ()=>{
      announceStatus && (announceStatus.textContent = label('status.playing','Playing…'));
      updateMiniLabels();
    }));
    ['pause','ended'].forEach(ev => announceAudio.addEventListener(ev, ()=>{
      announceStatus && (announceStatus.textContent = label('status.paused','Paused'));
      updateMiniLabels();
    }));
  }

  if (shortBtn && shortAudio) {
    shortBtn.addEventListener('click', ()=>{
      if (shortAudio.paused){
        setShortForLang(currentLang(), true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: shortAudio }}));
      } else {
        shortAudio.pause();
      }
    });
    ['play','playing'].forEach(ev => shortAudio.addEventListener(ev, ()=>{
      shortStatus && (shortStatus.textContent = label('status.playing','Playing…'));
      updateMiniLabels();
    }));
    ['pause','ended'].forEach(ev => shortAudio.addEventListener(ev, ()=>{
      shortStatus && (shortStatus.textContent = label('status.paused','Paused'));
      updateMiniLabels();
    }));
  }

  // === Новый плеер: Полная версия истории ===
  if (fullBtn && fullAudio) {
    fullBtn.addEventListener('click', ()=>{
      if (fullAudio.paused){
        setFullForLang(currentLang(), true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: fullAudio }}));
      } else {
        fullAudio.pause();
      }
    });
    ['play','playing'].forEach(ev => fullAudio.addEventListener(ev, ()=>{
      fullStatus && (fullStatus.textContent = label('status.playing','Playing…'));
      updateMiniLabels();
    }));
    ['pause','ended'].forEach(ev => fullAudio.addEventListener(ev, ()=>{
      fullStatus && (fullStatus.textContent = label('status.paused','Paused'));
      updateMiniLabels();
    }));
  }

  // Реакция на смену языка (обновить тексты и подменить src при активном воспроизведении)
  unLocale = onLocaleChanged(({ detail })=>{
    const l = (detail?.lang || langSel?.value || 'EN').toUpperCase();
    if (!announceAudio?.paused) setAnnouncementForLang(l, true);
    if (!shortAudio?.paused)    setShortForLang(l, true);
    if (!fullAudio?.paused)     setFullForLang(l, true);
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

  // Важно: больше НЕ проставляем src заранее — полная ленивая загрузка (трафик Netlify не тратится)
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
  onPauseOthers = unLocale = null;
}
