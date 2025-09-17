// assets/js/core/glocal.js
import { openModal } from './modal.js';
import { t } from './i18n.js';

function loadWidgetAssets(mode="demo"){
  const head = document.head;
  const host = mode === "live" ? "https://widget.smart-glocal.com" : "https://widget-demo.smart-glocal.com";
  if (!document.querySelector(`link[data-smgl]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${host}/payment-form.css`;
    link.setAttribute('data-smgl','');
    head.appendChild(link);
  }
  return new Promise((resolve)=>{
    if (window.SmglPaymentForm) return resolve();
    const sc = document.createElement('script');
    sc.src = `${host}/payment-form.js`;
    sc.defer = true;
    sc.onload = ()=> resolve();
    sc.onerror = ()=> resolve(); // чтобы не зависнуть
    head.appendChild(sc);
  });
}

/**
 * Открыть модалку доната и отрендерить виджет
 * @param {Object} opts { amount, currency, locale, recurrent }
 */
export async function openGlocalDonate(opts={}){
  // Пауза медиаплееров / чтения — как делаете в reader.js
  document.dispatchEvent(new CustomEvent('pause-others', { detail: 'donate' }));

  // 1) запрашиваем токен с сервера
  const resp = await fetch('/.netlify/functions/glocal-token', {
    method: 'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify({
      amount: opts.amount,           // например 10.00
      currency: opts.currency || 'usd',
      locale: (document.documentElement.getAttribute('lang')||'en').split('-')[0].toLowerCase(),
      showRecurrent: !!opts.recurrent,
      metadata: opts.metadata || 'donation'
    })
  }).then(r=> r.json());

  if (!resp?.public_token) {
    openModal(t('donate.error','Donation error'), `<div class="text-red-300">${t('donate.trylater','Please try again later.')}</div>`);
    return;
  }

  // 2) модалка с контейнером
  openModal(t('donate.title','Donate securely'), `
    <div id="smglPaymentWrap">
      <div id="smgl-payment-form"></div>
    </div>
  `);

  // 3) подгружаем ассеты виджета (demo/live)
  await loadWidgetAssets(resp.mode);

  if (!window.SmglPaymentForm) {
    document.getElementById('smglPaymentWrap').innerHTML =
      `<div class="text-red-300">${t('donate.error','Failed to load payment form.')}</div>`;
    return;
  }

  // 4) инициализация виджета
  const pf = new window.SmglPaymentForm(resp.public_token, {
    container: document.getElementById('smgl-payment-form'),
    isCvcMasked: true,
    customerInteractionRedirect: { target: '_blank' }, // 3DS лучше открывать вне фреймов
    // Кастомизация текстов UI (ошибки всё равно прилетают на англ. от провайдера)
    // Можно собрать из вашего i18n:
    texts: {
      paymentForm: {
        buttonPayLabel: t('donate.pay','Pay'),
        cardholderLabel: t('donate.cardholder','Cardholder'),
        cardNumberLabel: t('donate.cardnumber','Card number'),
        cvvLabel: t('donate.cvc','CVC'),
        expireDateLabel: t('donate.expiry','Expiration date'),
        recurrentLabel: t('donate.recurring','I agree to recurrent payments'),
        termsAgreement: t('donate.terms','By pressing Pay, you accept the terms of our {{#link}}user agreement{{/link}}')
      }
    }
  });

  pf.onReady = ()=> { /* метрика: виджет готов */ };
  pf.onPaymentStart = ()=> { /* метрика: старт */ };
  pf.onPaymentSuccess = ()=> {
    // Покажем спасибо и закроем модалку
    document.getElementById('smgl-payment-form').innerHTML =
      `<div class="p-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10">
        ${t('donate.success','Thank you! Payment success.')}
      </div>`;
  };
  pf.onPaymentFail = (err)=> {
    console.warn('payment.fail', err);
  };

  pf.render(); // рендер формы
}
