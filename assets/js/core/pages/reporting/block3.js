// assets/js/core/reporting/block3.js
// Block 3 — рабочее имя: "Expense reports" / "Расходы и пояснения" (пока заглушка)

let mounted = false;

export async function init(root) {
  if (mounted) return;
  mounted = true;

  const host = root.querySelector('#rep-block3 > div');
  if (!host) return;

  injectStyles();

  // Заглушка — контент задаётся в partial, тут пока ничего не добавляем
}

export function destroy() {
  mounted = false;
}

export async function onLocaleChanged(/*lang, root*/) {}

function injectStyles() {
  if (document.getElementById('rep-b3-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для блока храним в файлах блока*/
  `;
  const style = document.createElement('style');
  style.id = 'rep-b3-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
