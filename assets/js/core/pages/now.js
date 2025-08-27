// assets/js/core/pages/now.js
import { t } from '../i18n.js';

let unLocale;

function renderPosts(items){
  if (!items || !items.length) return `<div class="text-sm text-gray-400">${t('feed.empty','No posts yet.')}</div>`;
  return items.map(p=>{
    const dt = p.date ? new Date(p.date).toLocaleString() : '';
    const text = (p.text_tr || p.text || '').replace(/\n/g,'<br>');
    const media = (p.media||[]).map(m=>{
      const url = `/.netlify/functions/tg-file?path=${encodeURIComponent(m.file_path_thumb||m.file_path_full||'')}`;
      const full= `/.netlify/functions/tg-file?path=${encodeURIComponent(m.file_path_full||m.file_path_thumb||'')}`;
      return `<img src="${url}" alt="" class="mt-2 rounded-xl border border-gray-700 max-w-full max-h-52 object-contain block cursor-zoom-in" onclick="document.dispatchEvent(new CustomEvent('openImage',{detail:'${full}'}))">`;
    }).join('');
    return `<article class="mb-4 p-3 rounded-2xl bg-gray-900/50 border border-gray-700"><div class="text-xs text-gray-300 mb-2">${dt}${p.link?` · <a href="${p.link}" target="_blank" class="underline text-sky-400">${t('feed.openTelegram','Open in Telegram')}</a>`:''}</div>${text?`<div class="text-sm leading-relaxed">${text}</div>`:''}${media}</article>`;
  }).join('');
}

async function loadChannel(channel, lang, container){
  container.innerHTML = `<div class="text-sm text-gray-400">${t('feed.loading','Loading news…')}</div>`;
  try{
    const r = await fetch(`/.netlify/functions/news2?channel=${channel}&lang=${encodeURIComponent(lang)}&limit=20`,{cache:'no-store'});
    if(!r.ok) throw new Error('http '+r.status);
    const j = await r.json();
    container.innerHTML = renderPosts(j.items);
  }catch(e){
    console.error('loadChannel',channel,e);
    container.innerHTML = `<div class="text-sm text-red-400">${t('feed.error','Failed to load news.')}</div>`;
  }
}

export async function init(root){
  const lang = document.documentElement.getAttribute('lang')||'EN';

  // NOW block
  root.innerHTML = `
  <section class="mt-6 p-4 rounded-2xl bg-black/30 border border-gray-700">
    <h2 class="text-xl font-semibold mb-4" data-i18n="news.titleNow">The Story Now — Current events</h2>
    <div class="rounded-2xl border border-gray-700 p-4 mb-3" id="feed-now"></div>
    <div class="mt-3 flex items-center gap-3 flex-wrap text-sm text-gray-300">
      <span>The heart of the story beats now — see on Telegram & X:</span>
      <a class="icon-btn social-btn small" href="https://t.me/TheRealUnrealStoryNow" target="_blank" rel="noreferrer" aria-label="Telegram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.96 15.47l-.4 5.63c.57 0 .81-.24 1.1-.53l2.64-2.53 5.47 4c1.01.56 1.73.27 2-.93l3.62-16.97c.32-1.5-.54-2.08-1.52-1.72L1.2 9.65c-1.46.57-1.44 1.39-.25 1.76l5.54 1.73 12.85-8.11c.6-.39 1.15-.17.7.22"/></svg></a>
      <a class="icon-btn social-btn small" href="https://x.com/TRUS_Now" target="_blank" rel="noreferrer" aria-label="X"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M20 4L4 20"/></svg></a>
    </div>
  </section>
  <section class="mt-6 p-4 rounded-2xl bg-black/30 border border-gray-700">
    <h2 class="text-xl font-semibold mb-4" data-i18n="news.titleNico">Nico’s thoughts</h2>
    <div class="rounded-2xl border border-gray-700 p-4 mb-3" id="feed-nico"></div>
    <div class="mt-3 flex items-center gap-3 flex-wrap text-sm text-gray-300">
      <span>Nico on the line — see more on Telegram, X & Instagram:</span>
      <a class="icon-btn social-btn small" href="https://t.me/TheRealUnrealStoryNico" target="_blank" rel="noreferrer" aria-label="Telegram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M9.96 15.47l-.4 5.63c.57 0 .81-.24 1.1-.53l2.64-2.53 5.47 4c1.01.56 1.73.27 2-.93l3.62-16.97c.32-1.5-.54-2.08-1.52-1.72L1.2 9.65c-1.46.57-1.44 1.39-.25 1.76l5.54 1.73 12.85-8.11c.6-.39 1.15-.17.7.22"/></svg></a>
      <a class="icon-btn social-btn small" href="https://x.com/TRUS_Nico" target="_blank" rel="noreferrer" aria-label="X"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16M20 4L4 20"/></svg></a>
      <a class="icon-btn social-btn small" href="https://instagram.com/TheRealUnrealStoryNico" target="_blank" rel="noreferrer" aria-label="Instagram"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2.2A2.8 2.8 0 1 0 12 15.8 2.8 2.8 0 0 0 12 9.2zm4.8-2.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></svg></a>
    </div>
  </section>`;

  const boxNow = root.querySelector('#feed-now');
  const boxNico= root.querySelector('#feed-nico');
  loadChannel('now', lang, boxNow);
  loadChannel('nico', lang, boxNico);

  unLocale = ()=>{ const lang = document.documentElement.getAttribute('lang')||'EN'; loadChannel('now', lang, boxNow); loadChannel('nico', lang, boxNico); };
  document.addEventListener('locale-changed', unLocale);
}

export function destroy(){ if(unLocale){document.removeEventListener('locale-changed',unLocale);} }
