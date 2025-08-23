// assets/js/core/pages/timeline.js
import { mount as mountLegal, unmount as unmountLegal } from '../../features/legalTimeline.js';

let Roadmap = null;
let cleanup = [];

async function loadPartial(name) {
  // грузим partial ОТНОСИТЕЛЬНО (без ведущего /)
  const res = await fetch(`partials/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load partial: ${name}`);
  const json = await res.json();
  const html = json.html ?? json.markup ?? json.content ?? json.innerHTML ?? '';
  return String(html);
}

export async function init(rootEl) {
  const el = rootEl || document.querySelector('#subpage');
  if (!el) return;

  const legalRoot = el.querySelector('#legal-timeline');
  const medRoot   = el.querySelector('#medical-timeline');

  // 1) Юридическая
  if (legalRoot) mountLegal(legalRoot);

  // 2) Медицинская — подсуним её собственный partial прямо в контейнер
  if (medRoot) {
    try {
      // ВАЖНО: подгружаем partial/roadmap и вставляем внутрь #medical-timeline
      const roadmapHtml = await loadPartial('roadmap');
      medRoot.innerHTML = roadmapHtml;

      // Теперь инициализируем модуль страницы Roadmap поверх вставленной разметки
      const mod = Roadmap || (Roadmap = await import('./roadmap.js'));
      await mod.init(medRoot);

      cleanup.push(() => { try { mod.destroy?.(); } catch {} });
    } catch (e) {
      // На всякий случай покажем что-то осмысленное
      medRoot.innerHTML = '<div class="mtl-error">Failed to load medical timeline.</div>';
      // eslint-disable-next-line no-console
      console.error('[timeline] medical block failed:', e);
    }
  }
}

export function destroy() {
  try { unmountLegal(); } catch {}
  cleanup.forEach(fn => { try { fn(); } catch {} });
  cleanup = [];
}
