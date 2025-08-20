// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const donateURL = "https://www.gofundme.com/f/your-campaign-slug";

// dynamic script loader
function loadScript(src) {
  return new Promise((res, rej) => {
    if ($(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ---------- intersection observer ----------
function ioObserve(el, fn, opts={ rootMargin:'150px' }) {
  if (!('IntersectionObserver' in window) || !el) { fn(); return; }
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ fn(); io.disconnect(); } });
  }, opts);
  io.observe(el);
}

// ---------- language / i18n ----------
const LOCALE_DIRS = { AR:"rtl", CN:"ltr", DE:"ltr", EN:"ltr", ES:"ltr", FR:"ltr", IT:"ltr", PT:"ltr", RU:"ltr" };
let I18N = {};
const DEFAULT_I18N = {}; // capture defaults from DOM once
(function captureDefaultI18n(){
  $$("[data-i18n]").forEach(el => { const k = el.getAttribute("data-i18n"); if (!(k in DEFAULT_I18N)) DEFAULT_I18N[k] = el.innerHTML; });
  $$("[data-i18n-placeholder]").forEach(el => { const k = el.getAttribute("data-i18n-placeholder"); if (!(k in DEFAULT_I18N)) DEFAULT_I18N[k] = el.getAttribute("placeholder") || ""; });
})();
function t(key, fallback){ return (I18N && I18N[key]) ?? DEFAULT_I18N[key] ?? fallback; }

function getLangFromQuery() {
  try {
    const u = new URL(location.href);
    const p = (u.searchParams.get('lang') || '').toUpperCase();
    const ok = ['EN','ES','FR','IT','DE','PT','RU','CN','AR'];
    return ok.includes(p) ? p : null;
  } catch { return null; }
}

async function fetchLocaleJson(lang){
  try { const r1 = await fetch(`i18n/${lang}.json`, { cache: 'no-store' }); if (r1.ok) return await r1.json(); } catch {}
  try { const r2 = await fetch(`/i18n/${lang}.json`, { cache: 'no-store' }); if (r2.ok) return await r2.json(); } catch {}
  return null;
}

async function loadLocale(lang) {
  try {
    const data = await fetchLocaleJson(lang);
    I18N = data || {}; window.I18N = I18N;
  } catch { I18N = {}; window.I18N = {}; }

  // dir
  const dir = LOCALE_DIRS[lang] || 'ltr';
  document.documentElement.setAttribute('dir', dir);
  document.documentElement.setAttribute('lang', lang.toLowerCase());

  // apply
  $$("[data-i18n]").forEach(el => {
    const k = el.getAttribute("data-i18n");
    const v = t(k, el.innerHTML);
    if (v != null) el.innerHTML = v;
  });
  $$("[data-i18n-placeholder]").forEach(el => {
    const k = el.getAttribute("data-i18n-placeholder");
    const v = t(k, el.getAttribute("placeholder") || "");
    if (v != null) el.setAttribute("placeholder", v);
  });

  // update audio labels if something playing
  updateAudioLabels();
  updateMiniLabels(lang);
  if (!bgAudio.paused)        setMainAudioForLang(lang, true);
  if (!announceAudio.paused)  setAnnouncementForLang(lang, true);
  if (!shortAudio.paused)     setShortForLang(lang, true);
}

// ---------- hashtag typing ----------
(function initHashtag() {
  const el = $('#hashtagType'); const btn = $('#hashtagBtn');
  if (!el || !btn) return;
  const TEXT = '#TheRealUnrealStory'; let i = 0, dir = 1;
  const typeDelay = 90, eraseDelay = 45, pause = 900;
  (function step(){
    el.textContent = TEXT.slice(0, i);
    if (dir > 0) { if (i < TEXT.length) { i++; setTimeout(step, typeDelay); } else { setTimeout(()=>{dir=-1; step();}, pause); } }
    else { if (i > 0) { i--; setTimeout(step, eraseDelay); } else { setTimeout(()=>{dir=1; step();}, pause); } }
  })();
  btn.addEventListener('click', () => openModal(
    t('hashtag.title', '#TheRealUnrealStory'),
    t('hashtag.body', `Thank you for using <b>#TheRealUnrealStory</b>…`)
  ));
})();

// ---------- modal ----------
const modal = $('#modalBackdrop'), mTitle = $('#modalTitle'), mBody = $('#modalBody');
const openModal = (title, html)=>{ mTitle.innerHTML = title; mBody.innerHTML = html; modal.classList.add('show'); };
const closeModal=()=> modal.classList.remove('show');
$('#modalClose').onclick=closeModal; $('#modalOk').onclick=closeModal;
modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });

// ---------- overlay tiles ----------
(function initTiles(){
  const map = {
    tile1: { titleKey: 'tiles.me', bodyKey: 'tiles.meBody', fallbackTitle: 'I’m Nico', fallback: 'Hi! I’m Nico…' },
    tile2: { titleKey: 'tiles.about', bodyKey: 'tiles.aboutBody', fallbackTitle: 'About Adam', fallback: 'A few words about Adam…' },
    tile3: { titleKey: 'tiles.others', bodyKey: 'tiles.othersBody', fallbackTitle: 'Other people', fallback: '…and about other people in our story.' },
  };
  Object.keys(map).forEach(id=>{
    const el = $('#'+id); if (!el) return;
    el.addEventListener('click', ()=> openModal(
      t(map[id].titleKey, map[id].fallbackTitle),
      t(map[id].bodyKey, map[id].fallback)
    ));
  });
})();

// ---------- audio ----------
const bgAudio = $('#bgAudio');
const audioBtn = $('#audioBtn');
const announceAudio = $('#announceAudio');
const announceBtn = $('#announceBtn');
const announceStatus = $('#announceStatus');
const shortAudio = $('#shortAudio');
const shortBtn   = $('#shortBtn');
const shortStatus= $('#shortStatus');
const langSelect = $('#lang');

function updateAudioLabels(){
  if (audioBtn)    audioBtn.textContent    = bgAudio.paused     ? (I18N["audio.play"]    || "Story in music") : (I18N["audio.pause"]   || "‖ Pause");
}
function updateMiniLabels(lang){
  if (announceBtn) announceBtn.textContent = announceAudio.paused? (I18N["announce.play"] || "▶︎ Play") : (I18N["announce.pause"] || "‖ Pause");
  if (announceStatus) announceStatus.textContent = (I18N["announce.langLabel"] || "Language: ") + (lang || langSelect.value);
  if (shortBtn)   shortBtn.textContent     = shortAudio.paused  ? (I18N["short.play"]    || "▶︎ Play") : (I18N["short.pause"] || "‖ Pause");
  if (shortStatus)shortStatus.textContent  = (I18N["short.langLabel"] || DEFAULT_I18N["short.langLabel"] || "Language: ") + (lang || langSelect.value);
}

function pauseOthers(except){
  [bgAudio, announceAudio, shortAudio].forEach(a => {
    if (a !== except && !a.paused) a.pause();
  });
  updateAudioLabels(); updateMiniLabels();
}

function setMainAudioForLang(l, autoplay=false){
  const src = `audio/ORUS-${l}.mp3`;
  if (bgAudio.src.endsWith(src)) { if (autoplay && bgAudio.paused) bgAudio.play().catch(()=>{}); return; }
  bgAudio.pause();
  bgAudio.src = src;
  if (autoplay) bgAudio.play().catch(()=>{});
}
function setAnnouncementForLang(l, autoplay=false){
  const src = `audio/ANN-${l}.mp3`;
  if (announceAudio.src.endsWith(src)) { if (autoplay && announceAudio.paused) announceAudio.play().catch(()=>{}); return; }
  announceAudio.pause();
  announceAudio.src = src;
  if (autoplay) announceAudio.play().catch(()=>{});
}
function setShortForLang(l, autoplay=false){
  const src = `audio/SHORT-${l}.mp3`;
  if (shortAudio.src.endsWith(src)) { if (autoplay && shortAudio.paused) shortAudio.play().catch(()=>{}); return; }
  shortAudio.pause();
  shortAudio.src = src;
  if (autoplay) shortAudio.play().catch(()=>{});
}

// main audio
audioBtn?.addEventListener('click', async ()=>{
  try{
    if (bgAudio.paused) { pauseOthers(bgAudio); setMainAudioForLang(langSelect.value, true); }
    else { bgAudio.pause(); }
  }catch{}
  updateAudioLabels();
});

// mini audios
announceBtn?.addEventListener('click', async ()=>{
  try{
    if (announceAudio.paused) { pauseOthers(announceAudio); setAnnouncementForLang(langSelect.value, true); }
    else { announceAudio.pause(); }
  }catch{}
  updateMiniLabels();
});
shortBtn?.addEventListener('click', async ()=>{
  try{
    if (shortAudio.paused) { pauseOthers(shortAudio); setShortForLang(langSelect.value, true); }
    else { shortAudio.pause(); }
  }catch{}
  updateMiniLabels();
});

// lang select
langSelect?.addEventListener('change', async ()=>{
  const l = langSelect.value;
  const url = new URL(location.href);
  url.searchParams.set('lang', l);
  history.replaceState(null, '', url.toString());
  await loadLocale(l);
});

// on load: set locale
(async ()=>{
  const l = getLangFromQuery() || 'EN';
  await loadLocale(l);
  langSelect.value = l;
})();

// ---------- PWA prompt ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  $('#installBtn')?.classList.remove('hidden');
});
window.addEventListener('appinstalled', ()=> $('#installBtn')?.classList.add('hidden'));
if (window.matchMedia('(display-mode: standalone)').matches) $('#installBtn')?.classList.add('hidden');
$('#installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === 'accepted') {
    openModal(t('pwa.installedTitle','Installed'), t('pwa.installedBody','The app has been added to your Home screen / app list.'));
  }
  deferredPrompt = null;
});

// ---------- Telegram feed ----------
async function renderTgFeed(){
  try{
    const box=$('#tgFeed');
    box.innerHTML = `<div class="text-sm text-gray-300">${t("feed.loading","Loading news…")}</div>`;
    const res=await fetch('/.netlify/functions/news?limit=30',{cache:'no-store'});
    if(!res.ok) throw new Error('news API '+res.status);
    const arr=await res.json();
    if(!Array.isArray(arr)||!arr.length){ box.innerHTML=`<div class="text-sm text-gray-300">${t("feed.empty","No posts yet.")}</div>`; return; }
    box.innerHTML=arr.map(p=>{
      const dt=p.date?new Date(p.date):null, time=dt?dt.toLocaleString():'';
      const link=p.link?`<a href="${p.link}" target="_blank" class="text-sky-400">${t("feed.openTelegram","Open in Telegram")}</a>`:'';
      const text=(p.text||'').replace(/\n/g,'<br>');
      const _img = (p.media_type==='photo' && p.media_path) ? `/.netlify/functions/tg-file?path=${encodeURIComponent(p.media_path)}` : null;
      const mediaHtml = _img
        ? `<img src="${_img}" alt="" class="mt-2 rounded-xl border border-gray-700 bg-black/30 max-h-52 sm:max-h-52 w-auto object-contain block cursor-zoom-in"
             onclick="document.dispatchEvent(new CustomEvent('openImage',{detail:'${_img}'}))">`
        : '';
      return `<article class="mb-4 p-3 rounded-xl bg-gray-900/50 border border-gray-700">
                <div class="text-xs text-gray-300 mb-2">${time}${link?` · ${link}`:''}</div>
                ${text ? `<div class="text-sm leading-relaxed">${text}</div>` : ''}
                ${mediaHtml}
              </article>`;
    }).join('');
  }catch(e){
    console.error(e); $('#tgFeed').innerHTML=`<div class="text-sm text-red-400">${t("feed.error","Failed to load news.")}</div>`;
  }
}
document.addEventListener('openImage', (e)=> openModal('', `<img src="${e.detail}" class="w-full h-auto rounded-xl">`));
renderTgFeed();

// ---------- Lazy init: Map (Leaflet) ----------
let LMap = null, map = null, layer = null, selectedLatLng=null, previewMarker=null;
async function ensureLeaflet() {
  if (window.L) return;
  await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
}
async function initMapOnce(){
  if (map) return;
  await ensureLeaflet();
  LMap = window.L;
  map = LMap.map('map', { zoomControl: true }).setView([51.1, 10.45], 4);
  LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap' }).addTo(map);
  layer = LMap.layerGroup().addTo(map);

  // click to preview
  map.on('click', (e)=>{
    selectedLatLng = e.latlng;
    if (!previewMarker) previewMarker = LMap.marker(selectedLatLng).addTo(map);
    else previewMarker.setLatLng(selectedLatLng);
  });

  await loadAllMarksPaged();
}
ioObserve($('#map'), initMapOnce);

// locate button
$('#locateBtn')?.addEventListener('click', async ()=>{
  try{
    $('#locateBtn').disabled = true; $('#locateBtn').textContent = t('map.locating','Locating…');
    await ensureLeaflet();
    map ??= LMap.map('map', { zoomControl: true }).setView([51.1, 10.45], 4);
    navigator.geolocation.getCurrentPosition(pos=>{
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 10);
      selectedLatLng = { lat: latitude, lng: longitude };
      if (!previewMarker) previewMarker = LMap.marker(selectedLatLng).addTo(map);
      else previewMarker.setLatLng(selectedLatLng);
      $('#locateBtn').textContent = t('map.locateMe','Show my location');
      $('#locateBtn').disabled = false;
    }, ()=>{
      alert(t('map.geoError',"Couldn't get your location. Please try again."));
      $('#locateBtn').textContent = t('map.locateMe','Show my location');
      $('#locateBtn').disabled = false;
    });
  }catch{
    $('#locateBtn').textContent = t('map.locateMe','Show my location');
    $('#locateBtn').disabled = false;
  }
});

// marks API (paged)
function setMarksCount(n){ const el=$('#marksCount'); if(el) el.textContent=Number.isFinite(n)?String(n):'0'; }
let marksOffset = 0;
const marksPageSize = 500;
async function fetchMarksPage() {
  const r = await fetch(`/.netlify/functions/marks?limit=${marksPageSize}&offset=${marksOffset}`, { cache: 'no-store' });
  const chunk = await r.json();
  return Array.isArray(chunk) ? chunk : [];
}
function drawMarksBatch(points, batch=300) {
  let i = 0;
  (function step() {
    const end = Math.min(i + batch, points.length);
    for (; i < end; i++) {
      const m = points[i];
      const lat = Number(m.lat), lon = Number(m.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      LMap.circleMarker([lat, lon], { radius:4, color:'lime' })
        .bindPopup(`<b>${m.name||'Anon'}</b><br>${m.message||''}`)
        .addTo(layer);
    }
    if (i < points.length) requestAnimationFrame(step);
  })();
}
async function loadAllMarksPaged() {
  layer.clearLayers();
  let total = 0;
  while (true) {
    const chunk = await fetchMarksPage();
    if (!chunk.length) break;
    total += chunk.length;
    drawMarksBatch(chunk);
    marksOffset += marksPageSize;
  }
  setMarksCount(total);
}

// add mark
$('#addMark')?.addEventListener('click', async ()=>{
  const name = ($('#name')?.value || '').trim();
  const message = ($('#msg')?.value || '').trim();
  if (!selectedLatLng) { alert('Click on the map to select a place.'); return; }
  await fetch('/.netlify/functions/marks', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ name, message, lat:selectedLatLng.lat, lon:selectedLatLng.lng }) });
  await loadAllMarksPaged();
});

// ---------- Hearts (Splide) ----------
let allHearts = []; let heartsOffset = 0;
async function ensureSplide(){ if (window.Splide) return; await loadScript('https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js'); }
async function loadMoreHearts(){
  const btn = $('#loadMoreHearts');
  if (!btn) return;
  btn.setAttribute('disabled','true'); btn.classList.add('opacity-50','cursor-not-allowed');
  const res = await fetch(`/.netlify/functions/hearts?offset=${heartsOffset}&limit=30`, { cache:'no-store' });
  const arr = await res.json();
  if (!Array.isArray(arr) || !arr.length){ return; }
  allHearts = allHearts.concat(arr);
  heartsOffset += arr.length;
  const ul = $('#heartsSlides');
  for (const h of arr) {
    const li = document.createElement('li'); li.className='splide__slide';
    li.innerHTML = `<div class="px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-700"><div class="text-xs text-gray-400">${h.date||''}</div><div class="text-sm">${h.name||'Anon'}</div></div>`;
    ul.appendChild(li);
  }
  await ensureSplide();
  if (!window.__hearts) {
    window.__hearts = new Splide('#heartsSplide', { perPage: 2, gap: '10px', pagination: true, arrows: false, autoplay: true, interval: 4000, breakpoints: { 768: { perPage: 1 } } }).mount();
  } else {
    window.__hearts.refresh();
  }
  btn.removeAttribute('disabled'); btn.classList.remove('opacity-50','cursor-not-allowed');
}
ioObserve($('#heartsSplide'), async ()=>{ await ensureSplide(); loadMoreHearts(); });
$('#loadMoreHearts')?.addEventListener('click', loadMoreHearts);
$('#addHeart').addEventListener('click', async ()=>{
  await ensureSplide();
  const inp=$('#heartName'); const name=(inp.value||'').trim();
  await fetch('/.netlify/functions/hearts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});
  inp.value='';
  allHearts = []; heartsOffset = 0;
  const btn = $('#loadMoreHearts');
  btn?.removeAttribute('disabled'); btn?.classList.remove('opacity-50','cursor-not-allowed');
  loadMoreHearts();
});

// ===== TRUS: Story/Live routing (minimal, non-invasive) =====
(function(){
  function show(mode){
    const story = document.getElementById('story');
    const live  = document.getElementById('live');
    if (!story || !live) return;
    if (mode === 'live') {
      story.classList.add('hidden');
      live.classList.remove('hidden');
      localStorage.setItem('trus:lastMode','live');
    } else {
      live.classList.add('hidden');
      story.classList.remove('hidden');
      localStorage.setItem('trus:lastMode','story');
    }
  }
  function onHashChange(){
    const h = (location.hash || '#story').toLowerCase();
    if (h.startsWith('#live')) {
      show('live');
      const id = h.slice(1);
      if (id !== 'live') setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'}), 30);
    } else {
      show('story');
      const id = h.slice(1);
      if (id && id !== 'story') setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'}), 30);
    }
  }

  // AMA (local-only placeholder)
  function setupAMA(){
    const form = document.getElementById('amaForm');
    const feed = document.getElementById('amaFeed');
    if (!form || !feed) return;
    const KEY = 'trus:ama';
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');

    function render(){
      feed.innerHTML = '';
      list.slice().reverse().forEach(item => {
        const el = document.createElement('div');
        el.className = 'p-3 rounded-xl bg-gray-900/50 border border-gray-700';
        el.innerHTML = '<div class="text-xs text-gray-300 mb-2">'+item.date+'</div><p class="text-sm"><b>'+(item.name||'Anon')+':</b> '+item.question+'</p>';
        feed.appendChild(el);
      });
    }
    render();

    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const fd = new FormData(form);
      const name = (fd.get('name')||'').toString().trim();
      const question = (fd.get('question')||'').toString().trim();
      if (!question) return;
      const now = new Date();
      list.push({ name, question, date: now.toISOString().slice(0,10) });
      localStorage.setItem(KEY, JSON.stringify(list));
      form.reset();
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if (!location.hash) {
      const last = localStorage.getItem('trus:lastMode');
      if (last) location.hash = '#'+last;
    }
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    setupAMA();
  });
})();
