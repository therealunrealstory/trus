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

  // ===== Open site modal (native styles only) =====
  function openCommentModal(title, html) {
    if (typeof window.openModal === 'function') {
      window.openModal(title, html);
      return;
    }
    // Фолбэк без собственных стилей — используем существующую разметку модалки сайта
    const modal = document.getElementById('modalBackdrop');
    const mTitle = document.getElementById('modalTitle');
    const mBody  = document.getElementById('modalBody');
    if (!modal || !mTitle || !mBody) return;
    mTitle.innerHTML = title || '';
    mBody.innerHTML  = html  || '';
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    try { document.getElementById('modalClose')?.focus(); } catch(_) {}
  }

  // ===== Styles for the on-page block only =====
  function injectStylesOnce() {
    if (document.getElementById('comment-block-styles')) return;
    const css = `
      #${MOUNT_ID} { margin: 2.5rem 0; }
      .cb-wrap { display: grid; gap: 1.25rem; align-items: start; }
      @media (min-width: 900px) { .cb-wrap { grid-template-columns: 0.3fr 0.7fr; } }
      .cb-card { background: rgba(0,0,0,0.35); border: 1px solid rgba(148,163,184,.35); border-radius: 16px; padding: 1rem; }
      .cb-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,.08); }
      .cb-text { font-size: 1.05rem; line-height: 1.6; color: #fff; }
      .cb-actions { margin-top: .9rem; display: flex; flex-wrap: wrap; gap: .5rem .6rem; }
      .cb-btn-main.subnav-btn { } /* берёт внешний стиль меню */
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
              <a class="px-4 py-2 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-sm"
                 href="${IG_URL}" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a class="px-4 py-2 rounded-xl border border-gray-700 bg-gray-900/40 text-white text-sm"
                 href="${TG_URL}" target="_blank" rel="noopener noreferrer">Telegram</a>
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
