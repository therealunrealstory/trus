// /assets/js/core/pages/now.js
// Два фида (NOW и NICO). Берём язык сайта через getLangFromQuery,
// тянем API news2, рисуем миниатюры; клик по миниатюре — модалка с большим фото.

import { t, getLangFromQuery } from '../i18n.js';
import { openModal } from '../modal.js';

let aborters = [];
let onOpenImage = null;

export async function init(root) {
  const boxNow  = root.querySelector('#tgFeedNow')  || root.querySelector('#tgFeed'); // совместимость со старым id
  const boxNico = root.querySelector('#tgFeedNico');

  const lang = (getLangFromQuery()?.toLowerCase() || 'en').slice(0, 2);

  if (boxNow)  boxNow.innerHTML  = `<div class="text-sm text-gray-300">${t('feed.loading','Loading news…')}</div>`;
  if (boxNico) boxNico.innerHTML = `<div class="text-sm text-gray-300">${t('feed.loading','Loading news…')}</div>`;

  const tasks = [];
  if (boxNow)  tasks.push(loadFeed(boxNow,  'now',  lang));
  if (boxNico) tasks.push(loadFeed(boxNico, 'nico', lang));
  await Promise.all(tasks).catch(()=>{});

  onOpenImage = (e) => openModal('', `<img src="${e.detail}" class="w-full h-auto rounded-xl">`);
  document.addEventListener('openImage', onOpenImage);
}

export function destroy() {
  aborters.forEach(a => a.abort?.());
  aborters = [];
  if (onOpenImage) document.removeEventListener('openImage', onOpenImage);
}

async function loadFeed(box, channel, lang) {
  const ctrl = new AbortController();
  aborters.push(ctrl);

  const url = `/.netlify/functions/news2?channel=${encodeURIComponent(channel)}&lang=${encodeURIComponent(lang)}&limit=20`;

  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
    if (!r.ok) throw new Error(`news2 ${r.status}`);
    const j = await r.json();

    if (!Array.isArray(j.items) || j.items.length === 0) {
      box.innerHTML = `<div class="text-sm text-gray-300">${t('feed.empty','No posts yet.')}</div>`;
      return;
    }

    box.innerHTML = j.items.map(renderItem).join('');
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="text-sm text-red-400">${t('feed.error','Failed to load news.')}</div>`;
  }
}

function renderItem(p) {
  const dt   = p.date ? new Date(p.date).toLocaleString() : '';
  const text = (p.text_tr || p.text || '').replace(/\n/g, '<br>');

  const imgs = (p.media || []).map(m => `
    <img
      src="${m.thumbUrl}"
      alt=""
      class="mt-2 rounded-xl border border-gray-700 max-w-full max-h-52 w-auto object-contain block cursor-zoom-in"
      onclick="document.dispatchEvent(new CustomEvent('openImage',{detail:'${m.fullUrl}'}))"
    >
  `).join('');

  const link = p.link
    ? `<a href="${p.link}" target="_blank" rel="noreferrer" class="underline text-sky-400">${t('feed.openTelegram','Open in Telegram')}</a>`
    : '';

  const at = p.provider && p.provider !== 'none'
    ? ` · ${t('feed.autoTranslated','auto-translated')}`
    : '';

  return `
    <article class="mb-4 p-3 rounded-2xl bg-gray-900/50 border border-gray-700">
      <div class="text-xs text-gray-300 mb-2">${dt}${at}${link ? ` · ${link}` : ''}</div>
      ${text ? `<div class="text-sm leading-relaxed">${text}</div>` : ''}
      ${imgs}
    </article>
  `;
}