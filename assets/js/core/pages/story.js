import { $, $$ } from '../core/dom.js';
import { t, I18N, DEFAULT_I18N } from '../core/i18n.js';
import { openModal } from '../core/modal.js';

// Локальные ссылки и состояния страницы Story
let announceAudio, shortAudio;
let announceBtn, shortBtn, announceStatus, shortStatus;
let onPauseOthers;

function updateMiniLabels(langSel){
  const lang = langSel?.value || $('#lang')?.value || 'EN';
  if (announceBtn) announceBtn.textContent = announceAudio.paused ? (I18N['announce.play'] || DEFAULT_I18N['announce.play'] || '▶︎ Play') : (I18N['announce.pause'] || '‖ Pause');
  if (announceStatus) announceStatus.textContent = (I18N['announce.langLabel'] || DEFAULT_I18N['announce.langLabel'] || 'Language: ') + lang;
  if (shortBtn) shortBtn.textContent = shortAudio.paused ? (I18N['short.play'] || DEFAULT_I18N['short.play'] || '▶︎ Play') : (I18N['short.pause'] || '‖ Pause');
  if (shortStatus) shortStatus.textContent = (I18N['short.langLabel'] || DEFAULT_I18N['short.langLabel'] || 'Language: ') + lang;
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
  // Мини‑плееры
  announceAudio = root.querySelector('#announceAudio') || new Audio();
  shortAudio    = root.querySelector('#shortAudio')    || new Audio();
  announceBtn    = root.querySelector('#announceBtn');
  announceStatus = root.querySelector('#announceStatus');
  shortBtn       = root.querySelector('#shortBtn');
  shortStatus    = root.querySelector('#shortStatus');

  const langSel  = $('#lang');

  if (announceBtn) {
    announceBtn.addEventListener('click', async ()=>{
      if (announceAudio.paused){
        setAnnouncementForLang(langSel.value, true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: announceAudio }}));
      } else { announceAudio.pause(); }
      updateMiniLabels(langSel);
    });
    announceAudio.addEventListener('ended', ()=> updateMiniLabels(langSel));
  }
  if (shortBtn) {
    shortBtn.addEventListener('click', async ()=>{
      if (shortAudio.paused){
        setShortForLang(langSel.value, true);
        document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: shortAudio }}));
      } else { shortAudio.pause(); }
      updateMiniLabels(langSel);
    });
    shortAudio.addEventListener('ended', ()=> updateMiniLabels(langSel));
  }
  updateMiniLabels(langSel);

  // Обработчик глобального «pause-others»
  onPauseOthers = (e)=>{
    const ex = e.detail?.except;
    [announceAudio, shortAudio].forEach(a => { if (a && a !== ex && !a.paused) a.pause(); });
    updateMiniLabels(langSel);
  };
  document.addEventListener('pause-others', onPauseOthers);

  // Тайлы/модалки
  root.querySelector('#tile1')?.addEventListener('click', ()=> openModal(t('tiles.me','I’m Nico'), t('modal.tile1.body','…')));
  root.querySelector('#tile2')?.addEventListener('click', ()=> openModal(t('tiles.about','About Adam'), t('modal.tile2.body','…')));
  root.querySelector('#tile3')?.addEventListener('click', ()=> openModal(t('tiles.others','Other people in the story'), t('modal.tile3.body','…')));

  // Share
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
  announceAudio = shortAudio = null;
  announceBtn = shortBtn = announceStatus = shortStatus = null;
}
