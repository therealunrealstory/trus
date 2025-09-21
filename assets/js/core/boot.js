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
// 2) Музыка в шапке — делегированный клик
(function initHeaderMusicDelegated() {
  if (document.__headerMusicDelegated__) return;
  document.__headerMusicDelegated__ = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('#audioBtn');
    if (!btn) return;
    e.preventDefault();

    const L = ($('#lang')?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();
    setMainAudioForLang(L, true);
    updateAudioLabels();
  }, false);

  onLocaleChanged(() => updateAudioLabels());
})();


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
// Story Now: hero-image before "The story continues now"
(function injectStoryNowHero(){
  const HERO_URL = 'https://archive.org/download/orus-pics/storynow.jpg';
  const FLAG = '__storyNowHeroMounted__';

  function findAnchor(root){
    // 1) пытаемся найти секцию по data-i18n ключам заголовков (если есть)
    const byKey = root.querySelector(
      'h1[data-i18n*="now"], h2[data-i18n*="now"], h3[data-i18n*="now"], [role="heading"][data-i18n*="now"]'
    );
    if (byKey) return byKey.closest('section') || byKey;

    // 2) fallback: ищем заголовок по видимому тексту (ENG; регистронезависимо)
    const headings = root.querySelectorAll('h1,h2,h3,[role="heading"]');
    for (const h of headings) {
      const txt = (h.textContent || '').trim().toLowerCase();
      if (txt.includes('the story continues now')) return h.closest('section') || h;
    }

    // 3) если не нашли — ставим в самый верх страницы
    return root.firstElementChild;
  }

  function mount(){
    // рендерим только на маршруте "now"
    if (document.documentElement.getAttribute('data-route') !== 'now') return;
    const host = document.getElementById('subpage');
    if (!host || host[FLAG]) return;

    const img = new Image();
    img.src = HERO_URL;
    img.alt = 'The Story Now — photo';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.className = 'storynow-hero';

    const anchor = findAnchor(host) || host.firstChild;
    if (anchor && anchor.parentNode) {
      anchor.parentNode.insertBefore(img, anchor);
      host[FLAG] = true;
    }
  }

  // Вставляем после рендера страницы и при смене языка
  const sub = document.getElementById('subpage');
  if (sub) {
    new MutationObserver(() => mount()).observe(sub, { childList: true });
  }
  document.addEventListener('DOMContentLoaded', mount);

  // при смене языка страница перерендеривается — повторим вставку
  import('./i18n.js').then(({ onLocaleChanged }) => {
    onLocaleChanged(() => {
      const host = document.getElementById('subpage');
      if (host) host[FLAG] = false;
      mount();
    });
  }).catch(()=>{});
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
