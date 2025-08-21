// assets/js/core/audio.js
import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';

const audioBtn   = $('#audioBtn');
const langSelect = $('#lang');

const BGA_SELECTOR = '#bgAudio, [data-bg-audio]';
const bound = new WeakSet();

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
  // на всякий — пусть это точно кнопка
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
  const src = `audio/ORUS-${L}.mp3`;

  const primary = pickPrimary(audios);
  audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });

  if (!primary) { updateAudioLabels(); return; }

  if (primary.src.endsWith(src)) {
    if (autoplay && primary.paused) primary.play().catch(()=>{});
    return; // события сами дернут updateAudioLabels
  }

  try { primary.pause(); } catch {}
  primary.src = src;
  if (autoplay) primary.play().catch(()=>{});
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

/* === NEW: единая функция переключения === */
function toggleBgMusic() {
  ensureClickable();

  const audios = getBgAudios();
  if (!audios.length) { updateAudioLabels(); return; }

  const primary = pickPrimary(audios) || audios[0];
  const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

  if (primary && !primary.paused && !primary.ended) {
    try { primary.pause(); } catch {}
    audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });
    return;
  }

  setMainAudioForLang(curLang, true);

  const bgAfterStart = pickPrimary(getBgAudios());
  document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: bgAfterStart }}));
  pauseAllBg(bgAfterStart);
}

/* === UPDATED: обвязка на все случаи (capture + bubble + pointer + keyboard) === */
if (audioBtn && !audioBtn.__headerAudioBound__) {
  audioBtn.__headerAudioBound__ = true;
  ensureClickable();

  const handler = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    toggleBgMusic();
  };

  // Click в capture-фазе — раньше любых внешних обработчиков
  audioBtn.addEventListener('click', handler, true);
  // И ещё раз в bubble — если capture вдруг кто-то отменил
  audioBtn.addEventListener('click', handler, false);

  // На случай, если кто-то убивает click — реагируем ещё на pointerdown
  audioBtn.addEventListener('pointerdown', handler, true);

  // Доступность: Space/Enter = toggle
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
  if (tries++ > 20) return;
  if (!getBgAudios().length) setTimeout(tick, 100);
  else bindAllIfNeeded();
})();

updateAudioLabels();
