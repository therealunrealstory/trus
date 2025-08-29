// assets/js/core/pages/now.js
// Two feeds (NOW / NICO) styled like block3: one container "b3-pane" per feed, no per-post cards, no image borders.
// Keeps "Open in Telegram" links for public channels. Auto-cancels pending fetches on locale change.

import { t } from '../i18n.js';
import { openModal } from '../modal.js';

let onLocale = null;
let onClick  = null;

export async function init(root){
  injectStyles();

  const boxNow  = root.querySelector('#tgFeedNow');
  const boxNico = root.querySelector('#tgFeedNico');

  // Приводим контейнеры к общему стилю (мягкая подложка + скролл)
  prepHost(boxNow);
  prepHost(boxNico);

  await reload(boxNow,  'now');
  await reload(boxNico, 'nico');

  // Перезагрузка при смене языка
  onLocale = async () => {
    await reload(boxNow,  'now');
    await reload(boxNico, 'nico');
  };
  document.addEventListener('locale-changed', onLocale);

  // Открытие полноразм. картинки
  onClick = (e) => {
    const img = e.target.closest('img[data-full]');
    if (!img) return;
    e.preventDefault();
    openModal('', `<img src="${img.getAttribute('data-full')}" class="w-full h-auto rounded-xl">`);
  };
  root.addEventListener('click', onClick);
}

export function destroy(){
  if (onLocale) document.removeEventListener('locale-changed', onLocale);
  if (onClick)  document.removeEventListener('click', onClick);
}

/* ---------------- helpers ---------------- */

function prepHost(host){
  if (!host) return;
  // убрать возможные старые «яркие» рамки
  host.classList.remove('border','border-gray-700');
  host.classList.add('b3-pane');
  host.style.maxHeight = '560px';
  host.style.overflowY = 'auto';
}

async function reload(host, channel){
  if (!host) return;

  // отменить предыдущий запрос, если в полёте
  if (host._ctrl) try { host._ctrl.abort(); } catch {}
  const ctrl = new AbortController();
  host._ctrl = ctrl;

  host.innerHTML = `<div class="now-muted">${t('feed.loading','Loading news…')}</div>`;

  try{
    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const url  = `/.netlify/functions/news2?channel=${encodeURIComponent(channel)}&lang=${encodeURIComponent(lang)}&limit=20`;
    const r = await fetch(url, { cache:'no-store', signal: ctrl.signal });
    if (!r.ok) throw new Error('http '+r.status);
    const { items = [] } = await r.json();

    // если уже стартовал новый запрос — игнорируем этот ответ
    if (host._ctrl !== ctrl) return;

    host.innerHTML = items.length
      ? items.map(renderItem).join('')
      : `<div class="now-muted">${t('feed.empty','No posts yet.')}</div>`;
  }catch(e){
    if (e?.name === 'AbortError') return; // норм при переключении языка
    console.error('[now] load error', e);
    host.innerHTML = `<div class="now-error">${t('feed.error','Failed to load news.')}</div>`;
  }
}

function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function renderItem(p){
  const time  = p.date ? new Date(p.date).toLocaleString() : '';
  const hasTr = !!(p.provider && p.provider !== 'none');
  const body  = hasTr && p.text_tr ? p.text_tr : (p.text || '');
  const text  = esc(body).replace(/\n/g,'<br>');

  const mediaHtml = (Array.isArray(p.media) ? p.media : []).map(m=>{
    const th = m.thumbUrl || m.thumb;
    const fu = m.fullUrl  || m.full;
    if (!th) return '';
    return `<img src="${th}" data-full="${fu||''}" alt="" class="now-thumb">`;
  }).join('');

  // Для NOW/NICO ссылка "Open in Telegram" допустима (публичные каналы)
  const link = p.link ? ` · <a href="${p.link}" target="_blank" class="underline text-sky-400">${t('feed.openTelegram','Open in Telegram')}</a>` : '';

  return `
    <article class="now-post">
      <div class="now-meta">${time}${hasTr ? ` • ${t('feed.auto','auto-translated')}` : ''}${link}</div>
      ${ text ? `<div class="now-text">${text}</div>` : '' }
      ${ mediaHtml }
    </article>`;
}

function injectStyles(){
  const css = `
    /* Общая подложка блока (как в reporting/block3) */
    .b3-pane{
      background: rgba(0,0,0,0.20);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 10px;
    }
    /* Посты без подложек/рамок */
    .now-post { margin-bottom: 12px; background: transparent !important; border: 0 !important; }
    .now-meta { font-size: .80rem; color: rgba(231,236,243,.8); margin-bottom: 6px; }
    .now-text { font-size: .95rem; line-height: 1.5; }
    /* Картинки без рамок */
    .now-thumb {
      margin-top: .5rem; border-radius: .75rem; display:block;
      max-width: 100%; max-height: 13rem; object-fit: contain; cursor: zoom-in;
      border: 0 !important; outline: 0 !important; box-shadow: none !important; background: transparent !important;
    }
    .now-muted { opacity:.75; font-size:.95rem; }
    .now-error { color:#fca5a5; font-size:.95rem; }
  `;
  let st = document.getElementById('now-page-styles');
  if (!st) { st = document.createElement('style'); st.id='now-page-styles'; document.head.appendChild(st); }
  st.textContent = css; // перезаписать, чтобы перебить старые правила
}
