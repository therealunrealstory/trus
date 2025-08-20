import { $ } from './dom.js';

const modal   = $('#modalBackdrop');
const mTitle  = $('#modalTitle');
const mBody   = $('#modalBody');

export const openModal = (title, html) => {
  mTitle.innerHTML = title;
  mBody.innerHTML = html;
  modal.classList.add('show');
};
export const closeModal = () => modal.classList.remove('show');

$('#modalClose')?.addEventListener('click', closeModal);
$('#modalOk')?.addEventListener('click', closeModal);
modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });
