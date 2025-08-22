// assets/app.js
// Одна точка входа: вся инициализация — в core/boot.js
import './js/core/boot.js';

// Обработка кнопки музыки
import { getMusicLink } from './js/core/musicLinks.js';
import { getLocale, onLocaleChanged } from './js/core/i18n.js';
function applyMusicLink() {
  const a = document.querySelector('#musicLink');
  if (!a) return;
  a.href = getMusicLink(getLocale());
}

// 1) Установить ссылку при загрузке
document.addEventListener('DOMContentLoaded', applyMusicLink);

// 2) Обновлять при смене языка
onLocaleChanged(() => applyMusicLink());

// (опционально) Если у тебя где-то руками меняется <select id="lang"> вне i18n,
// i18n всё равно диспатчит событие, так что onLocaleChanged поймает.
