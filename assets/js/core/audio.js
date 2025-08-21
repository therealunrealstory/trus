// assets/js/core/audio.js
// Стабильный контроллер фоновой музыки «Story in music».
// Теперь берёт источник через soundRouter (sounds.json), а не из локальных путей.

import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';
import { initSounds, getSoundUrl, onSoundsReady } from './soundRouter.js';

const audioBtn   = $('#audioBtn');
const langSelect = $('#lang');

const BGA_SELECTOR = '#bgAudio, [data-bg-audio]';
const bound = new WeakSet();

// инициализируем загрузку реестра звуков как можно раньше
initSounds();

function playLabel()  { return I18N['audio.play']  || DEFAULT_I18N['audio.play']  || 'Story in music'; }
function pauseLabel() { return I18N['audio.pause'] || DEFAULT_I18N['audio.pause'] || '‖ Pause'; }

function getBgAudios() {
  return Array.from(document.querySelectorAll(BGA_SELECTOR))
    .filter(el => el && el.tagName === 'AUDIO');
}
function pickPrimary(audios) {
  if (!audios.length) return null;
  const playing = audios.find(a => !a.paused && !a.ended);
  return playing || audios[0];
}
function ensureClickable() {
  if (!audioBtn) return;
  audioBtn.classList.add('js-interactive');
  audioBtn.style.pointerEvents = 'auto';
  audioBtn.removeAttribute('disabled');
  if (!audioBtn.getAttribute('type')) audioBtn.setAttribute('type','button');
}

export function updateAudioLabels(){
  if (!audioBtn) return;
  const anyPlaying = getBgAudios().some(a => !a.paused && !a.ended);
  audioBtn.textContent = anyPlaying ? pauseLabel() : playLabel();
  audioBtn.setAttribute('aria-pressed', anyPlaying ? 'true' : 'false');
  ensureClickable();
}

export function setMainAudioForLang(lang, autoplay=false){
  const audios = getBgAudios();
  if (!audios.length) { updateAudioLabels(); return; }

  const L = (lang || 'EN').toUpperCase();
  const url = getSoundUrl('bg', L);

  const primary = pickPrimary(audios);
  if (!primary) { updateAudioLabels(); return; }

  // Если реестр ещё не готов — дождёмся и повторим
  if (!url) {
    onSoundsReady(() => setMainAudioForLang(L, autoplay));
    updateAudioLabels();
    return;
  }

  // погасим всех, кроме primary — один раз, до установки src
  audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });

  if (!(primary.src && (primary.src === url || primary.src.endsWith(url)))) {
    try { primary.pause(); } catch {}
    primary.preload = 'none';
    primary.crossOrigin = 'anonymous';
    primary.src = url;
  }
  if (autoplay) primary.play().catch(()=>{});
  // подпись обновится по событиям <audio>
}

function pauseAllBg(except=null){
  getBgAudios().forEach(a => { if (a !== except && !a.paused) { try{ a.pause(); } catch{} } });
}

function bindAudioEvents(a){
  if (!a || bound.has(a)) return;
  bound.add(a);
  ['play','playing','pause','ended','emptied','abort'].forEach(ev =>
    a.addEventListener(ev, updateAudioLabels)
  );
}
function bindAllIfNeeded(){
  getBgAudios().forEach(bindAudioEvents);
  updateAudioLabels();
}

/* === Единая функция переключения === */
function toggleBgMusic() {
  ensureClickable();

  const audios = getBgAudios();
  if (!audios.length) { updateAudioLabels(); return; }

  const primary = pickPrimary(audios) || audios[0];
  const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

  if (primary && !primary.paused && !primary.ended) {
    try { primary.pause(); } catch {}
    // на всякий: погасим возможные дубликаты
    audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });
    return;
  }

  setMainAudioForLang(curLang, true);

  // попросим другие плееры замолчать
  const bgAfterStart = pickPrimary(getBgAudios());
  document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: bgAfterStart }}));
}

/* === Обработчики: ОДИН click + клавиатура, с анти‑дребезгом === */
if (audioBtn && !audioBtn.__headerAudioBound__) {
  audioBtn.__headerAudioBound__ = true;
  ensureClickable();

  let lastTs = 0;
  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    const now = Date.now();
    if (now - lastTs < 160) return; // анти‑дребезг 160мс
    lastTs = now;

    toggleBgMusic();
  };

  // Только bubble‑фаза (никакого capture/pointerdown)
  audioBtn.addEventListener('click', handler, false);

  // Доступность: Space/Enter = toggle (тоже с анти‑дребезгом внутри handler)
  audioBtn.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Enter') handler(e);
  });
}

onLocaleChanged(({ lang }) => {
  const anyPlaying = getBgAudios().some(a => !a.paused && !a.ended);
  updateAudioLabels();
  setMainAudioForLang(lang || (langSelect?.value || 'EN'), anyPlaying);
});

document.addEventListener('pause-others', (e) => {
  const ex = e.detail?.except || null;
  pauseAllBg(ex);
});

document.addEventListener('DOMContentLoaded', bindAllIfNeeded);
document.addEventListener('trus:route:rendered', bindAllIfNeeded);

let tries = 0;
(function tick(){
  if (tries++ > 20) return; // ~2s
  if (!getBgAudios().length) setTimeout(tick, 100);
  else bindAllIfNeeded();
})();

updateAudioLabels();
