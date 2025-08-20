import { $, $$ } from './dom.js';
import { loadLocale, getLangFromQuery, t } from './i18n.js';
import { openModal } from './modal.js';
import { updateAudioLabels, setMainAudioForLang, onLocaleChanged } from './audio.js';
import { startRouter, rerenderCurrentPage } from './router.js';

// Анимация хештега + модалка
(function initHashtag() {
  const el = $('#hashtagType'); const btn = $('#hashtagBtn');
  if (!el || !btn) return;
  const TEXT = '#TheRealUnrealStory'; let i = 0, dir = 1;
  const typeDelay = 90, eraseDelay = 45, pause = 900;
  (function step(){
    el.textContent = TEXT.slice(0, i);
    if (dir > 0) { if (i < TEXT.length) { i++; setTimeout(step, typeDelay); } else { setTimeout(()=>{dir=-1; step();}, pause); } }
    else { if (i > 0) { i--; setTimeout(step, eraseDelay); } else { setTimeout(()=>{dir=1; step();}, pause); } }
  })();
  btn.addEventListener('click', () => openModal(
    t('hashtag.title', '#TheRealUnrealStory'),
    t('hashtag.body', `Thank you for using <b>#TheRealUnrealStory</b>…`)
  ));
})();

// PWA install
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn')?.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => $('#installBtn')?.classList.add('hidden'));
if (window.matchMedia?.('(display-mode: standalone)').matches) $('#installBtn')?.classList.add('hidden');
$('#installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice; deferredPrompt = null;
});

// Язык
const langSelect = $('#lang');

(async function boot(){
  const fromQuery = getLangFromQuery();
  const initialLang = fromQuery || localStorage.getItem('site_lang') || 'EN';
  if (langSelect) { langSelect.value = initialLang; }
  localStorage.setItem('site_lang', initialLang);

  await loadLocale(initialLang);
  updateAudioLabels();

  if (fromQuery) {
    const u = new URL(location.href); u.searchParams.delete('lang'); history.replaceState({}, '', u);
  }

  langSelect?.addEventListener('change', async e => {
    const l = e.target.value;
    localStorage.setItem('site_lang', l);
    const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState({}, '', u);
    await loadLocale(l);
    onLocaleChanged(l);
    rerenderCurrentPage();
  });

  // Стартуем роутер
  startRouter();
})();
