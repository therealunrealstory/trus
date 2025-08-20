import { $, $$ } from '../dom.js';
import { t, I18N, DEFAULT_I18N } from '../i18n.js';
import { openModal } from '../modal.js';

let announceAudio, shortAudio;
let announceBtn, shortBtn, announceStatus, shortStatus;
let onPauseOthers;
let onLocaleChangedHandler;

function updateMiniLabels(){
  const lang = $('#lang')?.value || 'EN';
  if (announceBtn) {
    announceBtn.textContent = announceAudio.paused
      ? (I18N['announce.play'] || DEFAULT_I18N['announce.play'] || '▶︎ Play')
      : (I18N['announce.pause'] || '‖ Pause');
  }
  if (announceStatus) {
    announceStatus.textContent = (I18N['announce.langLabel'] || DEFAULT_I18N['announce.langLabel'] || 'Language: ') + lang;
  }
  if (shortBtn) {
    shortBtn.textContent = shortAudio.paused
      ? (I18N['short.play'] || DEFAULT_I18N['short.play'] || '▶︎ Play')
      : (I18N['short.pause'] || '‖ Pause');
  }
  if (shortStatus) {
    shortStatus.textContent = (I18N['short.langLabel'] || DEFAULT_I18N['short.langLabel'] || 'Language: ') + lang;
  }
}

function setAnnouncementForLang(l, autoplay=false){
  const src=`audio/ANNOUNCEMENT-${l}.mp3`;
  if (announceAudio.src.endsWith(src)) { if(autoplay && announceAudio.paused) announceAudio.play().catch(()=>{}); return; }
  announceAudio.pause(); announceAudio.src=src; updateMiniLabels();
  if(autoplay) announceAudio.play().catch(()=>{});
}
function setShortForLang(l, autoplay=false){
  const src = `audio/SHORTSTORY-${l}.mp3`;
  if (shortAudio.src.endsWith(src)) { if(autoplay && shortAudio.paused) shortAudio.play().catch(()=>{}); return; }
  shortAudio.pause(); shortAudio.src = src; updateMiniLabels();
  if(autoplay) shortAudio.play().catch(()=>{});
}

export function init(root){
  // Мини‑плееры (если есть в разметке)
  announceAudio  = root.querySelector('#announceAudio') || new Audio();
  shortAudio     = root.querySelector('#shortAudio')    || new Audio();
  announceBtn    = root.querySelector('#announceBtn');
  announceStatus = root.querySelector('#announceStatus');
  shortBtn       = root.querySelector('#shortBtn');
  shortStatus    = root.querySelector('#shortStatus');

  const langSel  = $('#lang');

  if (announceBtn) {
    announceBtn.addEventListener('click', ()=>{
      if (announceAudio.paused){
        setAnnouncementForLang(langSel?.value || 'EN', true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: announceAudio }}));
      } else { announceAudio.pause(); }
      updateMiniLabels();
    });
    announceAudio.addEventListener('ended', updateMiniLabels);
  }
  if (shortBtn) {
    shortBtn.addEventListener('click', ()=>{
      if (shortAudio.paused){
        setShortForLang(langSel?.value || 'EN', true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: shortAudio }}));
      } else { shortAudio.pause(); }
      updateMiniLabels();
    });
    shortAudio.addEventListener('ended', updateMiniLabels);
  }

  // Первичная отрисовка подписей
  updateMiniLabels();

  // >>> Новое: реагировать на смену языка без клика Play
  onLocaleChangedHandler = (e) => {
    // Не меняем поведение плееров (не автопереключаем треки), только обновляем подписи и языковую подсказку
    updateMiniLabels();
  };
  document.addEventListener('locale-changed', onLocaleChangedHandler);

  // Реакция на глобальное «pause-others»
  onPauseOthers = (e)=>{
    const ex = e.detail?.except;
    [announceAudio, shortAudio].forEach(a => { if (a && a !== ex && !a.paused) a.pause(); });
    updateMiniLabels();
  };
  document.addEventListener('pause-others', onPauseOthers);

  // Тайлы/модалки (если присутствуют)
  root.querySelector('#tile1')?.addEventListener('click', ()=> openModal(t('tiles.me','I’m Nico'), t('modal.tile1.body','…')));
  root.querySelector('#tile2')?.addEventListener('click', ()=> openModal(t('tiles.about','About Adam'), t('modal.tile2.body','…')));
  root.querySelector('#tile3')?.addEventListener('click', ()=> openModal(t('tiles.others','Other people in the story'), t('modal.tile3.body','…')));

  // Share (если есть)
  root.querySelector('#shareBtn')?.addEventListener('click', async () => {
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', $('#lang')?.value || 'EN');
      const url = u.toString();
      if (navigator.share) { await navigator.share({ title: 'The Real Unreal Story', url }); }
      else { await navigator.clipboard.writeText(url); alert((I18N && I18N['share.copied']) || 'Link copied'); }
    } catch {}
  });
}

export function destroy(){
  try { announceAudio?.pause(); } catch {}
  try { shortAudio?.pause(); } catch {}
  document.removeEventListener('pause-others', onPauseOthers);
  document.removeEventListener('locale-changed', onLocaleChangedHandler);
  announceAudio = shortAudio = null;
  announceBtn = shortBtn = announceStatus = shortStatus = null;
  onPauseOthers = onLocaleChangedHandler = null;
}
