// /assets/js/core/pages/now.js
import { t, getLangFromQuery, onLocaleChanged } from '../i18n.js';
import { openModal } from '../modal.js';

let unLocale = null;

export async function init(root) {
  const box = root.querySelector('#tgFeed');
  if (!box) return;
  await render(box);

  // Перерисовывать при смене языка
  unLocale = onLocaleChanged(async () => { await render(box); });

  // Делегированный клик по превью — открываем full
  document.addEventListener('click', onThumbClick);
}

export function destroy() {
  if (unLocale) { try { unLocale(); } catch {} unLocale = null; }
  document.removeEventListener('click', onThumbClick);
}

function onThumbClick(e){
  const img = e.target.closest('img[data-full]');
  if (!img) return;
  e.preventDefault();
  openModal('', `<img src="${img.getAttribute('data-full')}" class="w-full h-auto rounded-xl">`);
}

async function render(box){
  const lang = (getLangFromQuery() || 'EN').toLowerCase();
  box.innerHTML = `<div class="text-sm text-gray-300">${t('feed.loading','Loading news…')}</div>`;

  try{
    const r = await fetch(`/.netlify/functions/news2?channel=now&lang=${encodeURIComponent(lang)}&limit=20`, { cache: 'no-store' });
    if (!r.ok) throw new Error('news2 API ' + r.status);
    const data = await r.json();
    const items = Array.isArray(data.items) ? data.items : [];
    box.innerHTML = items.length ? items.map(renderItem).join('') :
      `<div class="text-sm text-gray-300">${t('feed.empty','No posts yet.')}</div>`;
  }catch(e){
    console.error(e);
    box.innerHTML = `<div class="text-sm text-red-400">${t('feed.error','Failed to load news.')}</div>`;
  }
}

function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

function renderItem(p){
  const time = p.date ? new Date(p.date).toLocaleString() : '';
  const hasTr = !!(p.provider && p.provider !== 'none');
  const textRaw = hasTr && p.text_tr ? p.text_tr : (p.text || '');
  const textHtml = esc(textRaw).replace(/\n/g,'<br>');
  const link = p.link ? `<a href="${p.link}" target="_blank" class="underline text-sky-400">${t('feed.openTelegram','Open in Telegram')}</a>` : '';

  const mediaHtml = (Array.isArray(p.media) ? p.media : []).map(m => {
    const thumb = m.thumbUrl || m.thumb || m.thumb_url;
    const full  = m.fullUrl  || m.full  || m.full_url || m.url;
    if (!thumb) return '';
    return `<img src="${thumb}" data-full="${full || ''}" alt="" class="mt-2 rounded-xl border border-gray-700 max-w-full max-h-52 sm:max-h-52 w-auto object-contain block cursor-zoom-in">`;
  }).join('');

  return `
    <article class="mb-4 p-3 rounded-2xl bg-gray-900/50 border border-gray-700">
      <div class="text-xs text-gray-300 mb-2">
        ${time}${hasTr ? ` • ${t('feed.auto','auto-translated')}` : ''}${link ? ` · ${link}` : ''}
      </div>
      ${ textHtml ? `<div class="text-sm leading-relaxed">${textHtml}</div>` : '' }
      ${ mediaHtml }
    </article>`;
}
