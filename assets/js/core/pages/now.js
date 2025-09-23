// assets/js/core/pages/now.js
import { t } from '../i18n.js';
import { openModal } from '../modal.js';

let onLocale = null;
let onClick  = null;
const pollers = new Map(); // Карта для управления фоновыми опросами

export async function init(root){
  injectStyles();

  const boxNow  = root.querySelector('#tgFeedNow');
  const boxNico = root.querySelector('#tgFeedNico');

  prepHost(boxNow);
  prepHost(boxNico);

  await reload(boxNow,  'now');
  await reload(boxNico, 'nico');

  onLocale = async () => {
    stopAllPollers(); // Останавливаем все опросы при смене языка
    await reload(boxNow,  'now');
    await reload(boxNico, 'nico');
  };
  document.addEventListener('locale-changed', onLocale);

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
  stopAllPollers(); // Очищаем все при уходе со страницы
}

/* ---------------- helpers ---------------- */

function stopAllPollers() {
  for (const poller of pollers.values()) {
    clearInterval(poller);
  }
  pollers.clear();
}

function prepHost(host){
  if (!host) return;
  host.classList.remove('border','border-gray-700');
  host.classList.add('b3-pane');
  host.style.maxHeight = '560px';
  host.style.overflowY = 'auto';
}

async function reload(host, channel, isPoll = false){
  if (!host) return;

  if (!isPoll) {
    if (host._ctrl) try { host._ctrl.abort(); } catch {}
    const ctrl = new AbortController();
    host._ctrl = ctrl;
    host.innerHTML = `<div class="now-muted">${t('feed.loading','Loading news…')}</div>`;
  }
  
  const ctrl = host._ctrl;

  try{
    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const url  = `/.netlify/functions/news2?channel=${encodeURIComponent(channel)}&lang=${encodeURIComponent(lang)}&limit=20`;
    const r = await fetch(url, { cache:'no-store', signal: ctrl?.signal });
    if (!r.ok) throw new Error('http '+r.status);
    const { items = [] } = await r.json();

    if (host._ctrl !== ctrl && !isPoll) return;

    if (!isPoll) {
      host.innerHTML = items.length
        ? items.map(p => renderItem(p, channel)).join('')
        : `<div class="now-muted">${t('feed.empty','No posts yet.')}</div>`;
    } else {
      items.forEach(p => {
        const postEl = host.querySelector(`article[data-post-id="${p.id}"]`);
        if (postEl && !p.translation_pending) {
          postEl.outerHTML = renderItem(p, channel); // Обновляем только готовые
        }
      });
    }

    const pendingItems = items.filter(p => p.translation_pending);
    const pollerId = `poller_${channel}`;

    if (pendingItems.length > 0) {
      if (!pollers.has(pollerId)) {
        console.log(`[now] Starting poller for ${channel}`);
        const intervalId = setInterval(() => reload(host, channel, true), 8000);
        pollers.set(pollerId, intervalId);
      }
    } else {
      if (pollers.has(pollerId)) {
        console.log(`[now] Stopping poller for ${channel}`);
        clearInterval(pollers.get(pollerId));
        pollers.delete(pollerId);
      }
    }

  }catch(e){
    if (e?.name === 'AbortError') return;
    console.error('[now] load error', e);
    if (!isPoll) {
      host.innerHTML = `<div class="now-error">${t('feed.error','Failed to load news.')}</div>`;
    }
  }
}

function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// В renderItem добавлена логика для translation_pending
function renderItem(p, channel){
  const time  = p.date ? new Date(p.date).toLocaleString() : '';
  const isTranslated = p.provider && p.provider !== 'none';
  const body  = p.text_tr || p.text || '';
  const text  = esc(body).replace(/\n/g,'<br>');

  const mediaHtml = (Array.isArray(p.media) ? p.media : []).map(m=>{
    const th = m.thumbUrl || m.thumb;
    const fu = m.fullUrl  || m.full;
    if (!th) return '';
    return `<img src="${th}" data-full="${fu||''}" alt="" class="now-thumb">`;
  }).join('');

  const link = p.link ? ` · <a href="${p.link}" target="_blank" class="underline text-sky-400">${t('feed.openTelegram','Open in Telegram')}</a>` : '';

  let translationMeta = '';
  if (p.translation_pending) {
    translationMeta = ` • <span style="color: #eab308;">${t('feed.translating', 'Translating...')}</span>`;
  } else if (isTranslated) {
    translationMeta = ` • ${t('feed.auto','auto-translated')}`;
  }

  return `
    <article class="now-post" data-post-id="${p.id}" data-channel="${channel}">
      <div class="now-meta">${time}${translationMeta}${link}</div>
      ${ text ? `<div class="now-text">${text}</div>` : '' }
      ${ mediaHtml }
    </article>`;
}


function injectStyles(){
  const css = `
    .b3-pane{
      background: rgba(0,0,0,0.20);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 16px;
      padding: 10px;
    }
    .now-post { margin-bottom: 12px; background: transparent !important; border: 0 !important; }
    .now-meta { font-size: .80rem; color: rgba(231,236,243,.8); margin-bottom: 6px; }
    .now-text { font-size: .95rem; line-height: 1.5; }
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
  st.textContent = css;
}