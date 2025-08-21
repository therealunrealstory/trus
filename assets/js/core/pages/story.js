// assets/js/core/pages/story.js
import { $, $$ } from '../dom.js';
import { t, I18N, DEFAULT_I18N, onLocaleChanged } from '../i18n.js';
import { openModal } from '../modal.js';

let announceAudio, shortAudio;
let announceBtn, shortBtn, announceStatus, shortStatus;
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
}
function setAnnouncementForLang(l, autoplay=false){
  if (!announceAudio) return;
  const src = `audio/ANNOUNCEMENT-${l}.mp3`;
  if (announceAudio.src.endsWith(src)) {
    if (autoplay && announceAudio.paused) announceAudio.play().catch(()=>{});
    return;
  }
  announceAudio.pause();
  announceAudio.src = src;
  updateMiniLabels();
  if (autoplay) announceAudio.play().catch(()=>{});
}
function setShortForLang(l, autoplay=false){
  if (!shortAudio) return;
  const src = `audio/SHORTSTORY-${l}.mp3`;
  if (shortAudio.src.endsWith(src)) {
    if (autoplay && shortAudio.paused) shortAudio.play().catch(()=>{});
    return;
  }
  shortAudio.pause();
  shortAudio.src = src;
  updateMiniLabels();
  if (autoplay) shortAudio.play().catch(()=>{});
}

export function init(root){
  // DOM
  announceAudio  = root.querySelector('#announceAudio') || root.querySelector('[data-audio="announce"]') || null;
  shortAudio     = root.querySelector('#shortAudio')    || root.querySelector('[data-audio="short"]')    || null;

  announceBtn    = root.querySelector('#announceBtn');
  announceStatus = root.querySelector('#announceStatus');
  shortBtn       = root.querySelector('#shortBtn');
  shortStatus    = root.querySelector('#shortStatus');

  const langSel  = $('#lang');
  const curLang  = (langSel?.value || 'EN').toUpperCase();

  // ——— Защита от перезаписи переводом: только на аудиокнопки мини‑плееров ———
  [announceBtn, shortBtn].forEach(btn => btn && btn.setAttribute('data-i18n-skip',''));

  // Обработчики кликов
  if (announceBtn && announceAudio) {
    announceBtn.addEventListener('click', ()=>{
      if (announceAudio.paused){
        setAnnouncementForLang(curLang, true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: announceAudio }}));
      } else {
        announceAudio.pause();
      }
    });
    // События аудио → UI
    ['play','playing'].forEach(ev => announceAudio.addEventListener(ev, ()=>{ announceStatus && (announceStatus.textContent = label('status.playing','Playing…')); updateMiniLabels(); }));
    ['pause','ended'].forEach(ev => announceAudio.addEventListener(ev, ()=>{ announceStatus && (announceStatus.textContent = label('status.paused','Paused'));   updateMiniLabels(); }));
  }

  if (shortBtn && shortAudio) {
    shortBtn.addEventListener('click', ()=>{
      if (shortAudio.paused){
        setShortForLang(curLang, true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: shortAudio }}));
      } else {
        shortAudio.pause();
      }
    });
    // События аудио → UI
    ['play','playing'].forEach(ev => shortAudio.addEventListener(ev, ()=>{ shortStatus && (shortStatus.textContent = label('status.playing','Playing…')); updateMiniLabels(); }));
    ['pause','ended'].forEach(ev => shortAudio.addEventListener(ev, ()=>{ shortStatus && (shortStatus.textContent = label('status.paused','Paused'));   updateMiniLabels(); }));
  }

  // Реакция на смену языка (обновить тексты и подменить src при активном воспроизведении)
  unLocale = onLocaleChanged(({ detail })=>{
    const l = (detail?.lang || langSel?.value || 'EN').toUpperCase();
    if (!announceAudio?.paused) setAnnouncementForLang(l, true);
    if (!shortAudio?.paused)    setShortForLang(l, true);
    updateMiniLabels();
  });

  // Когда другие плееры стартуют — останавливаемся
  onPauseOthers = (e)=>{
    const ex = e.detail?.except;
    [announceAudio, shortAudio].forEach(a => { if (a && a !== ex && !a.paused) a.pause(); });
    updateMiniLabels();
  };
  document.addEventListener('pause-others', onPauseOthers);

  // Тайлы/модалки — оставил как есть (пример):
  root.querySelector('#tile1')?.addEventListener('click', ()=> openModal(t('tiles.me','I’m Nico'), t('modal.tile1.body','…')));
  root.querySelector('#tile2')?.addEventListener('click', ()=> openModal(t('tiles.about','About Adam'), t('modal.tile2.body','…')));
  root.querySelector('#tile3')?.addEventListener('click', ()=> openModal(t('tiles.others','Other people in the story'), t('modal.tile3.body','…')));

  // Инициализация текущим языком
  setAnnouncementForLang(curLang, false);
  setShortForLang(curLang, false);
  updateMiniLabels();
}

export function destroy(){
  try { announceAudio?.pause(); } catch {}
  try { shortAudio?.pause(); } catch {}
  document.removeEventListener('pause-others', onPauseOthers);
  if (typeof unLocale === 'function') unLocale();
  announceAudio = shortAudio = null;
  announceBtn = shortBtn = announceStatus = shortStatus = null;
  onPauseOthers = unLocale = null;
}
