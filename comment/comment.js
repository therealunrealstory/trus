;(function () {
  // ===== Config =====
  const MOUNT_ID = 'comment-block';
  const I18N_PATH = '/comment/i18n';
  const IG_URL = 'https://www.instagram.com/therealunrealstorynico';
  const TG_URL = 'https://t.me/TheRealUnrealStoryNico';

  // Render state
  let currentLocaleData = null;
  let renderedOnce = false;

  // ===== Locale chain (EN is the base) =====
  const DEFAULT_LOCALES_CHAIN = () => {
    const docLang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    const appLang = (window.APP_LOCALE || window.CURRENT_LANG || '').toLowerCase();
    const chain = [];
    if (appLang) chain.push(appLang);
    if (docLang && !chain.includes(docLang)) chain.push(docLang);
    if (!chain.includes('en')) chain.push('en'); // base first
    if (!chain.includes('ru')) chain.push('ru'); // fallback
    return chain;
  };

  async function loadLocaleData() {
    const chain = DEFAULT_LOCALES_CHAIN();
    for (const code of chain) {
      try {
        const res = await fetch(`${I18N_PATH}/${code}.json`, { cache: 'no-store' });
        if (res.ok) return await res.json();
      } catch (_) {}
    }
    return null;
  }

  // ===== Open site modal (native styles only) =====
  function openCommentModal(title, html) {
    const wrapped = `<div class="cb-full">${toParagraphs(html || '')}</div>`;
    if (typeof window.openModal === 'function') {
      window.openModal(title, wrapped);
      return;
    }
    // Fallback: использовать штатную разметку модалки без своих тем
    const modal = document.getElementById('modalBackdrop');
    const mTitle = document.getElementById('modalTitle');
    const mBody  = document.getElementById('modalBody');
    if (!modal || !mTitle || !mBody) return;
    mTitle.innerHTML = title || '';
    mBody.innerHTML  = wrapped;
    modal.classList.add('show');
    document.body.classList.add('modal-open');
    document.getElementById('modalClose')?.focus?.();
  }

  // ===== On-page styles only =====
  function injectStylesOnce() {
    if (document.getElementById('comment-block-styles')) return;
    const css = `
      #${MOUNT_ID} { margin: 2.5rem 0; }
      .cb-wrap { display: grid; gap: 1.25rem; align-items: start; }
      @media (min-width: 900px) { .cb-wrap { grid-template-columns: 0.3fr 0.7fr; } }
      .cb-card { background: rgba(0,0,0,0.35); border: 1px solid rgba(148,163,184,.35); border-radius: 16px; padding: 1rem; }
      .cb-img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 16px; box-shadow: 0 6px 20px rgba(0,0,0,.08); }

      /* Краткая версия на странице — как lead-параграф */
      .cb-text { color: #fff; font-size: 1rem; line-height: 1.7; }
      .cb-text p { margin: .75rem 0; text-indent: 1.25em; } /* отступ первой строки + интервалы */

      .cb-actions { margin-top: .9rem; display: flex; flex-wrap: wrap; gap: .5rem .6rem; }
      .cb-btn-main.subnav-btn { } /* берет стиль из меню сайта */
      .cb-link-share {
        display:inline-flex; align-items:center; justify-content:center;
        padding:.5rem 1rem; border-radius: 0.75rem;
        border: 1px solid #374151; background: rgba(17,24,39,.4);
        color:#fff; text-decoration:none; font-size:.875rem;
      }

      /* Типографика ПОЛНОГО текста внутри штатной модалки */
      #modalBody .cb-full p { margin: .9rem 0; text-indent: 1.25em; }
    `;
    const style = document.createElement('style');
    style.id = 'comment-block-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ===== Utilities =====
  function ensureParagraphs(htmlOrText) {
    const s = String(htmlOrText || '').trim();
    if (!s) return '';
    if (/<\s*p[\s>]/i.test(s)) return s; // уже есть <p>
    // одиночный абзац
    return `<p>${s}</p>`;
  }

  function toParagraphs(htmlOrText) {
    let s = String(htmlOrText || '').trim();
    if (!s) return '';
    // если уже размечено <p> — отдаем как есть
    if (/<\s*p[\s>]/i.test(s)) return s;
    // приводим <br> к переводам строки и режем по пустым строкам
    s = s.replace(/<br\s*\/?>/gi, '\n');
    const parts = s.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
    if (parts.length <= 1) return `<p>${s}</p>`;
    return parts.map(p => `<p>${p}</p>`).join('');
  }

  function mount() {
    const root = document.getElementById(MOUNT_ID);
    if (!root || !currentLocaleData) return;

    const imgSrc = currentLocaleData.imgSrc || 'https://archive.org/download/orus-pics/nico.jpg';
    const imgAlt = currentLocaleData.imgAlt || 'Nico';
    const title  = currentLocaleData.title || "Nico’s Comment";
    const short  = ensureParagraphs(currentLocaleData.short || '');
    const full   = currentLocaleData.full  || '';
    const cta    = currentLocaleData.cta   || "Nico’s Comment";

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
              <a class="cb-link-share" href="${IG_URL}" target="_blank" rel="noopener noreferrer">Instagram</a>
              <a class="cb-link-share" href="${TG_URL}" target="_blank" rel="noopener noreferrer">Telegram</a>
            </div>
          </div>
        </div>
      </div>
    `;

    root.querySelector('.cb-open')?.addEventListener('click', () => openCommentModal(title, full));
    renderedOnce = true;
  }

  async function loadAndRender() {
    injectStylesOnce();
    currentLocaleData = await loadLocaleData();
    mount();
  }

  // ===== Re-render on language change; re-mount on SPA DOM changes =====
  function subscribe() {
    document.addEventListener('trus:lang', () => loadAndRender());

    const mo = new MutationObserver(() => {
      const anchor = document.getElementById(MOUNT_ID);
      if (anchor && (!renderedOnce || !anchor.querySelector('.cb-wrap'))) {
        mount();
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ===== Init =====
  function init() {
    loadAndRender();
    subscribe();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
