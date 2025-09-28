// /assets/js/core/pages/trustfields.js
import { $, $$ } from '../dom.js';
import { I18N, t, onLocaleChanged, getLangFromQuery, applyI18nTo } from '../i18n.js';

/* ---------- i18n (локали страницы) ---------- */
async function loadTrustLocale(lang){
  const L = (lang || 'EN').toUpperCase();
  async function fetchJson(u){ try{ const r = await fetch(u, { cache:'no-store' }); return r.ok ? r.json() : null; } catch { return null; } }
  let data = await fetchJson(`/TrustFields/i18n/${L}.json`);
  if (!data && L !== 'EN') data = await fetchJson(`/TrustFields/i18n/EN.json`);
  if (!data) data = {};
  for (const k in data) I18N[k] = data[k];
}

/* ---------- utils ---------- */
const rand = (min, max, step=1)=> {
  const n = Math.floor((max - min)/step);
  return min + step * Math.floor(Math.random()*(n+1));
};
async function readJson(url){
  try{ const r = await fetch(url, { cache:'no-store' }); if(!r.ok) return null; return await r.json(); }
  catch{ return null; }
}

/* ---------- Медиа-реестры ---------- */
async function loadMedia(){
  const [videos, images] = await Promise.all([
    readJson('/trustfields/media/videos.json'),
    readJson('/trustfields/media/images.json')
  ]);
  return { videos: videos||{}, images: images||{} };
}

/* ---------- YouTube embed (shorts/watch/youtu.be/embed) ---------- */
function ytEmbed(rawUrl, { aspect = '9:16' } = {}){
  const url = String(rawUrl || '').trim();

  const getId = (u) => {
    if (!u) return '';
    try {
      const Y = new URL(u);
      const host = Y.hostname.replace(/^www\./,'');
      const parts = Y.pathname.split('/').filter(Boolean);
      if (host === 'youtu.be' && parts[0]) return parts[0]; // youtu.be/<id>
      if (host.endsWith('youtube.com') && parts[0] === 'shorts' && parts[1]) return parts[1]; // /shorts/<id>
      if (host.endsWith('youtube.com') && parts[0] === 'embed'  && parts[1]) return parts[1]; // /embed/<id>
      const v = Y.searchParams.get('v'); if (v) return v; // watch?v=<id>
      return parts[parts.length - 1] || '';
    } catch {
      const m = String(u).match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : '';
    }
  };

  const id = getId(url).replace(/[?#].*$/,'');
  const ar = (aspect === '9:16') ? '9:16' : '16:9';
  if (!id) {
    return `<div class="yt-wrap" data-ar="${ar}"><div class="yt-ph">Video coming soon</div></div>`;
    }

  const src = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;
  const loading = (ar === '9:16') ? 'eager' : 'lazy';

  return `
    <div class="yt-wrap" data-ar="${ar}">
      <iframe
        src="${src}"
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="${loading}"
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
}

/* ---------- Верстка ---------- */
function htmlSocialBlock(){
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

function mountBaseStructure(root){
  const sub = $('#subpage');
  if (sub) sub.classList.add('page--trustfields');

  root.innerHTML = `
    <!-- Block 1: вводная, без заголовка -->
    <section id="tf-intro">
      <div data-i18n="trust.intro.html"></div>
      <div class="mt-2 text-xs opacity-80" data-i18n="trust.block1.note"></div>
    </section>

    <!-- Block 2: Видео (YouTube 9:16) + текст -->
    <section id="tf-video" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="trust.block2.title">Reimagining The Real Unreal Story</h2>
      <div class="tf-split">
        <div class="tf-left">
          <div id="tf-video-embed"></div>
        </div>
        <div class="tf-right rtxt" data-i18n="trust.block2.text.html"></div>
      </div>
    </section>

    <!-- Block 3: Соцсети + динамическая галерея -->
    <section id="tf-social" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="trust.block3.title">TrustFields in social media</h2>
      ${htmlSocialBlock()}
      <div id="tf-gallery" class="tf-grid" aria-live="polite"></div>
    </section>
  `;

  // локальные стили под страницу (подложки + отступы первой строки)
  const style = document.createElement('style');
  style.textContent = `
    .page--trustfields section{ background:rgba(0,0,0,0.2); border-radius:1rem; padding:1rem; border:1px solid rgba(255,255,255,.12) }
    .rtxt p{ margin:0 0 .9em; line-height:1.66 }
    .rtxt .indent{ text-indent:1.25em }

    .tf-split{ display:flex; gap:16px; align-items:flex-start }
    .tf-left{ flex:0 0 40% }   /* ← было 30%, стало 40% */
    .tf-right{ flex:1 1 auto }

    /* YouTube wrapper с aspect-ratio и фолбэком */
    #tf-video .yt-wrap{ position:relative; width:100%; overflow:hidden; background:#000; border-radius:10px; }
    #tf-video .yt-wrap iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; display:block; }
    #tf-video .yt-wrap::before{ content:''; display:block; padding-top:177.78%; } /* 9:16 */
    @supports (aspect-ratio:1 / 1){
      #tf-video .yt-wrap{ aspect-ratio: 9 / 16; }
      #tf-video .yt-wrap::before{ content:none; padding-top:0; }
    }

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
    .tf-tile img{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block }

    @media (max-width: 820px){
      .tf-split{ flex-direction:column }
      .tf-left, .tf-right{ flex-basis:auto; width:100% } /* видео и текст на всю ширину */
    }
  `;
  document.head.appendChild(style);
}

/* ---------- Галерея ---------- */
function buildPlaceholders(container){
  container.innerHTML = '';
  const isMobile = window.matchMedia('(max-width: 820px)').matches;
  const count = isMobile ? 6 : 5;
  for (let i=0;i<count;i++){
    const d = document.createElement('div');
    d.className = 'tf-tile';
    d.innerHTML = `<img alt="TrustFields image" loading="lazy">`;
    container.appendChild(d);
  }
  return count;
}

function startShuffle(container, pool){
  const tiles = $$('.tf-tile img', container);
  const timers = [];
  tiles.forEach((img)=>{
    const period = 1000 + 200 * Math.floor(Math.random()*6); // 1.0..2.0s шаг 0.2
    const tick = ()=>{
      const url = pool[Math.floor(Math.random()*pool.length)];
      if (url) img.src = url + `?ts=${Date.now()%1e7}`;
    };
    tick();
    const id = setInterval(tick, period);
    timers.push(id);
  });

  const onResize = ()=>{
    timers.forEach(clearInterval);
    startGallery(container, pool);
    window.removeEventListener('resize', onResize);
  };
  window.addEventListener('resize', onResize, { once:true });
}

function startGallery(container, pool){
  if (!pool || !pool.length) {
    container.innerHTML = `<div class="text-sm text-gray-300">No images yet.</div>`;
    return;
  }
  buildPlaceholders(container);
  startShuffle(container, pool);
}

/* ---------- Инициализация страницы ---------- */
export async function init(root){
  const startLang = getLangFromQuery();
  await loadTrustLocale(startLang);

  mountBaseStructure(root);
  await applyI18nTo(root);

  // Видео-блок: встраиваем YouTube Shorts (9:16)
  const ytUrl = 'https://youtube.com/shorts/FsThyQDxHGM';
  $('#tf-video-embed').innerHTML = ytEmbed(ytUrl, { aspect:'9:16' });

  // медиа для галереи
  const { images } = await loadMedia();
  const gallery = $('#tf-gallery');
  let pool = [];
  if (images?.byIndex && Object.keys(images.byIndex).length){
    pool = Object.values(images.byIndex);
  } else {
    // если images.json пуст — используем архив с номерами
    const base = images?.baseUrl || 'https://archive.org/download/trustfields-pics/';
    const min = Number(images?.min ?? 1);
    const max = Number(images?.max ?? 99);
    pool = Array.from({length: max - min + 1}, (_,i)=> `${base}${i+min}.jpg`);
  }
  startGallery(gallery, pool);

  onLocaleChanged(async ({ lang })=>{
    await loadTrustLocale(lang);
    await applyI18nTo(root);
  });
}

export function destroy(){
  const sub = $('#subpage');
  if (sub) sub.classList.remove('page--trustfields');
}
