// assets/js/core/audio.js
// Устойчивый контроллер фоновой музыки «Story in music».
// Работает даже если в DOM появляется несколько экземпляров <audio>,
// корректно обновляет подпись кнопки и ставит на паузу при запуске других плееров.

import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';

const audioBtn   = $('#audioBtn');
const langSelect = $('#lang');

const BGA_SELECTOR = '#bgAudio, [data-bg-audio]';
const bound = new WeakSet();

// i18n-лейблы
function playLabel()  { return I18N['audio.play']  || DEFAULT_I18N['audio.play']  || 'Story in music'; }
function pauseLabel() { return I18N['audio.pause'] || DEFAULT_I18N['audio.pause'] || '‖ Pause'; }

// Все фоновые аудио
function getBgAudios() {
  return Array.from(document.querySelectorAll(BGA_SELECTOR))
    .filter(el => el && el.tagName === 'AUDIO');
}

// Выбор «первичного» экземпляра
function pickPrimary(audios) {
  if (!audios.length) return null;
  const playing = audios.find(a => !a.paused && !a.ended);
  return playing || audios[0];
}

// Гарантируем кликабельность кнопки (на случай агрессивных CSS)
function ensureClickable() {
  if (!audioBtn) return;
  audioBtn.classList.add('js-interactive');
  audioBtn.style.pointerEvents = 'auto';
  audioBtn.removeAttribute('disabled');
}

// Обновить подпись/aria состояния кнопки
export function updateAudioLabels(){
  if (!audioBtn) return;
  const audios = getBgAudios();
  const anyPlaying = audios.some(a => !a.paused && !a.ended);
  audioBtn.textContent = anyPlaying ? pauseLabel() : playLabel();
  audioBtn.setAttribute('aria-pressed', anyPlaying ? 'true' : 'false');
  ensureClickable();
}

// Подставить трек языка и при необходимости запустить
export function setMainAudioForLang(lang, autoplay=false){
  const audios = getBgAudios();
  if (!audios.length) { updateAudioLabels(); return; }

  const L = (lang || 'EN').toUpperCase();
  const src = `audio/ORUS-${L}.mp3`;

  const primary = pickPrimary(audios);

  // Глушим все, кроме primary (во избежание «двойной музыки»)
  audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });

  if (!primary) { updateAudioLabels(); return; }

  if (primary.src.endsWith(src)) {
    if (autoplay && primary.paused) primary.play().catch(()=>{});
    return; // события play/pause сами вызовут updateAudioLabels
  }

  try { primary.pause(); } catch {}
  primary.src = src;
  if (autoplay) primary.play().catch(()=>{});
  // updateAudioLabels не вызываем здесь — дождёмся событий <audio>, чтобы не мигать
}

// Поставить на паузу все фоновые аудио (без немедленного update — доверимся событиям)
function pauseAllBg(except=null){
  getBgAudios().forEach(a => { if (a !== except && !a.paused) { try{ a.pause(); } catch{} } });
}

// Навесить события на экземпляр (однократно)
function bindAudioEvents(a){
  if (!a || bound.has(a)) return;
  bound.add(a);

  // Сразу отражаем состояние в кнопке по ключевым событиям
  a.addEventListener('play',     updateAudioLabels);
  a.addEventListener('playing',  updateAudioLabels);
  a.addEventListener('pause',    updateAudioLabels);
  a.addEventListener('ended',    updateAudioLabels);
  a.addEventListener('emptied',  updateAudioLabels);
}

// Подцепиться ко всем экземплярам, если они есть
function bindAllIfNeeded(){
  getBgAudios().forEach(bindAudioEvents);
  updateAudioLabels();
}

// Кнопка: надёжный toggle
if (audioBtn && !audioBtn.__headerAudioBound__) {
  audioBtn.__headerAudioBound__ = true;
  ensureClickable();

  audioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    ensureClickable();

    const audios = getBgAudios();
    if (!audios.length) { updateAudioLabels(); return; }

    const isAnyPlaying = audios.some(a => !a.paused && !a.ended);
    const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

    if (isAnyPlaying) {
      // Надёжно гасим всё
      pauseAllBg();
      // updateAudioLabels произойдёт по событиям pause/ended
      return;
    }

    // Стартуем трек текущего языка на primary и глушим остальные
    setMainAudioForLang(curLang, true);
    pauseAllBg(pickPrimary(getBgAudios()));
  });
}

// При смене языка: сначала отразим текущее состояние, затем сменим трек, если играет
onLocaleChanged(({ lang }) => {
  const anyPlaying = getBgAudios().some(a => !a.paused && !a.ended);
  updateAudioLabels(); // без мигания
  setMainAudioForLang(lang || (langSelect?.value || 'EN'), anyPlaying);
});

// Если запускаются другие плееры — фон ставим на паузу
document.addEventListener('pause-others', (e) => {
  const ex = e.detail?.except || null;
  pauseAllBg(ex);
});

// Жизненный цикл: когда DOM готов / после перерисовки страницы
document.addEventListener('DOMContentLoaded', bindAllIfNeeded);
document.addEventListener('trus:route:rendered', bindAllIfNeeded);

// Мягкий тикер старта: если аудио добавят чуть позже — подхватим
let tries = 0;
(function tick(){
  if (tries++ > 20) return; // ~2 секунды
  if (!getBgAudios().length) setTimeout(tick, 100);
  else bindAllIfNeeded();
})();

// Первичная синхронизация
updateAudioLabels();
