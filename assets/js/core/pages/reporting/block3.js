// assets/js/core/reporting/block3.js
// Reports feed from a private Telegram channel: text auto-translate via OpenAI (gpt-5-nano), images via tg-file proxy.
// No external links (private), no social buttons.

import { I18N } from '../../i18n.js';
import { openModal } from '../../modal.js';

let mounted = false;
let unsubLocale = null;

const t = (k, fb='') => I18N[k] ?? fb;
const esc = s => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

export async function init(root){
  if (mounted) return; mounted = true;

  // Ищем секцию блока (по id или заголовку)
  const section =
    root.querySelector('#rep-block3')
    || root.querySelector('[data-i18n="reporting.block3.title"]')?.closest('section');
  if (!section) { console.warn('[reports:b3] section not found'); return; }

  injectStyles();

  // Внутренний контейнер с тонкой рамкой и скроллом
  let host = section.querySelector('.reports-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'reports-host rounded-2xl border border-gray-700 p-4';
    host.style.maxHeight = '560px';
    host.style.overflowY = 'auto';
    host.innerHTML = `<div class="text-sm text-gray-300">${t('feed.loading','Loading news…')}</div>`;
    section.appendChild(host);
  }

  // Подписка на клики по превью
  host.addEventListener('click', onThumbClick);

  await reload(host);

  // Реакция на смену языка
  unsubLocale = (e) => reload(host);
  document.addEventListener('locale-changed', unsubLocale);
}

export function destroy(){
  mounted = false;
  document.removeEventListener('locale-changed', unsubLocale || (()=>{}));
}

async function reload(host){
  try{
    const lang = (document.documentElement.getAttribute('lang')||'en').toLowerCase();
    host.innerHTML = `<div class="text-sm text-gray-300">${t('feed.loading','Loading news…')}</div>`;
    const r = await fetch(`/.netlify/functions/news2?channel=reports&lang=${encodeURIComponent(lang)}&limit=20`, { cache:'no-store' });
    if (!r.ok) throw new Error('http '+r.status);
    const { items=[] } = await r.json();
    host.innerHTML = items.length ? items.map(renderItem).join('') :
      `<div class="text-sm text-gray-300">${t('feed.empty','No posts yet.')}</div>`;
  }catch(e){
    console.error('[reports:b3] reload error', e);
    host.innerHTML = `<div class="text-sm text-red-400">${t('feed.error','Failed to load news.')}</div>`;
  }
}

function renderItem(p){
  const time   = p.date ? new Date(p.date).toLocaleString() : '';
  const hasTr  = !!(p.provider && p.provider !== 'none');
  const body   = hasTr && p.text_tr ? p.text_tr : (p.text || '');
  const text   = esc(body).replace(/\n/g,'<br>');

  const mediaHtml = (Array.isArray(p.media) ? p.media : []).map(m => {
    const th = m.thumbUrl || m.thumb;
    const fu = m.fullUrl  || m.full;
    if (!th) return '';
    return `<img src="${th}" data-full="${fu||''}" alt="" class="rep-thumb">`;
  }).join('');

  return `
    <article class="rep-post">
      <div class="rep-meta">${time}${hasTr ? ` • ${t('feed.auto','auto-translated')}` : ''}</div>
      ${ text ? `<div class="rep-text">${text}</div>` : '' }
      ${ mediaHtml }
    </article>`;
}

function onThumbClick(e){
  const img = e.target.closest('img[data-full]');
  if (!img) return;
  e.preventDefault();
  openModal('', `<img src="${img.getAttribute('data-full')}" class="w-full h-auto rounded-xl">`);
}

function injectStyles(){
  if (document.getElementById('reports-b3-styles')) return;
  const st = document.createElement('style');
  st.id = 'reports-b3-styles';
  st.textContent = `
    .rep-post { margin-bottom: 1.25rem; }
    .rep-meta { font-size: .75rem; color: rgba(255,255,255,.7); margin-bottom: .5rem; }
    .rep-text { font-size: .95rem; line-height: 1.5; }
    .rep-thumb {
      margin-top: .5rem; border-radius: .75rem; display:block;
      max-width: 100%; max-height: 13rem; object-fit: contain; cursor: zoom-in;
      border: 1px solid rgba(255,255,255,0.08);
    }
  `;
  document.head.appendChild(st);
}
