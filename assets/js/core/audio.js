// assets/js/core/audio.js
import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';

const bgAudio   = $('#bgAudio');
const audioBtn  = $('#audioBtn');
const langSelect= $('#lang');

function playLabel()  { return I18N['audio.play']  || DEFAULT_I18N['audio.play']  || 'Story in music'; }
function pauseLabel() { return I18N['audio.pause'] || DEFAULT_I18N['audio.pause'] || '‖ Pause'; }

export function updateAudioLabels(){
  if (!audioBtn) return;
  audioBtn.textContent = (bgAudio && !bgAudio.paused) ? pauseLabel() : playLabel();
}

export function setMainAudioForLang(l, autoplay=false){
  if (!bgAudio) return;
  const L = (l || 'EN').toUpperCase();
  const src = `audio/ORUS-${L}.mp3`;
  if (bgAudio.src.endsWith(src)) {
    if (autoplay && bgAudio.paused) bgAudio.play().catch(()=>{});
    return;
  }
  try { bgAudio.pause(); } catch {}
  bgAudio.src = src;
  updateAudioLabels();
  if (autoplay) bgAudio.play().catch(()=>{});
}

export function pauseOthers(except){
  document.dispatchEvent(new CustomEvent('pause-others', { detail: { except } }));
}

audioBtn?.addEventListener('click', (e)=>{
  e.preventDefault();
  const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();
  if (bgAudio.paused){
    setMainAudioForLang(curLang, true);
    pauseOthers(bgAudio);
  } else {
    bgAudio.pause();
  }
});

// reflect audio state to label
if (bgAudio) {
  ['play','playing'].forEach(ev => bgAudio.addEventListener(ev, updateAudioLabels));
  ['pause','ended','emptied','abort'].forEach(ev => bgAudio.addEventListener(ev, updateAudioLabels));
}

// update label when locale changes
onLocaleChanged(() => updateAudioLabels());

// initial label
updateAudioLabels();
