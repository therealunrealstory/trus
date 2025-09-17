// assets/js/core/boot.js
import { $, $$ } from './dom.js';
import { loadLocale, getLangFromQuery, t, onLocaleChanged, applyI18nTo } from './i18n.js';
import { openModal } from './modal.js';
import { startRouter, rerenderCurrentPage } from './router.js';
import { updateAudioLabels, setMainAudioForLang } from './audio.js';

// —————————————————————————————————————————————
// Helpers
function onceFlag(el, flag) {
  if (!el) return false;
  const k = `__${flag}__`;
  if (el[k]) return true;
  el[k] = true;
  return false;
}

// —————————————————————————————————————————————
// 1) Хэштег + модалка
(function initHashtag() {
  const el = $('#hashtagType');
  const btn = $('#hashtagBtn');
  if (!el || !btn) return;

  const TEXT = '#TheRealUnrealStory';
  let i = 0, dir = 1;
  const typeDelay = 90, eraseDelay = 45, pause = 900;

  function step() {
    el.textContent = TEXT.slice(0, i);
    if (dir > 0) {
      if (i < TEXT.length) { i++; setTimeout(step, typeDelay); }
      else { setTimeout(()=>{ dir = -1; step(); }, pause); }
    } else {
      if (i > 0) { i--; setTimeout(step, eraseDelay); }
      else { setTimeout(()=>{ dir = 1; step(); }, pause); }
    }
  }
  setTimeout(step, 200);

  if (!onceFlag(btn, 'hashtagModal')) {
    btn.addEventListener('click', () => {
      openModal(
        t('hashtag.title', '#TheRealUnrealStory'),
        t('hashtag.body', '<p>#TheRealUnrealStory</p>')
      );
    });
  }
})();

// —————————————————————————————————————————————
// 2) Музыка в шапке — делегированный клик (работает даже без #bgAudio в момент старта)
//(function initHeaderMusicDelegated() {
//  if (document.__headerMusicDelegated__) return;
//  document.__headerMusicDelegated__ = true;

 // document.addEventListener('click', (e) => {
  //   const btn = e.target.closest('#audioBtn');
  //   if (!btn) return;
  //   e.preventDefault();

  //   const L = ( $('#lang')?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

    // setMainAudioForLang сама ничего не сломает, если аудио пока отсутствует
    // а как только аудио будет в DOM — src подставится и воспроизведение начнётся
  //   const hadAudio = !!document.getElementById('bgAudio');
  //   setMainAudioForLang(L, true);
  //   updateAudioLabels();

    // Если аудио уже было — «пауза/плей» обработается внутри setMainAudioForLang
    // (Если не было — просто ждём появления элемента; обработчики привяжет audio.js)
 //  }, false);

  // При смене языка обновим подписи кнопки
 //  onLocaleChanged(() => updateAudioLabels());
 //})();

// —————————————————————————————————————————————
// 3) Share — уже работал, оставляем делегированно
(function initShareDelegated() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#shareBtn, [data-share]');
    if (!btn) return;
    e.preventDefault();
    const shareData = {
      title: t('share.title', 'The Real Unreal Story'),
	  text: t('share.text', 'Read and share the story'),
      url:   location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        const orig = btn.textContent;
        btn.textContent = t('share.copied', 'Copied!');
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    } catch {}
  });
})();

// —————————————————————————————————————————————
// 4) PWA Install (как было)
(function initInstall() {
  const btn = $('#installBtn');
  if (!btn) return;

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => btn.classList.add('hidden'));
  if (window.matchMedia?.('(display-mode: standalone)').matches) btn.classList.add('hidden');

  btn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try { await deferredPrompt.userChoice; } catch {}
    deferredPrompt = null;
    btn.classList.add('hidden');
  });
})();

// —————————————————————————————————————————————
// 5) Язык + роутер (загружаем локаль ПЕРЕД стартом)
(async function initLangAndRouter(){
  const select = $('#lang');
  const startLang = getLangFromQuery();

  if (select) {
    for (const opt of select.options) opt.selected = (opt.value.toUpperCase() === startLang);
  }

  await loadLocale(startLang);

  if (select) {
    select.addEventListener('change', async (e) => {
      const L = (e.target.value || 'EN').toUpperCase();
      const u = new URL(location.href);
      u.searchParams.set('lang', L);
      history.replaceState({}, '', u);
      await loadLocale(L);
      rerenderCurrentPage();
      applyI18nTo(document.body);
      updateAudioLabels();
    });
  }

  onLocaleChanged(() => {
    rerenderCurrentPage();
    applyI18nTo(document.body);
    updateAudioLabels();
  });

  startRouter();
})();
