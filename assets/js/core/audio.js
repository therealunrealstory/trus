// assets/js/core/audio.js
// УСТОЙЧИВЫЙ контроллер фоновой музыки «Story in music».
// Работает даже если в DOM внезапно появляется второй экземпляр <audio>
// (из-за перерисовок/partials). Управляет ВСЕМИ экземплярами, выбирает
// активный, синхронизирует метку кнопки и реагирует на глобальное pause-others.

import { $ } from './dom.js';
import { I18N, DEFAULT_I18N, onLocaleChanged } from './i18n.js';

const audioBtn   = $('#audioBtn');
const langSelect = $('#lang');

const BGA_SELECTOR = '#bgAudio, [data-bg-audio]';
const bound = new WeakSet(); // чтобы не вешать события дважды

// ——— i18n-лейблы
function playLabel()  { return I18N['audio.play']  || DEFAULT_I18N['audio.play']  || 'Story in music'; }
function pauseLabel() { return I18N['audio.pause'] || DEFAULT_I18N['audio.pause'] || '‖ Pause'; }

// ——— Получить ВСЕ возможные bg-audio
function getBgAudios() {
  return Array.from(document.querySelectorAll(BGA_SELECTOR))
    .filter(el => el && el.tagName === 'AUDIO');
}

// ——— Выбрать «первичный» экземпляр (если играет — он главный; иначе первый)
function pickPrimary(audios) {
  if (!audios.length) return null;
  const playing = audios.find(a => !a.paused && !a.ended);
  return playing || audios[0];
}

// ——— Синхронизировать подпись кнопки по факту «играет ли кто-то»
export function updateAudioLabels(){
  if (!audioBtn) return;
  const audios = getBgAudios();
  const anyPlaying = audios.some(a => !a.paused && !a.ended);
  audioBtn.textContent = anyPlaying ? pauseLabel() : playLabel();
  audioBtn.setAttribute('aria-pressed', anyPlaying ? 'true' : 'false');
}

// ——— Подставить язык и (опционально) запустить воспроизведение на ПЕРВИЧНОМ
export function setMainAudioForLang(lang, autoplay=false){
  const audios = getBgAudios();
  if (!audios.length) { updateAudioLabels(); return; }

  const L = (lang || 'EN').toUpperCase();
  const src = `audio/ORUS-${L}.mp3`;

  const primary = pickPrimary(audios);

  // Всегда останавливаем ВСЕ, кроме primary (чтобы не было «двойной музыки»)
  audios.forEach(a => { if (a !== primary && !a.paused) { try{ a.pause(); } catch{} } });

  if (!primary) { updateAudioLabels(); return; }

  // Если уже нужный трек — просто play/pause по флагу
  if (primary.src.endsWith(src)) {
    if (autoplay && primary.paused) primary.play().catch(()=>{});
    updateAudioLabels();
    return;
  }

  try { primary.pause(); } catch {}
  primary.src = src;
  if (autoplay) primary.play().catch(()=>{});
  updateAudioLabels();
}

// ——— Поставить на паузу все фоны (для протокола pause-others)
function pauseAllBg(except=null){
  getBgAudios().forEach(a => { if (a !== except && !a.paused) { try{ a.pause(); } catch{} } });
  updateAudioLabels();
}

// ——— Навесить события на экземпляр (однократно)
function bindAudioEvents(a){
  if (!a || bound.has(a)) return;
  bound.add(a);
  ['play','playing','pause','ended','emptied','abort','stalled','suspend'].forEach(ev =>
    a.addEventListener(ev, updateAudioLabels)
  );
}

// ——— Подцепиться ко всем экземплярам, если они есть (можно вызывать многократно)
function bindAllIfNeeded(){
  getBgAudios().forEach(bindAudioEvents);
  updateAudioLabels();
}

// ——— Логика клика по кнопке (делегирование уже в boot.js не требуется — здесь достаточно прямой привязки)
if (audioBtn && !audioBtn.__headerAudioBound__) {
  audioBtn.__headerAudioBound__ = true;

  audioBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const audios = getBgAudios();

    // Если вообще нет <audio> — просто обновим подпись, а появится — следующие клики сработают
    if (!audios.length) { updateAudioLabels(); return; }

    const primary = pickPrimary(audios);
    const curLang = (langSelect?.value || document.documentElement.getAttribute('lang') || 'EN').toUpperCase();

    // Если «кто-то» уже играет — ставим ВСЁ на паузу (надёжный «toggle off»)
    if (audios.some(a => !a.paused && !a.ended)) {
      pauseAllBg();
      return;
    }

    // Иначе — запускаем трек текущего языка на primary
    setMainAudioForLang(curLang, true);
    // и аккуратно глушим все остальные (на случай внезапной инициализации второго)
    pauseAllBg(pickPrimary(getBgAudios()));
  });
}

// ——— Реакция на смену языка: если сейчас что-то играет — подменим источник и продолжим; если тишина — просто подпись
onLocaleChanged(({ lang }) => {
  const anyPlaying = getBgAudios().some(a => !a.paused && !a.ended);
  setMainAudioForLang(lang || (langSelect?.value || 'EN'), anyPlaying);
  updateAudioLabels();
});

// ——— Глобальный протокол (когда мини-плееры запускаются, фоновую музыку ставим на паузу)
document.addEventListener('pause-others', (e) => {
  const ex = e.detail?.except || null;
  pauseAllBg(ex);
});

// ——— Подключаемся в разумные моменты жизненного цикла: когда DOM готов, когда страница перерисована
document.addEventListener('DOMContentLoaded', bindAllIfNeeded);
document.addEventListener('trus:route:rendered', bindAllIfNeeded);

// ——— На всякий — короткий «мягкий» тикер старта: если аудио вставят с задержкой, мы его подхватим
let tries = 0;
(function tick(){
  if (tries++ > 20) return; // ~2 секунды максимум
  if (!getBgAudios().length) {
    setTimeout(tick, 100);
  } else {
    bindAllIfNeeded();
  }
})();

// ——— Первичная синхронизация метки
updateAudioLabels();
