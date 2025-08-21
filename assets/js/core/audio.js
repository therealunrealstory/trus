// assets/js/core/audio.js
// Устойчивый контроллер музыки в шапке: не кэшируем #bgAudio на старте,
// а ищем его каждый раз (лениво). События подцепляем, когда элемент появляется.

import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';

const audioBtn   = $('#audioBtn');
const langSelect = $('#lang');

// ——— утилиты перевода меток
function playLabel()  { return I18N['audio.play']  || DEFAULT_I18N['audio.play']  || 'Story in music'; }
function pauseLabel() { return I18N['audio.pause'] || DEFAULT_I18N['audio.pause'] || '‖ Pause'; }

// ——— ленивый доступ к #bgAudio
function getBgAudio() {
  return document.getElementById('bgAudio') || null;
}

// ——— обновление метки кнопки
export function updateAudioLabels(){
  if (!audioBtn) return;
  const a = getBgAudio();
  audioBtn.textContent = (a && !a.paused) ? pauseLabel() : playLabel();
  audioBtn.setAttribute('aria-pressed', a && !a.paused ? 'true' : 'false');
}

// ——— установка трека по текущему языку
export function setMainAudioForLang(l, autoplay=false){
  const a = getBgAudio();
  if (!a) return; // аудио ещё не в DOM — клик всё равно был пользовательским, но подождём появления
  const L = (l || 'EN').toUpperCase();
  const src = `audio/ORUS-${L}.mp3`;
  if (a.src.endsWith(src)) {
    if (autoplay && a.paused) a.play().catch(()=>{});
    return;
  }
  try { a.pause(); } catch {}
  a.src = src;
  updateAudioLabels();
  if (autoplay) a.play().catch(()=>{});
}

// ——— поставить на паузу другие аудиоплееры (протокол проекта)
export function pauseOthers(except){
  document.dispatchEvent(new CustomEvent('pause-others', { detail: { except } }));
}

// ——— делегированный клик по кнопке: работаем даже если #bgAudio появится позже
if (audioBtn && !audioBtn.__boundHeaderAudio__) {
  audioBtn.__boundHeaderAudio__ = true;

  audioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const a = getBgAudio();
    const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

    if (!a) {
      // На всякий — обновим подпись и попробуем позже: как только аудио появится, следующий клик сработает
      updateAudioLabels();
      return;
    }

    if (a.paused){
      setMainAudioForLang(curLang, true);
      pauseOthers(a);
    } else {
      a.pause();
    }
  });
}

// ——— подцепляем события аудио КОГДА оно доступно
function bindAudioEventsIfNeeded() {
  const a = getBgAudio();
  if (!a || a.__headerBound__) return;
  a.__headerBound__ = true;

  ['play','playing'].forEach(ev => a.addEventListener(ev, updateAudioLabels));
  ['pause','ended','emptied','abort'].forEach(ev => a.addEventListener(ev, updateAudioLabels));

  // начальное состояние
  updateAudioLabels();
}

// Синхронизация при смене языка — обновим подпись
onLocaleChanged(() => updateAudioLabels());

// Попытки подцепиться к аудио в разумные моменты жизненного цикла
document.addEventListener('DOMContentLoaded', bindAudioEventsIfNeeded);
document.addEventListener('trus:route:rendered', bindAudioEventsIfNeeded);

// На всякий — лёгкий поллинг коротким таймером (без heavy наблюдателей)
let tries = 0;
const tick = () => {
  if (tries > 20) return; // до ~2 секунд суммарно
  tries++;
  if (!getBgAudio()) {
    setTimeout(tick, 100); 
  } else {
    bindAudioEventsIfNeeded();
  }
};
tick();

// Первичное обновление подписи
updateAudioLabels();
