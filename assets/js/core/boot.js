// assets/js/core/boot.js
import { $, $$ } from './dom.js';
import { loadLocale, getLangFromQuery, t, onLocaleChanged, applyI18nTo } from './i18n.js';
import { openModal } from './modal.js';
import { startRouter, rerenderCurrentPage } from './router.js';

// —————————————————————————————————————————————
// УТИЛИТЫ
function onceFlag(el, flag) {
  if (!el) return false;
  const k = `__${flag}__`;
  if (el[k]) return true;
  el[k] = true;
  return false;
}

// —————————————————————————————————————————————
// 1) ХЭШТЕГ + МОДАЛКА
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
// 2) КНОПКА МУЗЫКИ В ШАПКЕ (#audioBtn ↔ #bgAudio)
(function initHeaderMusic() {
  const btn = $('#audioBtn');
  const audio = $('#bgAudio');
  if (!btn || !audio) return;
  if (onceFlag(btn, 'headerAudioBound')) return;

  // Чтобы i18n не перетирал содержимое кнопки
  btn.setAttribute('data-i18n-skip', '');

  const setPressed = (on) => btn.setAttribute('aria-pressed', on ? 'true' : 'false');

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
  });

  audio.addEventListener('play',    () => setPressed(true));
  audio.addEventListener('playing', () => setPressed(true));
  audio.addEventListener('pause',   () => setPressed(false));
  audio.addEventListener('ended',   () => setPressed(false));

  // начальное состояние
  setPressed(!audio.paused);
})();

// —————————————————————————————————————————————
// 3) КНОПКА «ПОДЕЛИТЬСЯ» В HERO (#shareBtn или [data-share])
(function initShare() {
  const btn = $('#shareBtn') || document.querySelector('[data-share]');
  if (!btn) return;
  if (onceFlag(btn, 'shareBound')) return;

  btn.addEventListener('click', async (e) => {
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
    } catch {
      // пользователь отменил — просто молчим
    }
  });
})();

// —————————————————————————————————————————————
// 4) УСТАНОВКА PWA (как было)
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
// 5) ЯЗЫК — ЗАГРУЗИТЬ ДО СТАРТА РОУТЕРА
(async function initLangAndRouter(){
  const select = $('#lang');
  const startLang = getLangFromQuery();

  if (select) {
    for (const opt of select.options) opt.selected = (opt.value.toUpperCase() === startLang);
  }

  await loadLocale(startLang);     // подтянуть переводы, обновить <html lang/dir>

  // смена языка пользователем
  if (select) {
    select.addEventListener('change', async (e) => {
      const L = (e.target.value || 'EN').toUpperCase();
      const u = new URL(location.href);
      u.searchParams.set('lang', L);
      history.replaceState({}, '', u);
      await loadLocale(L);
      rerenderCurrentPage();        // перерисовать контент подстраницы
      applyI18nTo(document.body);   // и шапку/модалки
    });
  }

  // если язык меняется из кода — подстраиваем всё
  onLocaleChanged(() => {
    rerenderCurrentPage();
    applyI18nTo(document.body);
  });

  // последний шаг — старт роутера
  startRouter();
})();
