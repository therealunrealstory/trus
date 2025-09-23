;(function () {
  // ===== Config =====
  const MOUNT_ID = 'comment-block';
  const I18N_PATH = '/comment/i18n';
  const IG_URL = 'https://www.instagram.com/therealunrealstorynico';
  const TG_URL = 'https://t.me/TheRealUnrealStoryNico';

  const DEFAULT_LOCALES_CHAIN = () => {
    const docLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    const appLang = (window.APP_LOCALE || window.CURRENT_LANG || '').toLowerCase();
    const chain = [];
    if (appLang) chain.push(appLang);
    if (docLang && !chain.includes(docLang)) chain.push(docLang);
    if (!chain.includes('ru')) chain.push('ru');
    if (!chain.includes('en')) chain.push('en');
    return chain;
  };

  // ===== i18n loader with fallback chain =====
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

  // ===== Modal opener: prefer site modal, else dark fallback =====
  function openCommentModal(title, html) {
    // если в проекте глобальная openModal есть — используем её
    if (typeof window.openModal === 'function') {
      try { window.openModal(title, html); return; } catch (e) {}
    }
    // Тёмный фолбэк в стилистике сайта
    const wrap = document.createElement('div');
    wrap.className = 'cb-modal-backdrop';
    wrap.innerHTML = `
      <div class="cb-modal">
        <div class="cb-modal-head">
          <h3 class="cb-modal-title">${title}</h3>
          <button class="cb-close" aria-label="Close">×</button>
        </div>
        <div class="cb-modal-body">${html}</div>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('.cb-close').addEventListener('click', close);
  }

  // ===== Styles (scoped & injected) =====
  function injectStylesOnce() {
    if (document.getElementById('comment-block-styles')) return;
    const css = `
      #${MOUNT_ID} { margin: 2.5rem 0; }
      .cb-wrap { display: grid; gap: 1.25rem; align-items: start; }
      @media (min-width: 900px) {
        .cb-wrap { grid-template-columns: 0.3fr 0.7fr; }
      }
      .cb-card { background: rgba(0,0,0,0.35); border: 1px solid rgba(148,163,184,.35); border-radius: 16px; padding: 1rem; }
      .cb-img {
        width: 100%; aspect-ratio: 1 / 1; object-fit: cover;
        border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,.08);
      }
      .cb-text { font-size: 1.05rem; line-height: 1.6; color: #fff; } /* белый текст на странице */
      .cb-actions { margin-top: .9rem; display: flex; flex-wrap: wrap; gap: .5rem .6rem; }
      /* Кнопка "Комментарий Нико" — как меню */
      .cb-btn-main.subnav-btn { } /* класс берёт стиль из сайта */
      /* Кнопки соцсетей — как Share */
      .cb-link {
        display:inline-flex; align-items:center; justify-content:center; gap:.4rem;
        padding:.5rem 1rem; border-radius: 0.75rem;
        border: 1px solid #374151; background: rgba(17,24,39,.4);
        color:#fff; text-decoration:none; font-size:.875rem;
        transition: background .2s ease, box-shadow .2s ease, transform .05s ease;
      }
      .cb-link:hover { background: rgba(17,24,39,.55); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
      .cb-links { display:flex; gap:.5rem; }

      /* Тёмный fallback modal */
      .cb-modal-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.55);
        display: grid; place-items: center; z-index: 9999;
      }
      .cb-modal {
        width: min(920px, 94vw); max-height: 86vh; overflow: auto;
        background: #0b0f1a; color: #fff; /* тёмный фон + белый текст */
        border: 1px solid rgba(148,163,184,.25);
        border-radius: 16px; padding: 1rem 1.25rem;
        box-shadow: 0 20px 60px rgba(0,0,0,.45);
      }
      .cb-modal-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; }
      .cb-modal-title { margin: .25rem 0 .75rem; font-size: 1.1rem; font-weight: 600; }
      .cb-modal-body { font-size: 1rem; line-height: 1.7; color: #e5e7eb; }
      .cb-modal-body p { margin: .75rem 0; }
      .cb-close { border:none; background:transparent; font-size:1.6rem; line-height:1; color:#fff; cursor:pointer; }
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
    const title  = locale.title || 'Комментарий Нико';
    const short  = locale.short || '';
    const full   = locale.full  || '';
    const cta    = locale.cta   || 'Комментарий Нико';

    root.innerHTML = `
      <div class="cb-wrap">
        <div class="cb-card">
          <img class="cb-img" src="${imgSrc}" alt="${imgAlt}" loading="lazy" decoding="async" fetchpriority="low">
        </div>
        <div class="cb-right">
          <div class="cb-card">
            <div class="cb-text">${short}</div>
            <div class="cb-actions">
              <button class="cb-btn-main subnav-btn cb-open" type="button">${cta}</button>
              <div class="cb-links">
                <a class="cb-link" href="${IG_URL}" target="_blank" rel="noopener noreferrer">Instagram</a>
                <a class="cb-link" href="${TG_URL}" target="_blank" rel="noopener noreferrer">Telegram</a>
              </div>
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
