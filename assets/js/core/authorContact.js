// assets/js/core/authorContact.js
import { $, $$ } from './dom.js';
import { onLocaleChanged } from './i18n.js';

const CONTACT_ID = 'nico-contact-line';
const TEXT_HTML = `I’m here and open to talk. WhatsApp: <a href="https://wa.me/393515160791" target="_blank" rel="noopener" class="underline decoration-cyan-500/60 hover:no-underline focus:outline-none focus:ring-2 focus:ring-cyan-500/40">+39 351 516 0791</a>`;

function findAnchor() {
  // Ищем самый первый абзац/заголовок с упоминанием «Nico» (и его вариантов в локалях),
  // чтобы вставить контактную строку сразу под ним.
  const names = ['Nico', 'Нико', 'Nicolás', 'Nicò', 'Nicolas', 'Nikó', 'نيكو', '尼科'];
  const scopes = $$('#main section, section, main, body');
  for (const scope of scopes) {
    const nodes = scope.querySelectorAll('p, h1, h2, h3, div');
    for (const el of nodes) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (names.some(n => txt.includes(n))) return el;
    }
  }
  // Фолбэк: самый верхний параграф
  return $('p, .rtxt p');
}

function inject() {
  if (document.getElementById(CONTACT_ID)) return;
  const anchor = findAnchor();
  if (!anchor) return;

  const p = document.createElement('p');
  p.id = CONTACT_ID;
  p.className = 'mt-3 text-sm md:text-base text-cyan-400/90';
  p.innerHTML = TEXT_HTML;

  anchor.insertAdjacentElement('afterend', p);
}

document.addEventListener('DOMContentLoaded', () => {
  // Даем i18n дорендерить блок — потом вставляем
  setTimeout(inject, 0);
});

// При смене языка некоторые блоки перерисовываются — пере-вставляем при необходимости
onLocaleChanged(() => {
  if (!document.getElementById(CONTACT_ID)) setTimeout(inject, 0);
});
