// assets/js/core/reporting/block3.js
// Reports feed from a private Telegram channel via news2 (channel=reports).
// Text is auto-translated (cached), images via tg-file proxy.
// No "Open in Telegram" link, no social buttons.

import { I18N } from '../../i18n.js';
import { openModal } from '../../modal.js';

let mounted = false;
let unsubLocale = null;

const t = (k, fb='') => I18N[k] ?? fb;
const esc = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export async function init(root){
  if (mounted) return; mounted = true;

  // Находим секцию блока
  const section =
    root.querySelector('#rep-block3') ||
    root.querySelector('[data-i18n="reporting.block3.title"]')?.closest('section');
  if (!section) { console.warn('[reports:b3] section not found'); return; }

  injectStyles();

  // Внутренняя подложка со скроллом и спокойной рамкой
  let host = section.querySelector('.reports-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'reports-host b3-pane';
    host.style.maxHeight = '560px';
    host.style.overflowY = 'auto';
    section.appendChild(host);
  } else {
    host.classList.add('b3-pane');
    host.style.maxHeight = '560px';
    host.style.overflowY = 'auto';
  }

  host.innerHTML = `<div class="rep-b3 muted">${t('feed.loading','Loading news…')}</div>`;
  await reload(host);

  // Реакция на смену языка
  unsubLocale = () => reload(host);
  document.addEventListener('locale-changed', unsubLocale);

  // Открытие полноразмерного изображения
  host.addEventListener('click', e => {
    const img = e.target.closest('img[data-full]');
    if (!img) return;
    e.preventDefault();
    openModal('', `<img src="${img.getAttribute('data-full')}" class="w-full h-auto rounded-xl">`);
  });
}

export function destroy(){
  document.removeEventListener('locale-changed', unsubLocale || (()=>{}));
  mounted = false;
}

async function reload(host){
  try{
    const lang = (document.documentElement.getAttribute('lang')||'en').toLowerCase();
    const url  = `/.netlify/functions/news2?channel=reports&lang=${encodeURIComponent(lang)}&limit=20`;
    const r = await fetch(url, { cache:'no-store' });
    if (!r.ok) throw new Error('http '+r.status);
    const { items=[] } = await r.json();

    if (!items.length){
      host.innerHTML = `<div class="rep-b3 empty">${t('feed.empty','No posts yet.')}</div>`;
      return;
    }

    host.innerHTML = items.map(renderItem).join('');
  }catch(e){
    console.error('[reports:b3] reload error', e);
    host.innerHTML = `<div class="rep-b3 error">${t('feed.error','Failed to load news.')}</div>`;
  }
}

function renderItem(p){
  const time  = p.date ? new Date(p.date).toLocaleString() : '';
  const hasTr = !!(p.provider && p.provider !== 'none');
  const body  = hasTr && p.text_tr ? p.text_tr : (p.text || '');
  const text  = esc(body).replace(/\n/g,'<br>');

  const mediaHtml = (Array.isArray(p.media) ? p.media : []).map(m => {
    const th = m.thumbUrl || m.thumb;
    const fu = m.fullUrl  || m.full;
    if (!th) return '';
    return `<img src="${th}" data-full="${fu||''}" alt="" class="rep-thumb">`;
  }).join('');

  // ВАЖНО: ссылку на Telegram не показываем (приватный канал)
  return `
    <article class="rep-post">
      <div class="rep-meta">${time}${hasTr ? ` • ${t('feed.auto','auto-translated')}` : ''}</div>
      ${ text ? `<div class="rep-text">${text}</div>` : '' }
      ${ mediaHtml }
    </article>`;
}

function injectStyles(){
  if (document.getElementById('reports-b3-styles')) return;
  const st = document.createElement('style');
  st.id = 'reports-b3-styles';
  st.textContent = `
    /* Подложка списка (как в Legal Timeline / block4): спокойная рамка и лёгкий фон */
    .b3-pane{
      background: rgba(0,0,0,0.20);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 10px;
    }

    .rep-post { margin-bottom: 12px; padding: 12px; border-radius: 14px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.10);
    }
    .rep-meta { font-size: .80rem; color: rgba(231,236,243,.8); margin-bottom: 6px; }
    .rep-text { font-size: .95rem; line-height: 1.5; }

    .rep-thumb {
      margin-top: .5rem; border-radius: .75rem; display:block;
      max-width: 100%; max-height: 13rem; object-fit: contain; cursor: zoom-in;
      border: 1px solid rgba(255,255,255,0.08);
    }

    .rep-b3.muted, .rep-b3.empty, .rep-b3.error { opacity:.75; font-size:.95rem; }
  `;
  document.head.appendChild(st);
}
