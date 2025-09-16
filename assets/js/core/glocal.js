// /assets/js/core/glocal.js
// Smart Glocal donor widget launcher with graceful fallbacks.
// Shows clear messages if env/config is missing or network fails.

import { openModal } from './modal.js'; // adjust import path if needed
import { t } from './i18n.js';

// Small helper to load external scripts once
function loadExternalScript(src, attrName){
  return new Promise((resolve, reject)=>{
    if (attrName && document.querySelector(`script[${attrName}]`)) return resolve();
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    if (attrName) s.setAttribute(attrName, 'true');
    s.async = true;
    s.onload = ()=>resolve();
    s.onerror = ()=>reject(new Error('failed-to-load-script'));
    document.head.appendChild(s);
  });
}

function showErrorModal(devMessage){
  const title = t('donate.error.title','Donations are temporarily unavailable');
  const html = t('donate.error.body', `
    <div class="space-y-3 text-sm leading-relaxed">
      <p>Sorry — the payment widget can’t be opened right now.</p>
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

export async function openGlocalDonate({ amount, currency='usd', recurrent=false }={}){
  try {
    const locale = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    const body = {
      amount: Number.isFinite(amount) ? Number(amount) : undefined,
      currency,
      locale,
      showRecurrent: true,
      metadata: recurrent ? 'donation:recurrent' : 'donation:oneoff'
    };

    const res = await fetch('/api/donate/token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(()=>({}));
    if (!res.ok || !data?.public_token) {
      const msg = data?.error || `HTTP ${res.status}`;
      // Visible message for users, details expandable for you
      showErrorModal(msg);
      return;
    }

    const mode = (data.mode || 'demo').toLowerCase();
    const token = data.public_token;

    // Try to load the provider's widget script
    const src = mode === 'live'
      ? 'https://widget.smart-glocal.com/widget.js'
      : 'https://widget-demo.smart-glocal.com/widget.js';

    try {
      await loadExternalScript(src, 'data-smart-glocal');
    } catch (e) {
      showErrorModal('Widget script failed to load');
      return;
    }

    // Try to open the widget via global API.
    // We don't know exact API surface; attempt common shapes to stay resilient.
    const g = window.SmartGlocal || window.smartGlocal || window.GlocalWidget || window.glocalWidget;
    if (g && typeof g.openAcquiringWidget === 'function') {
      g.openAcquiringWidget({
        publicToken: token,
        onSuccess(){ /* optionally show thank you modal */ },
        onClose(){ /* nothing */ }
      });
      return;
    }
    if (g && typeof g.open === 'function') {
      g.open({ publicToken: token });
      return;
    }

    // If we got here, script loaded but there is no known API
    showErrorModal('Widget API not found after script load');
  } catch (e) {
    showErrorModal(String(e && e.message || e));
  }
}

export default { openGlocalDonate };
