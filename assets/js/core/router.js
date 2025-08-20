import { $, $$ } from './dom.js';
import { applyI18nTo, t } from './i18n.js';

const ROUTES = {
  story:   'partials/story.json',
  support: 'partials/support.json',
  now:     'partials/now.json'
};

const loaders = {
  story:   () => import('../pages/story.js'),
  support: () => import('../pages/support.js'),
  now:     () => import('../pages/now.js')
};

const subpageEl = $('#subpage');
const navButtons = $$('.subnav-btn');

// Проставим data-route по i18n-ключам меню
navButtons.forEach(btn => {
  const key = btn.getAttribute('data-i18n');
  if (key === 'menu.story') btn.dataset.route = 'story';
  if (key === 'menu.support') btn.dataset.route = 'support';
  if (key === 'menu.storyNow') btn.dataset.route = 'now';
});

let currentRoute = null;
let currentModule = null;
let navToken = 0; // токен для отмены устаревших загрузок

function setActiveButton(route){
  navButtons.forEach(b => {
    const on = b.dataset.route === route;
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

async function fetchContent(route){
  const url = ROUTES[route] || ROUTES.story;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load page');
  const json = await res.json();
  return json.content || '';
}

async function mount(route){
  if (!subpageEl) { console.error('No #subpage mount point'); return; }
  if (!ROUTES[route]) route = 'story';

  // Снимаем предыдущую страницу
  if (currentModule?.destroy) {
    try { currentModule.destroy(); } catch {}
  }
  currentModule = null;

  const myToken = ++navToken; // фиксируем токен текущей навигации

  setActiveButton(route);
  subpageEl.innerHTML = `<section><div class="text-sm text-gray-300">${t('page.loading','Loading…')}</div></section>`;

  try {
    const html = await fetchContent(route);
    if (myToken !== navToken) return; // пришёл устаревший ответ

    subpageEl.innerHTML = html;
    applyI18nTo(subpageEl);

    const mod = await loaders[route]();
    if (myToken !== navToken) return;

    currentModule = mod;
    mod?.init?.(subpageEl);
    currentRoute = route;
  } catch (e) {
    console.error(e);
    if (myToken !== navToken) return;
    subpageEl.innerHTML = `<section><div class="text-sm text-red-400">${t('page.error','Не удалось загрузить страницу.')}</div></section>`;
  }
}

export function startRouter(){
  // Клики по меню
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.route || 'story';
      if (location.hash !== `#${r}`) location.hash = `#${r}`;
      else mount(r);
    });
  });

  // Навигация по hash
  window.addEventListener('hashchange', () => {
    const r = (location.hash || '#story').slice(1);
    mount(r);
  });

  // Стартовый маршрут
  const start = (location.hash || '#story').slice(1);
  mount(start);
}

// Применить переводы на текущей странице ещё раз (при смене языка)
export function rerenderCurrentPage(){
  if (subpageEl) applyI18nTo(subpageEl);
}
