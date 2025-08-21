// /assets/js/features/header-bridge.js
// Идемпотентная инициализация всего, что живёт вне #subpage:
// - глобальная кнопка музыки (#audioBtn ↔ #bgAudio)
// - «печатающийся» хэштег (если есть элемент [data-hashtag-typer])
// - модалки с атрибутами data-open-modal / data-close-modal / data-modal
// - повторный прогон i18n по body, чтобы не было "..." в модалках.
//
// Код не меняет контент, только вешает обработчики. Можно подключать хоть 10 раз — всё ок.

import * as I18N from '../core/i18n.js';

function onceFlag(el, flag) {
  const k = `__${flag}__`;
  if (el[k]) return true;
  el[k] = true;
  return false;
}

// ——— Музыка (глобальная кнопка в шапке) ———
function initMusic(root = document) {
  const btn = root.querySelector('#audioBtn');
  const audio = document.querySelector('#bgAudio');
  if (!btn || !audio) return;

  if (onceFlag(btn, 'boundAudio')) return;

  const setPressed = (on) => {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
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
}

// ——— Хэштег (печатающийся) ———
// Если у тебя уже есть свой скрипт на этот эффект — он просто ничего не сломает.
// Здесь безопасный дефолт: печатает текст из data-text, если он ещё не напечатан.
function initHashtagTyper(root = document) {
  const el = root.querySelector('[data-hashtag-typer]');
  if (!el || onceFlag(el, 'typerBound')) return;

  const full = el.getAttribute('data-text') || el.textContent || '';
  const speed = +(el.getAttribute('data-speed') || 40);

  // Если уже напечатано — ничего не делаем
  if (el.getAttribute('data-typed') === '1') return;

  el.textContent = '';
  let i = 0;
  function tick() {
    if (i < full.length) {
      el.textContent += full[i++];
      requestAnimationFrame(tick);
    } else {
      el.setAttribute('data-typed', '1');
    }
  }
  // Стартуем чуть позже, чтобы шрифт применился
  setTimeout(() => requestAnimationFrame(tick), 60);
}

// ——— Модалки (универсальная связка) ———
// Открыть:  [data-open-modal="#idМодалки"]
// Закрыть:  [data-close-modal] внутри модалки или кликом по overlay.
// Корень модалки: [data-modal] или элемент с id, указанный в data-open-modal.
function initModals(root = document) {
  // Кнопки открытия
  root.querySelectorAll('[data-open-modal]').forEach(btn => {
    if (onceFlag(btn, 'modalOpenBound')) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const sel = btn.getAttribute('data-open-modal');
      if (!sel) return;
      const modal = document.querySelector(sel);
      if (!modal) return;
      openModal(modal);
    });
  });

  // Кнопки закрытия
  root.querySelectorAll('[data-modal] [data-close-modal]').forEach(btn => {
    if (onceFlag(btn, 'modalCloseBound')) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = btn.closest('[data-modal]');
      if (modal) closeModal(modal);
    });
  });

  // Клик по оверлею
  root.querySelectorAll('[data-modal]').forEach(modal => {
    if (onceFlag(modal, 'overlayBound')) return;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  });
}

function openModal(modal) {
  modal.setAttribute('aria-hidden', 'false');
  modal.classList.add('open');
  // На случай, если контент модалки вставлен заранее, но не переведён — прогоняем i18n
  try { I18N.applyI18nTo ? I18N.applyI18nTo(modal) : null; } catch {}
}
function closeModal(modal) {
  modal.setAttribute('aria-hidden', 'true');
  modal.classList.remove('open');
}

// ——— i18n: добиваем «…» в модалках и шапке ———
function applyTranslationsToBody() {
  try {
    if (typeof I18N.applyI18nTo       === 'function') return I18N.applyI18nTo(document.body);
    if (typeof I18N.applyTranslations === 'function') return I18N.applyTranslations(document.body);
    if (typeof I18N.translateNode     === 'function') return I18N.translateNode(document.body);
    if (typeof I18N.apply             === 'function') return I18N.apply(document.body);
    if (typeof I18N.refresh           === 'function') return I18N.refresh(document.body);
  } catch {}
}

// ——— Общий init ———
function initHeaderBridge() {
  initMusic(document);
  initHashtagTyper(document);
  initModals(document);
  applyTranslationsToBody(); // важный шаг: добиваем перевод в шапке/модалках
}

// Срабатывает:
document.addEventListener('DOMContentLoaded', initHeaderBridge);
document.addEventListener('trus:route:rendered', initHeaderBridge);
document.addEventListener('trus:locale:changed', initHeaderBridge);
