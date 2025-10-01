// assets/app.js
// Одна точка входа: вся инициализация — в core/boot.js
import './js/core/boot.js';

// Обработка кнопки музыки

// Обработка кнопки музыки
import { getMusicLink } from './js/core/musicLinks.js';
// ⬇️ В i18n есть getLangFromQuery и onLocaleChanged — их и используем
import { getLangFromQuery, onLocaleChanged } from './js/core/i18n.js';

function applyMusicLink() {
  const a = document.querySelector('#musicLink');
  if (!a) return;
  // getLangFromQuery() уже возвращает код в верхнем регистре (EN, ES, …)
  a.href = getMusicLink(getLangFromQuery());
}

// 1) Установить ссылку при загрузке
document.addEventListener('DOMContentLoaded', applyMusicLink);

// 2) Обновлять при смене языка
onLocaleChanged(() => applyMusicLink());

// ⬇️ Новое: строка с WhatsApp после «Nico»
import './js/core/authorContact.js';
