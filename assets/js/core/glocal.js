// /assets/js/core/glocal.js
// Smart Glocal payment widget launcher (no top-level side effects).
// All heavy deps (i18n, modal, provider assets) are loaded *lazily* when the user clicks Donate.

let _assetsPromise = null;

/**
 * Load provider CSS/JS once.
 * @param {"demo"|"live"} mode
 */
function ensureSmglAssets(mode) {
  if (_assetsPromise) return _assetsPromise;
  _assetsPromise = new Promise((resolve, reject) => {
    try {
      const isDemo = (mode || 'demo') !== 'live';
      const host = isDemo ? 'https://widget-demo.smart-glocal.com' : 'https://widget.smart-glocal.com';

      // CSS
      const cssHref = `${host}/payment-form.css`;
      if (!document.querySelector(`link[href="${cssHref}"]`)) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = cssHref;
        document.head.appendChild(l);
      }

      // JS
      const jsSrc = `${host}/payment-form.js`;
      if (window.SmglPaymentForm) return resolve(); // already loaded
      const existing = document.querySelector(`script[src="${jsSrc}"]`);
      if (existing && existing.getAttribute('data-smgl-loaded') === '1') return resolve();
      const s = existing || document.createElement('script');
      s.src = jsSrc;
      s.defer = true;
      s.setAttribute('data-smgl-loaded', '0');
      s.onload = () => { s.setAttribute('data-smgl-loaded', '1'); resolve(); };
      s.onerror = () => reject(new Error('failed-to-load-smgl-assets'));
      if (!existing) document.head.appendChild(s);
    } catch (e) {
      reject(e);
    }
  });
  return _assetsPromise;
}

export async function openGlocalDonate({ amount, currency='usd', recurrent=false } = {}) {
  // Lazy import UI deps to avoid any side effects on pages that never open the widget.
  const [{ openModal }, { t }] = await Promise.all([
    import('./modal.js'),
    import('./i18n.js')
  ]);

  function showErrorModal(devMessage){
    const title = t('donate.error.title','Donations are temporarily unavailable');
    const html = t('donate.error.body', `
      <div class="space-y-3 text-sm leading-relaxed">
        <p>Sorry — the payment form can’t be opened right now.</p>
        <ul class="list-disc ml-5">
          <li>Configuration is still being finalized, or</li>
          <li>There’s a temporary connection issue.</li>
        </ul>
        <p>Please try again a bit later. Your willingness to support us matters a lot ❤️</p>
        ${devMessage ? `<details class="text-xs opacity-70"><summary>Technical details</summary><pre class="whitespace-pre-wrap">${devMessage}</pre></details>` : ''}
      </div>
    `);
    openModal(title, html);
  }

  try {
    const lang = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const locale = (lang === 'ru' ? 'ru' : 'en');

    // Step 1: token
    const res = await fetch('/api/donate/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: Number.isFinite(amount) ? Number(amount) : undefined,
        currency,
        locale,
        showRecurrent: !!recurrent
      })
    });

    const data = await res.json().catch(()=>({}));
    if (!res.ok || !data?.public_token) {
      const msg = data?.error || `HTTP ${res.status}`;
      showErrorModal(msg);
      return;
    }

    const mode = (data.mode || 'demo').toLowerCase();
    await ensureSmglAssets(mode);
    if (!window.SmglPaymentForm) {
      showErrorModal('SmglPaymentForm is not available after script load');
      return;
    }

    // Step 2: open modal and render
    const containerId = 'smgl-payment-form';
    const title = t('donate.form.title','Support');
    const html = `<div id="${containerId}" class="mt-2"></div>`;
    openModal(title, html);

    const el = document.getElementById(containerId);
    if (!el) {
      showErrorModal('Container not found');
      return;
    }

    const paymentForm = new window.SmglPaymentForm(String(data.public_token), {
      container: el,
      isCvcMasked: true,
      customerInteractionRedirect: { target: '_top' }
    });

    paymentForm.onPaymentFail = function(error){ console.error('SMGL payment fail', error); };

    paymentForm.render();
  } catch (e) {
    showErrorModal(String(e && e.message || e));
  }
}

export default { openGlocalDonate };
