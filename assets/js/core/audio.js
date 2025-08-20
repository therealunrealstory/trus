// assets/js/core/audio.js
import { $ } from './dom.js';
import { I18N, DEFAULT_I18N } from './i18n.js';

const bgAudio   = $('#bgAudio');
const audioBtn  = $('#audioBtn');
const langSelect= $('#lang');

export function updateAudioLabels(){
  if (!audioBtn) return;
  audioBtn.textContent = bgAudio.paused
    ? (I18N['audio.play'] || DEFAULT_I18N['audio.play'] || 'Story in music')
    : (I18N['audio.pause'] || '‖ Pause');
}

export function setMainAudioForLang(l, autoplay=false){
  const src = `audio/ORUS-${l}.mp3`;
  // Не трогаем src без нужды; меняем только когда реально запускаем или уже играем
  if (bgAudio.src.endsWith(src)) { 
    if (autoplay && bgAudio.paused) bgAudio.play().catch(()=>{});
    return; 
  }
  bgAudio.pause();
  bgAudio.src = src;            // src задаётся только по нажатию или когда уже играет
  if (autoplay) bgAudio.play().catch(()=>{});
}

export function pauseOthers(except){
  document.dispatchEvent(new CustomEvent('pause-others', { detail: { except } }));
}

audioBtn?.addEventListener('click', ()=>{
  if (bgAudio.paused){
    setMainAudioForLang(langSelect?.value || 'EN', true);
    pauseOthers(bgAudio);       // сообщаем мини‑плеерам остановиться
  } else {
    bgAudio.pause();
  }
  updateAudioLabels();
});

export function onLocaleChanged(newLang){
  // Меняем источник только если глобальный плеер сейчас играет
  if (!bgAudio.paused) setMainAudioForLang(newLang, true);
  updateAudioLabels();
}

/* === НОВОЕ: реагируем на чужой запрос "поставить на паузу" === */
document.addEventListener('pause-others', (e)=>{
  const ex = e.detail?.except;
  if (bgAudio && !bgAudio.paused && bgAudio !== ex) {
    bgAudio.pause();
    updateAudioLabels();
  }
});
