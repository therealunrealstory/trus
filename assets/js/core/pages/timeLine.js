// assets/js/pages/timeline.js
// Контейнер, который монтирует 2 независимых блока: Legal + Medical.

import { mount as mountLegal, unmount as unmountLegal } from '../../features/legalTimeline.js';

// Медицинский блок реиспользуем из текущей страницы /pages/roadmap.js
let Roadmap = null;

let cleanup = [];

export async function init(rootEl) {
  const el = rootEl || document.querySelector('#subpage');
  if (!el) return;

  // Здесь partial уже вставлен роутером → просто находим контейнеры
  const legalRoot = el.querySelector('#legal-timeline');
  const medRoot   = el.querySelector('#medical-timeline');

  // 1) Юридическая хронология
  if (legalRoot) mountLegal(legalRoot);

  // 2) Медицинская — инициализируем существующий модуль pages/roadmap.js,
  //    но ограничиваем область рендера корнем medRoot
  if (medRoot) {
    // динамический импорт, чтобы не тянуть модуль досрочно
    const mod = Roadmap || (Roadmap = await import('./roadmap.js'));
    // roadmap.init умеет принимать "mount" — и сам отрисует внутрь него
    await mod.init(medRoot);
    cleanup.push(() => { try { mod.destroy?.(); } catch {} });
  }
}

export function destroy() {
  try { unmountLegal(); } catch {}
  cleanup.forEach(fn => { try { fn(); } catch {} });
  cleanup = [];
}
