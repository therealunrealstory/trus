;(function () {
  // ===== Config =====
  const MOUNT_ID = 'comment-block'; // добавь <div id="comment-block"></div> в нужном месте на странице Story
  const I18N_PATH = '/comment/i18n';
  const DEFAULT_LOCALES_CHAIN = () => {
    const docLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    const appLang = (window.APP_LOCALE || window.CURRENT_LANG || '').toLowerCase();
    // приоритет: appLang -> docLang -> ru -> en
    const chain = [];
    if (appLang) chain.push(appLang);
    if (docLang && !chain.includes(docLang)) chain.push(docLang);
    if (!chain.includes('ru')) chain.push('ru');
    if (!chain.includes('en')) chain.push('en');
    return chain;
  };

  // ===== Tiny i18n loader with fallback chain =====
  async function loadLocaleData() {
    const chain = DEFAULT_LOCALES_CHAIN();
    for (const code of chain) {
      try {
        const res = await fetch(`${I18N_PATH}/${code}.json`, { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (e) {}
    }
    return null;
  }

  // ===== Modal opener (uses existing openModal if present; otherwise lightweight fallback) =====
  function openCommentModal(title, html) {
    if (typeof window.openModal === 'function') {
      // предполагаем сигнатуру openModal({ title, html })
      try {
        window.openModal({ title, html });
        return;
      } catch (e) {}
    }
    // Фолбэк: простая модалка без внешних зависимостей
    const wrap = document.createElement('div');
    wrap.className = 'cb-modal-backdrop';
    wrap.innerHTML = `
      <div class="cb-modal">
        <div class="cb-modal-head">
          <h3 class="cb-modal-title">${title}</h3>
          <button class="cb-close" aria-label="Close">&times;</button>
        </div>
        <div class="cb-modal-body">${html}</div>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('.cb-close').addEventListener('click', close);
  }

  // ===== Styles (scoped and injected) =====
  function injectStylesOnce() {
    if (document.getElementById('comment-block-styles')) return;
    const css = `
      #${MOUNT_ID} { margin: 2.5rem 0; }
      .cb-wrap { display: grid; gap: 1.25rem; align-items: start; }
      @media (min-width: 900px) {
        .cb-wrap { grid-template-columns: 0.3fr 0.7fr; }
      }
      .cb-img {
        width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
        border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,.08);
      }
      .cb-text { font-size: 1.05rem; line-height: 1.6; color: var(--fg, #111); }
      .cb-actions { margin-top: .75rem; display: flex; flex-wrap: wrap; gap: .5rem; }
      .cb-btn {
        display: inline-flex; align-items: center; justify-content: center;
        padding: .65rem 1rem; border-radius: 10px; border: 1px solid rgba(0,0,0,.1);
        font-weight: 600; cursor: pointer; background: #f8fafc;
        transition: transform .05s ease, box-shadow .2s ease, background .2s ease;
      }
      .cb-btn:hover { background: #f1f5f9; box-shadow: 0 4px 16px rgba(0,0,0,.08); }
      .cb-btn:active { transform: translateY(1px); }
      .cb-links { display:flex; gap:.5rem; margin-left: .25rem; }
      .cb-link {
        display:inline-flex; align-items:center; gap:.4rem; padding:.55rem .8rem;
        border-radius:10px; border:1px solid rgba(0,0,0,.08); text-decoration:none;
        background:#fff;
      }
      .cb-link:hover { background:#f8fafc; }
      /* Fallback modal */
      .cb-modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.4);
        display: grid; place-items: center; z-index: 9999;
      }
      .cb-modal {
        width: min(920px, 94vw); max-height: 86vh; overflow: auto;
        background: #fff; border-radius: 16px; padding: 1rem 1.25rem;
        box-shadow: 0 20px 60px rgba(0,0,0,.2);
      }
      .cb-modal-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
      .cb-modal-title { margin: 0.25rem 0 .75rem; font-size: 1.25rem; }
      .cb-modal-body { font-size: 1rem; line-height: 1.7; }
      .cb-close { border:none; background:transparent; font-size:1.5rem; line-height:1; cursor:pointer; }
    `;
    const style = document.createElement('style');
    style.id = 'comment-block-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ===== Render =====
  function render(locale) {
    const root = document.getElementById(MOUNT_ID);
    if (!root || !locale) return;

    const imgSrc = locale.imgSrc || 'https://archive.org/download/orus-pics/nico.jpg';
    const imgAlt = locale.imgAlt || 'Nico';
    const title  = locale.title || 'Комментарий';
    const short  = locale.short || '';
    const full   = locale.full  || '';
    const cta    = locale.cta   || 'Комментарий Нико';

    root.innerHTML = `
      <div class="cb-wrap">
        <img class="cb-img" src="${imgSrc}" alt="${imgAlt}" loading="lazy" decoding="async" fetchpriority="low">
        <div class="cb-right">
          <div class="cb-text">${short}</div>
          <div class="cb-actions">
            <button class="cb-btn cb-open">${cta}</button>
            <div class="cb-links">
              <a class="cb-link" href="https://instagram.com" target="_blank" rel="noopener noreferrer">${locale.igLabel || 'Instagram'}</a>
              <a class="cb-link" href="https://t.me" target="_blank" rel="noopener noreferrer">${locale.tgLabel || 'Telegram'}</a>
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelector('.cb-open').addEventListener('click', () => openCommentModal(title, full));
  }

  // ===== Init =====
  async function init() {
    injectStylesOnce();
    const data = await loadLocaleData();
    render(data);
  }

  // Автоинициализация при готовности DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
