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
// Hashtag + modal
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
// Header music (#audioBtn ↔ #bgAudio)
(function initHeaderMusic() {
  const btn = $('#audioBtn');
  const audio = $('#bgAudio');
  const langSelect = $('#lang');
  if (!btn || !audio) return;
  if (onceFlag(btn, 'headerAudioBound')) return;

  const setPressed = (on) => btn.setAttribute('aria-pressed', on ? 'true' : 'false');

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const L = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();
    if (audio.paused) {
      setMainAudioForLang(L, true);
      document.dispatchEvent(new CustomEvent('pause-others', { detail: { except: audio }}));
    } else {
      audio.pause();
    }
  });

  ['play','playing'].forEach(ev => audio.addEventListener(ev, () => { setPressed(true); updateAudioLabels(); }));
  ['pause','ended'].forEach(ev => audio.addEventListener(ev, () => { setPressed(false); updateAudioLabels(); }));

  setPressed(!audio.paused);
  updateAudioLabels();

  onLocaleChanged(() => updateAudioLabels());
})();

// —————————————————————————————————————————————
// Share button (delegated)
(function initShareDelegated() {
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('#shareBtn, [data-share]');
    if (!btn) return;
    e.preventDefault();
    const shareData = {
      title: t('share.title', 'The Real Unreal Story'),
      text:  t('share.text',  'Support Adam’s journey'),
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
// PWA Install
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
// Language + router (load locale FIRST)
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
