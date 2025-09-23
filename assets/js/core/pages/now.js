// assets/js/core/pages/now.js
import { t } from '../i18n.js';
import { openModal } from '../modal.js';

let onLocale = null;
let onClick = null;
const pollers = new Map(); // Карта для хранения интервалов опроса

export async function init(root) {
  injectStyles();

  const boxNow = root.querySelector('#tgFeedNow');
  const boxNico = root.querySelector('#tgFeedNico');

  prepHost(boxNow);
  prepHost(boxNico);

  await reload(boxNow, 'now');
  await reload(boxNico, 'nico');

  onLocale = async () => {
    // Останавливаем все текущие опросы перед сменой языка
    stopAllPollers();
    await reload(boxNow, 'now');
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

export function destroy() {
  if (onLocale) document.removeEventListener('locale-changed', onLocale);
  if (onClick) document.removeEventListener('click', onClick);
  // Очищаем все поллеры при уходе со страницы
  stopAllPollers();
}

/* ---------------- helpers ---------------- */

function stopAllPollers() {
  for (const poller of pollers.values()) {
    clearInterval(poller);
  }
  pollers.clear();
}

function prepHost(host) {
  if (!host) return;
  host.classList.remove('border', 'border-gray-700');
  host.classList.add('b3-pane');
  host.style.maxHeight = '560px';
  host.style.overflowY = 'auto';
}

async function reload(host, channel, isPoll = false) {
  if (!host) return;

  // Для основного запроса отменяем предыдущий, для опроса — нет
  if (!isPoll) {
    if (host._ctrl) try { host._ctrl.abort(); } catch {}
    const ctrl = new AbortController();
    host._ctrl = ctrl;
    host.innerHTML = `<div class="now-muted">${t('feed.loading', 'Loading news…')}</div>`;
  }

  const ctrl = host._ctrl; // Используем существующий контроллер

  try {
    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const url = `/.netlify/functions/news2?channel=${encodeURIComponent(channel)}&lang=${encodeURIComponent(lang)}&limit=20`;
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!r.ok) throw new Error('http ' + r.status);
    const { items = [] } = await r.json();

    if (host._ctrl !== ctrl) return; // Игнорируем, если уже стартовал новый запрос

    // Если это первый (не опросный) рендер
    if (!isPoll) {
      host.innerHTML = items.length
        ? items.map(p => renderItem(p, channel)).join('')
        : `<div class="now-muted">${t('feed.empty', 'No posts yet.')}</div>`;
    } else {
      // Если это опрос, просто обновляем существующие посты
      items.forEach(p => {
        const postEl = host.querySelector(`article[data-post-id="${p.id}"]`);
        if (postEl && !p.translation_pending) {
          // Перевод готов, перерисовываем только этот пост
          postEl.outerHTML = renderItem(p, channel);
        }
      });
    }

    // Проверяем, есть ли посты, ожидающие перевода
    const pendingItems = items.filter(p => p.translation_pending);
    const pollerId = `poller_${channel}`;

    if (pendingItems.length > 0) {
      // Если есть ожидающие и поллер еще не запущен
      if (!pollers.has(pollerId)) {
        console.log(`[now] Starting poller for channel: ${channel}`);
        const intervalId = setInterval(() => {
          reload(host, channel, true); // Запускаем опрос
        }, 7000); // Проверяем каждые 7 секунд
        pollers.set(pollerId, intervalId);
      }
    } else {
      // Если ожидающих нет, останавливаем поллер, если он был
      if (pollers.has(pollerId)) {
        console.log(`[now] Stopping poller for channel: ${channel}`);
        clearInterval(pollers.get(pollerId));
        pollers.delete(pollerId);
      }
    }

  } catch (e) {
    if (e?.name === 'AbortError') return;
    console.error('[now] load error', e);
    // Не показываем ошибку при сбое опроса, чтобы не перекрывать контент
    if (!isPoll) {
      host.innerHTML = `<div class="now-error">${t('feed.error', 'Failed to load news.')}</div>`;
    }
  }
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }

function renderItem(p, channel) {
  const time = p.date ? new Date(p.date).toLocaleString() : '';
  const isTranslated = !!(p.provider && p.provider !== 'none');
  const body = p.text_tr || p.text || '';
  const text = esc(body).replace(/\n/g, '<br>');

  const mediaHtml = (Array.isArray(p.media) ? p.media : []).map(m => {
    const th = m.thumbUrl || m.thumb;
    const fu = m.fullUrl || m.full;
    if (!th) return '';
    return `<img src="${th}" data-full="${fu || ''}" alt="" class="now-thumb">`;
  }).join('');

  const link = p.link ? ` · <a href="${p.link}" target="_blank" class="underline text-sky-400">${t('feed.openTelegram', 'Open in Telegram')}</a>` : '';
  
  let metaInfo = '';
  if (p.translation_pending) {
    metaInfo = ` • <span class="text-amber-400">${t('feed.translating', 'Translating...')}</span>`;
  } else if (isTranslated) {
    metaInfo = ` • ${t('feed.auto', 'auto-translated')}`;
  }

  return `
    <article class="now-post" data-post-id="${p.id}" data-channel="${channel}">
      <div class="now-meta">${time}${metaInfo}${link}</div>
      ${text ? `<div class="now-text">${text}</div>` : ''}
      ${mediaHtml}
    </article>`;
}

function injectStyles() {
    // ... (стили остаются без изменений) ...
}