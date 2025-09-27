// /assets/js/core/pages/trustfields.js
// Страница TrustFields: intro → video+text → social+gallery (9:16)

import { $, $$ } from '../dom.js';
import { I18N, onLocaleChanged, getLangFromQuery, applyI18nTo } from '../i18n.js';

/* ---------------- i18n загрузка локали страницы ---------------- */
async function loadTrustLocale(lang) {
  const L = (lang || 'EN').toUpperCase();
  async function fetchJson(u) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      return r.ok ? r.json() : null;
    } catch {
      return null;
    }
  }
  let data = await fetchJson(`/TrustFields/i18n/${L}.json`);
  if (!data && L !== 'EN') data = await fetchJson(`/TrustFields/i18n/EN.json`);
  if (!data) data = {};
  // мягкий merge в общий словарь
  for (const k in data) I18N[k] = data[k];
}

/* ---------------- utils ---------------- */
const rand = (min, max, step = 1) => {
  const n = Math.floor((max - min) / step);
  return min + step * Math.floor(Math.random() * (n + 1));
};

async function readJson(url) {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/* ---------------- Медиа-реестры ---------------- */
async function loadMedia() {
  const [videos, images] = await Promise.all([
    readJson('/trustfields/media/videos.json'),
    readJson('/trustfields/media/images.json'),
  ]);
  return { videos: videos || {}, images: images || {} };
}

// Без HEAD/GET-пробежек (CORS). Строим пул URL.
function buildImagePool(imagesCfg) {
  if (imagesCfg?.byIndex && Object.keys(imagesCfg.byIndex).length) {
    return Object.values(imagesCfg.byIndex);
  }
  const base = imagesCfg?.baseUrl || '';
  const min = Number(imagesCfg?.min ?? 1);
  const max = Number(imagesCfg?.max ?? 99);
  const list = [];
  if (base) {
    for (let i = min; i <= max; i++) list.push(`${base}${i}.jpg`);
  }
  return list;
}

/* ---------------- Разметка ---------------- */
function htmlSocialBlock() {
  return `
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <a class="icon-btn social-btn" href="https://www.youtube.com/playlist?list=PLzFyHZzMAvNkpOYCVvG4oqqhQUy8JXPHa" target="_blank" rel="noopener" aria-label="YouTube">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .6 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.3.6 9.3.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.6-5.8zM9.6 15.5v-7l6.2 3.5-6.2 3.5z"/></svg>
      </a>
      <a class="icon-btn social-btn" href="https://www.instagram.com/therealunrealstorysupes/" target="_blank" rel="noopener" aria-label="Instagram">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2A2.8 2.8 0 1 0 12 15.8 2.8 2.8 0 0 0 12 9.2zm4.8-2.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></svg>
      </a>
      <a class="icon-btn social-btn" href="https://www.tiktok.com/@therealunrealstorysupes" target="_blank" rel="noopener" aria-label="TikTok">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.2 1.6 1.1 3 2.4 3.9 1.3 1 2.9 1.5 4.5 1.5v3.6c-1.8-.1-3.5-.7-5-1.7v6.9a6.5 6.5 0 1 1-6.5-6.5c.7 0 1.4.1 2 .3v3.1c-.6-.2-1.3-.3-2-.2-1.7.2-3 1.6-3 3.3 0 1.8 1.5 3.3 3.3 3.3s3.3-1.5 3.3-3.3V2h1.1z"/></svg>
      </a>
      <a class="icon-btn social-btn" href="https://t.me/TheRealUnrealStorySupes" target="_blank" rel="noopener" aria-label="Telegram">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.96 15.47l-.4 5.63c.57 0 .81-.24 1.1-.53l2.64-2.53 5.47 4c1.01.56 1.73.27 2-.93l3.62-16.97c.32-1.5-.54-2.08-1.52-1.72L1.2 9.65c-1.46.57-1.44 1.39-.25 1.76l5.54 1.73 12.85-8.11c.6-.39 1.15-.17.7.22"/></svg>
      </a>
    </div>
  `;
}

function mountBaseStructure(root) {
  const sub = $('#subpage');
  if (sub) sub.classList.add('page--trustfields');

  root.innerHTML = `
    <!-- Block 1: вводная, без заголовка -->
    <section id="tf-intro">
      <div data-i18n="trust.intro.html"></div>
      <div class="mt-2 text-xs opacity-80" data-i18n="trust.block1.note"></div>
    </section>

    <!-- Block 2: Видео (9:16) + текст -->
    <section id="tf-video" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="trust.block2.title">Reimagining The Real Unreal Story</h2>
      <div class="tf-split">
        <div class="tf-left">
          <div class="video-wrap" style="padding-top:177.78%">
            <video id="tfVideoEl" controls playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%"></video>
          </div>
        </div>
        <div class="tf-right" data-i18n="trust.block2.text.html"></div>
      </div>
    </section>

    <!-- Block 3: Соцсети + динамическая галерея -->
    <section id="tf-social" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="trust.block3.title">TrustFields in social media</h2>
      ${htmlSocialBlock()}
      <div id="tf-gallery" class="tf-grid" aria-live="polite"></div>
    </section>
  `;

  // локальные стили страницы
  const style = document.createElement('style');
  style.textContent = `
    .page--trustfields section{
      background:rgba(0,0,0,0.2);
      border-radius:1rem;
      padding:1rem;
      border:1px solid rgba(255,255,255,.12)
    }
    .rtxt p{ margin:0 0 .9em; line-height:1.66 }
    .rtxt .indent{ text-indent:1.25em }

    .tf-split{ display:flex; gap:16px; align-items:flex-start }
    .tf-left{ flex:0 0 30% }
    .tf-right{ flex:1 1 auto }
    @media (max-width: 820px){
      .tf-split{ flex-direction:column }
      .tf-left{ flex-basis:auto }
    }

    /* Видео 9:16 и без обрезки */
    #tf-video .video-wrap { position:relative; background:#000; border-radius:10px; overflow:hidden; }
    #tf-video video { object-fit: contain; background:#000; }

    /* Галерея: 9:16 плитки */
    .tf-grid{
      display:grid;
      grid-template-columns: repeat(5, minmax(0,1fr));
      gap:10px;
      margin-top:12px;
    }
    .tf-tile{
      position:relative; overflow:hidden; border-radius:12px; border:1px solid rgba(255,255,255,.10);
      background:rgba(255,255,255,.04); padding-top:177.78%; /* 9:16 */
    }
    .tf-tile img{
      position:absolute; inset:0; width:100%; height:100%;
      object-fit: cover; display:block;
      background:#000;
    }
    @media (max-width: 820px){
      /* две строки по 3 элемента (итого 6) */
      .tf-grid{ grid-template-columns: repeat(3, minmax(0,1fr)); }
    }
  `;
  document.head.appendChild(style);
}

/* ---------------- Галерея ---------------- */
function buildPlaceholders(container) {
  container.innerHTML = '';
  const isMobile = window.matchMedia('(max-width: 820px)').matches;
  const count = isMobile ? 6 : 5;
  for (let i = 0; i < count; i++) {
    const d = document.createElement('div');
    d.className = 'tf-tile';
    d.innerHTML = `<img alt="TrustFields image" loading="lazy">`;
    container.appendChild(d);
  }
  return count;
}

function startShuffle(container, pool) {
  const tiles = $$('.tf-tile img', container);
  const timers = [];
  const failed = new Set();

  function pickUrl() {
    if (!pool.length) return '';
    // до 8 попыток найти не упавший URL
    for (let i = 0; i < 8; i++) {
      const u = pool[Math.floor(Math.random() * pool.length)];
      if (!failed.has(u)) return u;
    }
    return pool[0];
  }

  function setImage(img) {
    const url = pickUrl();
    if (!url) return;
    img.onerror = () => {
      failed.add(url);
      setTimeout(() => setImage(img), 120);
    };
    img.onload = () => { /* ok */ };
    img.src = url + `?v=${Date.now() % 1e7}`;
  }

  tiles.forEach((img) => {
    const period = rand(1000, 2000, 200); // 1.0..2.0 c, шаг 0.2
    const tick = () => setImage(img);
    tick(); // первая подстановка сразу
    const id = setInterval(tick, period);
    timers.push(id);
  });

  // Пересборка при первом resize (меняется число плиток)
  const onResize = () => {
    timers.forEach(clearInterval);
    startGallery(container, pool);
    window.removeEventListener('resize', onResize);
  };
  window.addEventListener('resize', onResize, { once: true });
}

function startGallery(container, pool) {
  if (!pool || !pool.length) {
    container.innerHTML = `<div class="text-sm opacity-80">No images yet.</div>`;
    return;
  }
  buildPlaceholders(container);
  startShuffle(container, pool);
}

/* ---------------- Инициализация страницы ---------------- */
export async function init(root) {
  const startLang = getLangFromQuery();
  await loadTrustLocale(startLang);

  mountBaseStructure(root);
  await applyI18nTo(root);

  // Медиа-реестры
  const { videos, images } = await loadMedia();

  // Видео во втором блоке
  const videoEl = $('#tfVideoEl');
  const vid =
    (videos?.intro && videos.intro[0]) ||
    (videos?.byIndex && videos.byIndex['0']) ||
    '';
  if (videoEl && vid) {
    videoEl.src = vid;
  }

  // Галерея
  const gallery = $('#tf-gallery');
  const pool = buildImagePool(images);
  startGallery(gallery, pool);

  // Переключение языка на лету
  onLocaleChanged(async ({ lang }) => {
    await loadTrustLocale(lang);
    await applyI18nTo(root);
  });
}

export function destroy() {
  const sub = $('#subpage');
  if (sub) sub.classList.remove('page--trustfields');
}
