// assets/js/core/boot.js
import { $, $$ } from './dom.js';
import { loadLocale, getLangFromQuery, t, onLocaleChanged, applyI18nTo } from './i18n.js';
import { openModal } from './modal.js';
import { startRouter, rerenderCurrentPage } from './router.js';

// 1) Печатающийся хэштег + модалка
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
  setTimeout(step, 200); // мягкий старт, чтобы шрифты применились

  btn.addEventListener('click', () => {
    openModal(
      t('hashtag.title', '#TheRealUnrealStory'),
      t('hashtag.body', '<p>#TheRealUnrealStory</p>')
    );
  });
})();

// 2) Установка приложения (PWA)
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

// 3) Язык: загружаем ПЕРЕД запуском роутера
(async function initLangAndRouter(){
  const select = $('#lang');
  const startLang = getLangFromQuery();

  if (select) {
    for (const opt of select.options) opt.selected = (opt.value.toUpperCase() === startLang);
  }

  await loadLocale(startLang);     // подтянуть переводы и проставить <html lang/dir>

  // Смена языка пользователем
  if (select) {
    select.addEventListener('change', async (e) => {
      const L = (e.target.value || 'EN').toUpperCase();
      const u = new URL(location.href);
      u.searchParams.set('lang', L);
      history.replaceState({}, '', u);
      await loadLocale(L);       // обновить переводы
      rerenderCurrentPage();     // перерисовать текущую страницу
      applyI18nTo(document.body);// на всякий — добить шапку/модалки
    });
  }

  // Если язык меняется из кода — просто перерисуем контент
  onLocaleChanged(() => {
    rerenderCurrentPage();
    applyI18nTo(document.body);
  });

  // И только теперь — старт роутера
  startRouter();
})();
