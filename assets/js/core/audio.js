// /assets/js/core/audio.js
// Делает кнопки воспроизведения устойчивыми к i18n/перерендерам.
// Работает для #audioBtn (герой) и для любых [data-audio="toggle"].

import * as I18N from './i18n.js';

const t = (k, fb) => {
  try { return (I18N && typeof I18N.t === 'function') ? I18N.t(k) : fb; }
  catch { return fb; }
};

function findAudioFor(btn) {
  const target = btn.getAttribute('data-target');
  if (target) {
    const el = document.querySelector(target);
    if (el && el.tagName === 'AUDIO') return el;
  }
  const global = document.querySelector('#bgAudio');
  if (global) return global;
  const root = btn.closest('[data-player], .hero, .audio-player, .player') || document;
  return root.querySelector('audio');
}

function setPressed(btn, on) {
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  const label = btn.querySelector('.label');
  const text  = on ? (t('audio.pause', '‖ Pause')) : (t('audio.play', '▶︎ Play'));
  if (label) label.textContent = text;
}

function bindButton(btn) {
  if (btn.__audioBound) return;
  btn.__audioBound = true;

  btn.setAttribute('data-i18n-skip', ''); // перевод не трогает кнопку
  const audio = findAudioFor(btn);
  if (!audio) return;

  setPressed(btn, !audio.paused);

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('audio').forEach(a => { if (a !== audio && !a.paused) a.pause(); });
    if (audio.paused) audio.play().catch(()=>{});
    else audio.pause();
  });

  const onPlay    = () => setPressed(btn, true);
  const onPlaying = () => setPressed(btn, true);
  const onPause   = () => setPressed(btn, false);
  const onEnded   = () => setPressed(btn, false);

  audio.addEventListener('play', onPlay);
  audio.addEventListener('playing', onPlaying);
  audio.addEventListener('pause', onPause);
  audio.addEventListener('ended', onEnded);

  const ro = new MutationObserver(() => {
    if (!document.body.contains(btn)) {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      ro.disconnect();
    }
  });
  ro.observe(document.body, { childList: true, subtree: true });
}

function scan(scope) {
  scope = scope || document;
  const hero = scope.querySelector('#audioBtn');
  if (hero) {
    if (!hero.hasAttribute('data-target')) hero.setAttribute('data-target', '#bgAudio');
    bindButton(hero);
  }
  scope.querySelectorAll('[data-audio="toggle"]').forEach(bindButton);
}

scan(document);
document.addEventListener('trus:route:rendered', () => scan(document));
const mo = new MutationObserver(() => scan(document));
mo.observe(document.body, { childList: true, subtree: true });
