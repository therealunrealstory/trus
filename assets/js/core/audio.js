import { $ } from './dom.js';
import { I18N, DEFAULT_I18N } from './i18n.js';

const bgAudio  = $('#bgAudio');
const audioBtn = $('#audioBtn');
const langSelect = $('#lang');

export function updateAudioLabels(){
  if (audioBtn) audioBtn.textContent = bgAudio.paused
    ? (I18N['audio.play'] || DEFAULT_I18N['audio.play'] || 'Story in music')
    : (I18N['audio.pause'] || '‖ Pause');
}

export function setMainAudioForLang(l, autoplay=false){
  const src = `audio/ORUS-${l}.mp3`;
  if (bgAudio.src.endsWith(src)) { if (autoplay && bgAudio.paused) bgAudio.play().catch(()=>{}); return; }
  bgAudio.pause();
  bgAudio.src = src;
  if (autoplay) bgAudio.play().catch(()=>{});
}

export function pauseOthers(except){
  // Глобальный плеер узнаёт про локальные через кастомное событие
  document.dispatchEvent(new CustomEvent('pause-others', { detail: { except } }));
}

audioBtn?.addEventListener('click', async ()=>{
  if (bgAudio.paused){
    setMainAudioForLang(langSelect.value, true);
    pauseOthers(bgAudio);
  } else {
    bgAudio.pause();
  }
  updateAudioLabels();
});

// Обновление источника при смене языка (если играет)
export function onLocaleChanged(newLang){
  if (!bgAudio.paused) setMainAudioForLang(newLang, true);
  updateAudioLabels();
}
