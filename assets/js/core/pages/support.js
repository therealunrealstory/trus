import { $, loadScript } from '../dom.js';
import { t } from '../i18n.js';
import { openModal } from '../modal.js';

// ... остальной код (Leaflet, Splide, карты, сердца, engagement) без изменений

function renderDonateButtons(root, donateCfg) {
  const wrap = root.querySelector('[data-donate-buttons]');
  if (!wrap || !donateCfg) return;
  wrap.innerHTML = '';

  (donateCfg.amounts || []).forEach((amt) => {
    const a = document.createElement('a');
    a.className = 'px-3 py-2 rounded-xl bg-green-600 text-white text-sm';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.href = `${donateCfg.baseUrl}?amount=${encodeURIComponent(amt)}`;
    a.textContent = `$${amt}`;
    wrap.appendChild(a);
  });

  // кнопка "Enter your amount" после $500
  const custom = document.createElement('a');
  custom.className = 'px-3 py-2 rounded-xl bg-green-600 text-white text-sm';
  custom.target = '_blank';
  custom.rel = 'noopener noreferrer';
  custom.href = donateCfg.baseUrl;
  custom.setAttribute('data-i18n', 'btn.donate');
  custom.textContent = t('btn.donate', 'Donate');
  wrap.appendChild(custom);
}

export async function init(root) {
  renderDonateButtons(root, root.__partial?.donate);

  // ... всё остальное из вашего init (карта, сердца, engagement, wantHelp)
}

// destroy() без изменений
