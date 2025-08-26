// /assets/js/core/pages/now.js
// Временная заглушка: ничего не грузим и не дергаем функции.
// Оставляем тот же контейнер и те же i18n-ключи на странице.

import { $ } from '../dom.js';
import { t } from '../i18n.js';

export async function init(root) {
  const box = root.querySelector('#tgFeed');
  if (!box) return;
  // нейтральный текст через уже существующий ключ, без сетевых запросов
  box.innerHTML = `<div class="text-sm text-gray-300">${t('feed.empty','No posts yet.')}</div>`;
}

export function destroy() {
  // ничего
}
