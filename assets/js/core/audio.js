// assets/js/core/audio.js
// Контроллер фоновой музыки «Story in music».
// Надёжный toggle: пауза по второму клику, гашение параллельных плееров (pause-others),
// работа с несколькими экземплярами <audio> в DOM (берём "активный").

import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';

const audioBtn   = $('#audioBtn');
const langSelect = $('#lang');

const BGA_SELECTOR = '#bgAudio, [data-bg-audio]';
const bound = new WeakSet();

// ——— метки
function playLabel()  { return I18N['audio.play']  || DEFAULT_I18N['audio.play']  || 'Story in music'; }
function pauseLabel() { return I18N['audio.pause'] || DEFAULT_I18N['audio.pause'] || '‖ Pause'; }

// ——— утилиты
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
}
export function updateAudioLabels(){
  if (!audioBtn) return;
  const anyPlaying = getBgAudios().some(a => !a.paused && !a.ended);
  audioBtn.textContent = anyPlaying ? pauseLabel() : playLabel();
  audioBtn.setAttribute('aria-pressed', anyPlaying ? 'true' : 'false');
  ensureClickable();
}

// ——— запустить трек языка на primary (и заткнуть дубликаты)
export function setMainAudioForLang(lang, autoplay=false){
  const audios = getBgAudios();
  if (!audios.length) { updateAudioLabels(); return; }

  const L = (lang || 'EN').toUpperCase();
  const src = `audio/ORUS-${L}.mp3`;

  const primary = pickPrimary(audios);
  // заткнуть всех, кроме primary (устраняем "двойную музыку")
  audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });

  if (!primary) { updateAudioLabels(); return; }

  if (primary.src.endsWith(src)) {
    if (autoplay && primary.paused) primary.play().catch(()=>{});
    return; // события сами дернут updateAudioLabels
  }

  try { primary.pause(); } catch {}
  primary.src = src;
  if (autoplay) primary.play().catch(()=>{});
  // не дергаем updateAudioLabels здесь — дождёмся событий <audio>
}

// ——— поставить на паузу все фоновые (события сами обновят кнопку)
function pauseAllBg(except=null){
  getBgAudios().forEach(a => { if (a !== except && !a.paused) { try{ a.pause(); } catch{} } });
}

// ——— навес событий на экземпляр (однократно)
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

// ——— поведение кнопки: НАДЁЖНЫЙ TOGGLE
if (audioBtn && !audioBtn.__headerAudioBound__) {
  audioBtn.__headerAudioBound__ = true;
  ensureClickable();

  audioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    ensureClickable();

    const audios = getBgAudios();
    if (!audios.length) { updateAudioLabels(); return; }

    const primary = pickPrimary(audios) || audios[0];
    const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

    if (primary && !primary.paused && !primary.ended) {
      // БЫЛО "Pause" → реально ставим паузу именно активному экземпляру
      try { primary.pause(); } catch {}
      // подстраховочно глушим дубликаты
      audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });
      // события pause сами обновят кнопку
      return;
    }

    // БЫЛО "Play" → запускаем трек текущего языка
    setMainAudioForLang(curLang, true);

    // после старта обязательно глушим другие аудио‑плееры проекта
    const bgAfterStart = pickPrimary(getBgAudios());
    document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: bgAfterStart }}));

    // и на всякий — если внезапно появилось несколько bg‑экземпляров, заткнём прочие
    pauseAllBg(bgAfterStart);
  });
}

// ——— смена языка: без мигания подписи; если музыка играла — поменяем трек и продолжим
onLocaleChanged(({ lang }) => {
  const anyPlaying = getBgAudios().some(a => !a.paused && !a.ended);
  updateAudioLabels(); // отразить текущее состояние
  setMainAudioForLang(lang || (langSelect?.value || 'EN'), anyPlaying);
});

// ——— если запускаются другие плееры — фон ставим на паузу
document.addEventListener('pause-others', (e) => {
  const ex = e.detail?.except || null;
  pauseAllBg(ex);
});

// ——— жизненный цикл
document.addEventListener('DOMContentLoaded', bindAllIfNeeded);
document.addEventListener('trus:route:rendered', bindAllIfNeeded);

let tries = 0;
(function tick(){
  if (tries++ > 20) return; // ~2s
  if (!getBgAudios().length) setTimeout(tick, 100);
  else bindAllIfNeeded();
})();

updateAudioLabels();
