// assets/js/core/reporting/block1.js
// Block 1 — placeholder. Дальше сюда добавим реальные графики/метрики.

let mounted = false;

export async function init(root) {
  if (mounted) return;
  mounted = true;

  // Контейнер блока 1 — это внутренняя подложка (div) у секции #rep-block1
  const host = root.querySelector('#rep-block1 > div');
  if (!host) return;

  // Локальные стили блока (оставляем якорный комментарий)
  injectStyles();

  // Пока — простая заглушка (контент уже есть в partial), здесь ничего не добавляем.
}

export function destroy() {
  mounted = false;
}

// Опционально — если блоку нужны реакции на смену языка
export async function onLocaleChanged(/*lang, root*/) {
  // Пока не требуется.
}

function injectStyles() {
  if (document.getElementById('rep-b1-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для блока храним в файлах блока*/
    /* (пока пусто — визуал берём из общих стилей и partial) */
  `;
  const style = document.createElement('style');
  style.id = 'rep-b1-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
