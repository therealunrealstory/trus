// assets/js/core/reporting/block2.js
// Block 2 — "История кампаний по сбору средств" (минимальная инициализация; наполним на Этапе 1b)

let mounted = false;

export async function init(root) {
  if (mounted) return;
  mounted = true;

  const host = root.querySelector('#rep-block2 > div');
  if (!host) return;

  injectStyles();

  // Лёгкий placeholder, чтобы видеть, что блок инициализировался
  // (на Этапе 1b заменим на реальную загрузку /data/fundraising_history.json)
  // host.insertAdjacentHTML('beforeend', `<div class="rep-b2 muted">Loading fundraising history…</div>`);
}

export function destroy() {
  mounted = false;
}

export async function onLocaleChanged(/*lang, root*/) {
  // На 1a ничего не делаем.
}

function injectStyles() {
  if (document.getElementById('rep-b2-styles')) return;
  const css = `
    /*Тут будут стили для именно этого блока - такое правило, стили для блока храним в файлах блока*/
    .rep-b2 .muted { opacity:.75; font-size:.95rem; }
  `;
  const style = document.createElement('style');
  style.id = 'rep-b2-styles';
  style.textContent = css;
  document.head.appendChild(style);
}
