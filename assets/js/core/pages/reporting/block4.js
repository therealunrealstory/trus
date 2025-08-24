// assets/js/core/reporting/block4.js
// Block 4 — "Документы (медицинские и юридические)" (пока заглушка)

let mounted = false;

export async function init(root) {
  if (mounted) return;
  mounted = true;

  const host = root.querySelector('#rep-block4 > div');
  if (!host) return;

  injectStyles();

  // Заглушка — контент задаётся в partial, тут пока ничего не добавляем
}

export function destroy() {
  mounted = false;
}

export async function onLocaleChanged(/*lang, root*/) {}

function injectStyles() {
  if (document.getElementById('rep-b4-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для блока храним в файлах блока*/
  `;
  const style = document.createElement('style');
  style.id = 'rep-b4-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
