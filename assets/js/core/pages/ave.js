// /assets/js/core/pages/ave.js
import { $, $$ } from '../dom.js';
import { I18N, onLocaleChanged, getLangFromQuery, applyI18nTo } from '../i18n.js';

/* ---------- локали страницы (/ave/EN.json, /ave/RU.json) ---------- */
async function loadAveLocale(lang){
  const L = (lang || 'EN').toUpperCase();
  async function fetchJson(u){ try{ const r = await fetch(u, { cache:'no-store' }); return r.ok ? r.json() : null; } catch { return null; } }
  let data = await fetchJson(`/ave/${L}.json`);
  if (!data && L !== 'EN') data = await fetchJson(`/ave/EN.json`);
  if (!data) data = {};
  for (const k in data) I18N[k] = data[k];
}

/* ---------- утилита: responsive YouTube ---------- */
function ytEmbed(url, { aspect = '16:9' } = {}){
  const idMatch = String(url||'').match(/(?:v=|\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  const id = idMatch ? idMatch[1] : '';
  const pad = (aspect==='9:16') ? '177.78%' : '56.25%';
  if (!id) return `<div class="yt-wrap" style="padding-top:${pad}"><div class="yt-ph">Video coming soon</div></div>`;
  const src = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
  return `
    <div class="yt-wrap" style="padding-top:${pad}">
      <iframe src="${src}" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>
    </div>`;
}

/* ---------- разметка ---------- */
function mountBase(root){
  const sub = $('#subpage');
  if (sub) sub.classList.add('page--ave');

  root.innerHTML = `
    <!-- Block 1: Intro -->
    <section id="ave-intro">
      <div data-i18n="ave.intro.html"></div>
    </section>

    <!-- Block 2: Documentary -->
    <section id="ave-doc" class="mt-4">
      <h2 class="text-xl font-semibold mb-3" data-i18n="ave.doc.title">Documentary format</h2>
      <div class="mb-3" id="ave-doc-video"></div>
      <div class="rtxt mb-4" data-i18n="ave.doc.desc.html"></div>
      <a class="btn" href="https://therealunrealstory.com/" target="_blank" rel="noopener" data-i18n="ave.doc.btn">Go to the main site</a>
    </section>

    <!-- Block 3: TrustFields -->
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

  // локальные стили
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

    .yt-wrap{ position:relative; width:100%; overflow:hidden; background:#000; border-radius:12px; }
    .yt-wrap iframe{ position:absolute; inset:0; width:100%; height:100%; border:0; }
    .yt-ph{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#aaa; }

    .tf-split{ display:flex; gap:16px; align-items:flex-start }
    .tf-left{ flex:0 0 40% }
    .tf-right{ flex:1 1 auto }
    /* 9:16 контейнер для вертикального ролика */
    #ave-trust .yt-wrap{ border-radius:12px; }
    @media (max-width: 820px){
      .tf-split{ flex-direction:column }
      .tf-left{ flex-basis:auto; flex:1 1 auto }
    }
  `;
  document.head.appendChild(style);
}

/* ---------- init ---------- */
export async function init(root){
  const startLang = getLangFromQuery();
  await loadAveLocale(startLang);

  mountBase(root);
  await applyI18nTo(root);

  // Block 2 video (16:9)
  const docUrl = I18N['ave.doc.youtube'] || 'https://youtu.be/IBqpVuGNE1Q';
  $('#ave-doc-video').innerHTML = ytEmbed(docUrl, { aspect:'16:9' });

  // Block 3 video (9:16) — URL берём из локали (можно поставить shorts/видеоID)
  const tfUrl = I18N['ave.tf.youtube'] || '';
  $('#ave-tf-video').innerHTML = ytEmbed(tfUrl, { aspect:'9:16' });

  // live i18n
  onLocaleChanged(async ({ lang })=>{
    await loadAveLocale(lang);
    await applyI18nTo(root);
    // перерисовать iframes при смене языка (вдруг URL локализован)
    const docUrl2 = I18N['ave.doc.youtube'] || 'https://youtu.be/IBqpVuGNE1Q';
    $('#ave-doc-video').innerHTML = ytEmbed(docUrl2, { aspect:'16:9' });
    const tfUrl2 = I18N['ave.tf.youtube'] || '';
    $('#ave-tf-video').innerHTML = ytEmbed(tfUrl2, { aspect:'9:16' });
  });
}

export function destroy(){
  const sub = $('#subpage');
  if (sub) sub.classList.remove('page--ave');
}
