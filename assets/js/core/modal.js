// assets/js/core/modal.js
import { $ } from './dom.js';

const modal   = $('#modalBackdrop');
const mTitle  = $('#modalTitle');
const mBody   = $('#modalBody');
const mClose  = $('#modalClose');
const mOk     = $('#modalOk');

let lastFocus = null;

export const openModal = (title, html) => {
  if (!modal) return;
  mTitle.innerHTML = title || '';
  mBody.innerHTML  = html  || '';
  lastFocus = document.activeElement;
  modal.classList.add('show');
  document.body.classList.add('modal-open');
  // фокус внутрь диалога
  const dlg = modal.querySelector('.modal-dialog');
  dlg?.setAttribute('tabindex','-1');
  dlg?.focus();
};

export const closeModal = () => {
  if (!modal) return;
  modal.classList.remove('show');
  document.body.classList.remove('modal-open');
  // вернуть фокус
  try { lastFocus?.focus(); } catch {}
};

mClose?.addEventListener('click', closeModal);
mOk?.addEventListener('click', closeModal);
// закрыть по клику на фон
modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
// закрыть по Esc
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal?.classList.contains('show')) closeModal();
});
