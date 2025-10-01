// /assets/js/core/pages/ave.js
import { $, $$ } from '../dom.js';
import { I18N, onLocaleChanged, getLangFromQuery, applyI18nTo } from '../i18n.js';

/* ====== Block 2: Nico WhatsApp contact (under intro) ====== */
const AVE_CONTACT_ID = 'ave-nico-contact';
function aveContactSection(){
  const p = document.createElement('p');
  p.className = 'indent';
  p.setAttribute('data-i18n','contact.nico.html');
  p.innerHTML = '— <strong>Nico:</strong> I’m here and open to talk. WhatsApp: <a href="https://wa.me/393515160791" target="_blank" rel="noopener" class="underline decoration-cyan-500/60 hover:no-underline focus:ring-2 focus:ring-cyan-500/40">+39 351 516 0791</a>';
  const wrap = document.createElement('div');
  wrap.className = 'rtxt';
  wrap.appendChild(p);
  const sec = document.createElement('section');
  sec.id = AVE_CONTACT_ID;
  sec.appendChild(wrap);
  return sec;
}
function ensureAveContactBlock(){
  const intro = document.getElementById('ave-intro');
  const container = document.getElementById('subpage') || document.querySelector('main') || document.body;
  if (!container) return;
  let sec = document.getElementById(AVE_CONTACT_ID);
  if (!sec) sec = aveContactSection();
  if (intro) {
    intro.insertAdjacentElement('afterend', sec);
  } else {
    const firstSection = container.querySelector('section');
    if (firstSection) firstSection.insertAdjacentElement('afterend', sec);
    else container.appendChild(sec);
  }
  try { applyI18nTo(sec); } catch {}
}
/* ---------------------------------------------------------- */


/* ---------- загрузка локалей (/ave/EN.json, /ave/RU.json, …) ---------- */
async function fetchJson(u){
  try{ const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; }
  catch{ return null; }
}
// Перекрываем только непустыми значениями — пустая строка не убивает EN
function softMergeNonEmpty(target, src){
  if (!src) return target;
  for (const k in src){
    const v = src[k];
    const emptyStr = (typeof v === 'string' && v.trim() === '');
    if (v !== undefined && v !== null && !emptyStr) target[k] = v;
  }
  return target;
}
async function loadAveLocale(lang){
  const L = (lang || 'EN').toUpperCase();
  const base = await fetchJson('/ave/EN.json') || {};
  const local = (L === 'EN') ? {} : (await fetchJson(`/ave/${L}.json`) || {});
  softMergeNonEmpty(I18N, base);
  softMergeNonEmpty(I18N, local);
}

/* ---------- YouTube embed (shorts/watch/youtu.be/embed) ---------- */
function ytEmbed(rawUrl, { aspect = '16:9' } = {}){
  const url = String(rawUrl || '').trim();
  const getId = (u) => {
    if (!u) return '';
    try {
      const Y = new URL(u);
      const host = Y.hostname.replace(/^www\./,'');
      const parts = Y.pathname.split('/').filter(Boolean);
      if (host === 'youtu.be' && parts[0]) return parts[0];                     // youtu.be/<id>
      if (host.endsWith('youtube.com') && parts[0] === 'shorts' && parts[1]) return parts[1]; // /shorts/<id>
      if (host.endsWith('youtube.com') && parts[0] === 'embed'  && parts[1]) return parts[1]; // /embed/<id>
      const v = Y.searchParams.get('v'); if (v) return v;                       // watch?v=<id>
      return parts[parts.length - 1] || '';
    } catch {
      const m = String(u).match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/)([A-Za-z0-9_-]{6,})/);
      return m ? m[1] : '';
    }
  };

  const id = getId(url).replace(/[?#].*$/,'');
  const ar = (aspect === '9:16') ? '9:16' : '16:9';
  if (!id) {
    return `<div class="yt-wrap" data-ar="${ar}"><div class="yt-ph">Video coming soon</div></div>`;
  }

  // важные флаги для мобилок/iOS
  const src = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3`;

  // верт. видео грузим «eager», чтобы не зависало из-за lazy + нулевой высоты
  const loading = (ar === '9:16') ? 'eager' : 'lazy';

  return `
    <div class="yt-wrap" data-ar="${ar}">
      <iframe
        src="${src}"
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen
        loading="${loading}"
        referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>`;
}

/* ---------- разметка ---------- */
function mountBase(root){
  const sub = $('#subpage');
  if (sub) sub.classList.add('page--ave');

  const authorImg = I18N['ave.intro.img'] || 'https://archive.org/download/orus-pics/nico.jpg';
  const authorAlt = I18N['ave.intro.imgAlt'] || 'Nico';

  root.innerHTML = `
    <!-- Block 1: Intro + author photo -->
    <section id="ave-intro">
      <div class="intro-split">
        <div class="intro-left">
          <div class="intro-img-wrap">
            <img src="${authorImg}" alt="${authorAlt}" loading="lazy" decoding="async">
          </div>
        </div>
        <div class="intro-right">
          <div data-i18n="ave.intro.html"></div>
        </div>
      </div>
    </section>

    <!-- Block 2: Documentary 16:9 -->
    <section id="ave-doc" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="ave.doc.title">Documentary format</h2>
      <div class="mb-3" id="ave-doc-video"></div>
      <div class="rtxt mb-4" data-i18n="ave.doc.desc.html"></div>
      <a class="btn" href="https://therealunrealstory.com/" target="_blank" rel="noopener" data-i18n="ave.doc.btn">Go to the main site</a>
    </section>

    <!-- Block 3: TrustFields 9:16 + текст -->
    <section id="ave-trust" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="ave.tf.title">TrustFields — reimagining</h2>
      <div class="tf-split">
        <div class="tf-left">
          <div id="ave-tf-video"></div>
        </div>
        <div class="tf-right">
          <div class="rtxt mb-4" data-i18n="ave.tf.text.html"></div>
          <a class="btn" href="https://therealunrealstory.com/#/trustfields" target="_blank" rel="noopener" data-i18n="ave.tf.btn">Open TrustFields page</a>
        </div>
      </div>
    </section>
  `;

  // локальные стили (aspect-ratio + фолбэк на padding-top)
  const style = document.createElement('style');
  style.textContent = `
    .page--ave section{
      background:rgba(0,0,0,0.2); border-radius:1rem; padding:1rem; border:1px solid rgba(255,255,255,.12)
    }
    .rtxt p{ margin:0 0 .9em; line-height:1.66 }
    .rtxt .indent{ text-indent:1.25em }

    .btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px;
      padding:.6rem 1rem; border-radius:.8rem; border:1px solid rgba(99,102,241,.35);
      background:rgba(99,102,241,.12); color:#c7d2fe; text-decoration:none; font-weight:600;
    }
    .btn:hover{ background:rgba(99,102,241,.2) }

    /* Intro: фото автора слева (30%) / текст справа */
    .intro-split{ display:flex; gap:16px; align-items:flex-start }
    .intro-left{ flex:0 0 30% }
    .intro-right{ flex:1 1 auto }
    .intro-img-wrap{ width:100%; overflow:hidden; border-radius:16px; border:1px solid rgba(148,163,184,.35); background:rgba(0,0,0,.25) }
    .intro-img-wrap img{ display:block; width:100%; height:auto; object-fit:cover }

    /* TrustFields split */
    .tf-split{ display:flex; gap:16px; align-items:flex-start }
    .tf-left{ flex:0 0 40% }   /* видео 9:16 слева на 40% ширины на десктопе */
    .tf-right{ flex:1 1 auto }

    /* Универсальный контейнер под iframe: aspect-ratio с фолбэком */
    .yt-wrap{ position:relative; width:100%; overflow:hidden; background:#000; border-radius:12px; }
    .yt-wrap iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; display:block; }

    /* Фолбэк на старые вебвью: создаём высоту паддингом через ::before */
    .yt-wrap::before{ content:''; display:block; padding-top:56.25%; }        /* 16:9 по умолчанию */
    .yt-wrap[data-ar="9:16"]::before{ padding-top:177.78%; }                  /* 9:16 */
    @supports (aspect-ratio: 1 / 1){
      .yt-wrap{ aspect-ratio: 16 / 9; }
      .yt-wrap[data-ar="9:16"]{ aspect-ratio: 9 / 16; }
      .yt-wrap::before{ content:none; padding-top:0; }
    }

    /* Минимальная высота вертикального видео на мобиле, чтобы не схлопывалось до 0 при странных вебвью */
    #ave-trust .yt-wrap{ min-height: 300px; }

    @media (max-width: 820px){
      .intro-split{ flex-direction:column }
      .intro-left{ flex-basis:auto }
      .tf-split{ flex-direction:column }
	  /* ключевые строки ↓ — на мобиле видео и текст на всю ширину */
	  .tf-left, .tf-right{ flex:0 0 auto; width:100% }
      #ave-trust .yt-wrap{ min-height: 260px; }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- init/destroy ---------- */
export async function init(root){
  const startLang = getLangFromQuery();
  await loadAveLocale(startLang);

  mountBase(root);
  await applyI18nTo(root);
    ensureAveContactBlock();

  // Insert WhatsApp contact block under intro
  ensureAveContactBlock();

  // Блок 2 — 16:9
  const docUrl = (I18N['ave.doc.youtube'] || 'https://youtu.be/IBqpVuGNE1Q').trim();
  $('#ave-doc-video').innerHTML = ytEmbed(docUrl, { aspect:'16:9' });

  // Блок 3 — 9:16
  const tfUrl = (I18N['ave.tf.youtube'] || '').trim();
  $('#ave-tf-video').innerHTML = ytEmbed(tfUrl, { aspect:'9:16' });

  // смена языка на лету
  onLocaleChanged(async ({ lang })=>{
    await loadAveLocale(lang);
    await applyI18nTo(root);
    const doc2 = (I18N['ave.doc.youtube'] || 'https://youtu.be/IBqpVuGNE1Q').trim();
    $('#ave-doc-video').innerHTML = ytEmbed(doc2, { aspect:'16:9' });
    const tf2 = (I18N['ave.tf.youtube'] || '').trim();
    $('#ave-tf-video').innerHTML = ytEmbed(tf2, { aspect:'9:16' });
  });
}

export function destroy(){
  const sub = $('#subpage');
  if (sub) sub.classList.remove('page--ave');
}
