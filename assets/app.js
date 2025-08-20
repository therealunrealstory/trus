// ---------- helpers ----------
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- dynamic script loader ----------
function loadScript(src) {
  return new Promise((res, rej) => {
    if ($(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ---------- i18n ----------
const LOCALE_DIRS = { AR:"rtl", CN:"ltr", DE:"ltr", EN:"ltr", ES:"ltr", FR:"ltr", IT:"ltr", PT:"ltr", RU:"ltr" };
let I18N = {};
const DEFAULT_I18N = {};
(function captureDefaultI18n(){
  $$("[data-i18n]").forEach(el => { const k = el.getAttribute("data-i18n"); if (!(k in DEFAULT_I18N)) DEFAULT_I18N[k] = el.innerHTML; });
  $$("[data-i18n-placeholder]").forEach(el => { const k = el.getAttribute("data-i18n-placeholder"); if (!(k in DEFAULT_I18N)) DEFAULT_I18N[k] = el.getAttribute("placeholder") || ""; });
})();
function t(key, fallback){ return (I18N && I18N[key]) ?? DEFAULT_I18N[key] ?? fallback; }
function applyI18nTo(root){
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.innerHTML = val;
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.setAttribute('placeholder', val);
  });
}
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
  try { I18N = (await fetchLocaleJson(lang)) || {}; } catch { I18N = {}; }
  window.I18N = I18N;

  document.documentElement.lang = (lang || 'en').toLowerCase();
  document.documentElement.dir  = LOCALE_DIRS[lang] || 'ltr';

  const titleRest = I18N["meta.titleRest"] || DEFAULT_I18N["hero.titleRest"] || "support for Adam";
  document.title = `The Real Unreal Story — ${titleRest}`;

  if (I18N["meta.description"]) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); }
    m.setAttribute('content', I18N["meta.description"]);
  }

  // apply to whole page (header/footer etc.)
  applyI18nTo(document);

  // update audio labels to current language
  updateAudioLabels();

  // if a subpage is mounted, re-apply i18n only to it
  if (subpageEl && subpageEl.firstChild) applyI18nTo(subpageEl);

  // maintain currently playing language-specific audios
  if (!bgAudio.paused) setMainAudioForLang(lang, true);
  if (currentRoute === 'story') {
    if (!announceAudio.paused)  setAnnouncementForLang(lang, true);
    if (!shortAudio.paused)     setShortForLang(lang, true);
  }
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

// ---------- GLOBAL audio controls ----------
const bgAudio = $('#bgAudio');
const audioBtn = $('#audioBtn');
const langSelect = $('#lang');
function updateAudioLabels(){
  if (audioBtn) audioBtn.textContent = bgAudio.paused
    ? (I18N["audio.play"] || DEFAULT_I18N["audio.play"] || "Story in music")
    : (I18N["audio.pause"] || "‖ Pause");
}
function setMainAudioForLang(l, autoplay=false){
  const src = `audio/ORUS-${l}.mp3`;
  if (bgAudio.src.endsWith(src)) { if (autoplay && bgAudio.paused) bgAudio.play().catch(()=>{}); return; }
  bgAudio.pause(); bgAudio.src = src; if (autoplay) bgAudio.play().catch(()=>{});
}
audioBtn.addEventListener('click', async ()=>{
  if (bgAudio.paused){ setMainAudioForLang(langSelect.value, true); pauseOthers(bgAudio); } else { bgAudio.pause(); }
  updateAudioLabels();
});

// ---------- language init ----------
const fromQuery = getLangFromQuery();
const initialLang = fromQuery || localStorage.getItem('site_lang') || 'EN';
langSelect.value = initialLang;
localStorage.setItem('site_lang', initialLang);
if (fromQuery) {
  const u = new URL(location.href); u.searchParams.delete('lang'); history.replaceState({}, '', u);
}
langSelect.addEventListener('change', e => {
  const l = e.target.value;
  localStorage.setItem('site_lang', l);
  const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState({}, '', u);
  loadLocale(l);
  if (!bgAudio.paused) setMainAudioForLang(l, true);
});

// ---------- PWA install ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn')?.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => $('#installBtn')?.classList.add('hidden'));
if (window.matchMedia('(display-mode: standalone)').matches) $('#installBtn')?.addClass?.('hidden');
$('#installBtn')?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
});

// ---------- SUBPAGES ROUTER ----------
const ROUTES = {
  story:   'partials/story.json',
  support: 'partials/support.json',
  now:     'partials/now.json'
};
const subpageEl = $('#subpage');
const navButtons = $$('.subnav-btn');
navButtons.forEach(btn => {
  const key = btn.getAttribute('data-i18n');
  if (key === 'menu.story') btn.dataset.route = 'story';
  if (key === 'menu.support') btn.dataset.route = 'support';
  if (key === 'menu.storyNow') btn.dataset.route = 'now';
});
let currentRoute = null;

function setActiveButton(route){
  navButtons.forEach(b=>{
    const on = b.dataset.route === route;
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
}

// ---------- page-level audio helpers used in subpages ----------
let announceAudio = new Audio();
let shortAudio = new Audio();
let announceBtn = null, shortBtn = null, announceStatus = null, shortStatus = null;

function updateMiniLabels(lang){
  if (announceBtn) announceBtn.textContent = announceAudio.paused ? (I18N["announce.play"] || DEFAULT_I18N["announce.play"] || "▶︎ Play") : (I18N["announce.pause"] || "‖ Pause");
  if (announceStatus) announceStatus.textContent = (I18N["announce.langLabel"] || DEFAULT_I18N["announce.langLabel"] || "Language: ") + (lang || langSelect.value);
  if (shortBtn) shortBtn.textContent = shortAudio.paused ? (I18N["short.play"] || DEFAULT_I18N["short.play"] || "▶︎ Play") : (I18N["short.pause"] || "‖ Pause");
  if (shortStatus) shortStatus.textContent = (I18N["short.langLabel"] || DEFAULT_I18N["short.langLabel"] || "Language: ") + (lang || langSelect.value);
}
function setAnnouncementForLang(l, autoplay=false){
  const src=`audio/ANNOUNCEMENT-${l}.mp3`;
  if (announceAudio.src.endsWith(src)) { if(autoplay && announceAudio.paused) announceAudio.play().catch(()=>{}); return; }
  announceAudio.pause(); announceAudio.src=src; updateMiniLabels(l); if(autoplay) announceAudio.play().catch(()=>{});
}
function setShortForLang(l, autoplay=false){
  const src = `audio/SHORTSTORY-${l}.mp3`;
  if (shortAudio.src.endsWith(src)) { if(autoplay && shortAudio.paused) shortAudio.play().catch(()=>{}); return; }
  shortAudio.pause(); shortAudio.src = src; updateMiniLabels(l); if(autoplay) shortAudio.play().catch(()=>{});
}
function pauseOthers(except){
  [bgAudio, announceAudio, shortAudio].forEach(a => {
    if (a && a !== except && !a.paused) a.pause();
  });
  updateAudioLabels(); updateMiniLabels();
}

// ---------- init bindings inside a subpage ----------
function initSubpageBindings(root){
  // Practical help modal
  root.querySelector('#wantHelp')?.addEventListener('click', () => {
    openModal(
      t('modal.help.title', t('support.physical', 'Practical help')),
      t('modal.help.body', 'If you are ready to help — whether legal, medical, or practical support (nurses, caregivers), or if you want to arrange a personal meeting — please write to: <a href="mailto:theRealUnrealStory@gmail.com" class="underline">theRealUnrealStory@gmail.com</a>.<br><br>We are sincerely grateful to everyone who responds.')
    );
  });

  // Tiles
  const tileEls = ['#tile1','#tile2','#tile3'].map(sel => root.querySelector(sel)).filter(Boolean);
  function lockOverlay(idx, lock){ const el = tileEls[idx]; if(!el) return; el.classList.toggle('overlay-off', !!lock); }
  root.querySelector('#tile1')?.addEventListener('click', ()=>{ lockOverlay(0,true); openModal(t('tiles.me','I’m Nico'), t('modal.tile1.body','…')); });
  root.querySelector('#tile2')?.addEventListener('click', ()=>{ lockOverlay(1,true); openModal(t('tiles.about','About Adam'), t('modal.tile2.body','…')); });
  root.querySelector('#tile3')?.addEventListener('click', ()=>{ lockOverlay(2,true); openModal(t('tiles.others','Other people in the story'), t('modal.tile3.body','…')); });
  $('#modalClose').addEventListener('click', ()=> tileEls.forEach(el=>el.classList.remove('overlay-off')));
  $('#modalOk').addEventListener('click', ()=> tileEls.forEach(el=>el.classList.remove('overlay-off')));
  $('#modalBackdrop').addEventListener('click', (e)=>{ if(e.target===$('#modalBackdrop')) tileEls.forEach(el=>el.classList.remove('overlay-off')); });

  // Share
  root.querySelector('#shareBtn')?.addEventListener('click', async () => {
    try {
      const u = new URL(location.href);
      u.searchParams.set('lang', $('#lang').value);
      const url = u.toString();
      if (navigator.share) { await navigator.share({ title: 'The Real Unreal Story', url }); }
      else { await navigator.clipboard.writeText(url); alert((I18N && I18N["share.copied"]) || 'Link copied'); }
    } catch {}
  });

  // Engagement
  const ENG_KEY='engagement_v1';
  const loadEng=()=>{ try{return JSON.parse(localStorage.getItem(ENG_KEY)||'[]');}catch{return []} };
  const saveEng=a=>{ try{localStorage.setItem(ENG_KEY,JSON.stringify(a));}catch{} };
  function applyEng(){ const on=loadEng(); root.querySelectorAll('.eng-btn').forEach((b,i)=>{const s=on.includes(i); b.classList.toggle('bg-green-700',s); b.classList.toggle('border-green-400',s); b.setAttribute('aria-pressed', s?'true':'false');}); }
  root.querySelectorAll('.eng-btn').forEach((b,i)=>b.addEventListener('click',()=>{const on=loadEng(); const p=on.indexOf(i); if(p>=0) on.splice(p,1); else on.push(i); saveEng(on); applyEng();}));
  applyEng();

  // Telegram feed (Story Now only)
  if (root.querySelector('#tgFeed')) {
    document.addEventListener('openImage', (e)=> openModal('', `<img src="${e.detail}" class="w-full h-auto rounded-xl">`), { once:true });
    renderTgFeed(root);
  }

  // Map (Support only)
  if (root.querySelector('#map')) initMapOnce(root);

  // Hearts + Splide (Support only)
  if (root.querySelector('#heartsSplide')) initHeartsOnce(root);

  // Mini-players (Story only)
  announceBtn   = root.querySelector('#announceBtn');
  announceStatus= root.querySelector('#announceStatus');
  shortBtn      = root.querySelector('#shortBtn');
  shortStatus   = root.querySelector('#shortStatus');

  if (announceBtn) {
    announceBtn.addEventListener('click', async ()=>{
      if (announceAudio.paused){
        setAnnouncementForLang(langSelect.value, true);
        pauseOthers(announceAudio);
      } else { announceAudio.pause(); }
      updateMiniLabels();
    });
    announceAudio.addEventListener('ended', ()=> updateMiniLabels());
  }
  if (shortBtn) {
    shortBtn.addEventListener('click', async ()=>{
      if (shortAudio.paused){
        setShortForLang(langSelect.value, true);
        pauseOthers(shortAudio);
      } else { shortAudio.pause(); }
      updateMiniLabels();
    });
    shortAudio.addEventListener('ended', ()=> updateMiniLabels());
  }
  updateMiniLabels();
}

// ---------- subpage loader ----------
async function loadSubpage(route){
  if (!ROUTES[route]) route = 'story';
  setActiveButton(route);

  const loadingText = t('page.loading','Loading page...');
  const errorText   = t('page.error','Failed to load page');

  subpageEl.innerHTML = `<section><div class="text-sm text-gray-300">${loadingText}</div></section>`;
  try{
    const res = await fetch(ROUTES[route], { cache:'no-store' });
    const json = await res.json();
    subpageEl.innerHTML = json.content || '';
    // apply i18n into the newly inserted subtree
    applyI18nTo(subpageEl);
    currentRoute = route;
    initSubpageBindings(subpageEl);
  }catch(e){
    console.error(e);
    subpageEl.innerHTML = `<section><div class="text-sm text-red-400">${errorText}</div></section>`;
  }
}

// ---------- navigation (buttons + hash) ----------
navButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const r = btn.dataset.route || 'story';
    if (location.hash !== `#${r}`) location.hash = `#${r}`; else loadSubpage(r);
  });
});
window.addEventListener('hashchange', () => {
  const r = (location.hash || '#story').replace('#','');
  loadSubpage(r);
});

// ---------- Telegram feed ----------
async function renderTgFeed(root){
  try{
    const box=root.querySelector('#tgFeed');
    if (!box) return;
    box.innerHTML = `<div class="text-sm text-gray-300">${t("feed.loading","Loading news…")}</div>`;
    const res=await fetch('/.netlify/functions/news?limit=30',{cache:'no-store'});
    if(!res.ok) throw new Error('news API '+res.status);
    const arr=await res.json();
    if(!Array.isArray(arr)||!arr.length){ box.innerHTML=`<div class="text-sm text-gray-300">${t("feed.empty","No posts yet.")}</div>`; return; }
    box.innerHTML=arr.map(p=>{
      const dt=p.date?new Date(p.date):null, time=dt?dt.toLocaleString():'';
      const link=p.link?`<a href="${p.link}" target="_blank" class="underline text-sky-400">${t("feed.openTelegram","Open in Telegram")}</a>`:'';
      const text=(p.text||'').replace(/\n/g,'<br>');
      const _img = (p.media_type==='photo' && p.media_path) ? `/.netlify/functions/tg-file?path=${encodeURIComponent(p.media_path)}` : null;
      const mediaHtml = _img
        ? `<img src="${_img}" alt="" class="mt-2 rounded-xl border border-gray-700 max-w-full max-h-52 sm:max-h-52 w-auto object-contain block cursor-zoom-in"
             onclick="document.dispatchEvent(new CustomEvent('openImage',{detail:'${_img}'}))">`
        : '';
      return `<article class="mb-4 p-3 rounded-xl bg-gray-900/50 border border-gray-700">
                <div class="text-xs text-gray-300 mb-2">${time}${link?` · ${link}`:''}</div>
                ${text ? `<div class="text-sm leading-relaxed">${text}</div>` : ''}
                ${mediaHtml}
              </article>`;
    }).join('');
  }catch(e){
    console.error(e);
    const box = root.querySelector('#tgFeed');
    if (box) box.innerHTML=`<div class="text-sm text-red-400">${t("feed.error","Failed to load news.")}</div>`;
  }
}

// ---------- Map (Leaflet) ----------
let mapCtx = { map:null, layer:null, selectedLatLng:null, previewMarker:null, marksOffset:0, pageSize:500 };
async function ensureLeaflet() {
  if (window.L) return;
  await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
}
// ВМЕСТО старой initMapOnce(root)
async function initMapOnce(root){
  const mapEl = root.querySelector('#map');
  if (!mapEl) return;

  await ensureLeaflet();

  // если карта уже есть, но её контейнер не тот, что в текущем DOM — пересоздать
  if (mapCtx.map && mapCtx.map._container !== mapEl) {
    try { mapCtx.map.remove(); } catch {}
    mapCtx = { map:null, layer:null, selectedLatLng:null, previewMarker:null, marksOffset:0, pageSize:500 };
  }

  // создать карту при отсутствии
  if (!mapCtx.map) {
    mapCtx.map = L.map(mapEl).setView([20,0],2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(mapCtx.map);
    mapCtx.layer = L.layerGroup().addTo(mapCtx.map);

    mapCtx.map.on('click', e=>{
      mapCtx.selectedLatLng = e.latlng;
      if (mapCtx.previewMarker) mapCtx.previewMarker.remove();
      mapCtx.previewMarker = L.marker([e.latlng.lat, e.latlng.lng], {draggable:true})
        .addTo(mapCtx.map)
        .bindPopup(t("map.selectedPoint","Selected point (you can drag)")).openPopup();
      mapCtx.previewMarker.on('dragend',()=>{ mapCtx.selectedLatLng = mapCtx.previewMarker.getLatLng(); });
    });

    // начальная подгрузка точек
    mapCtx.marksOffset = 0;
    loadAllMarksPaged();

    // после монтирования слегка «пнуть» расчёт размеров
    setTimeout(()=> mapCtx.map?.invalidateSize(), 50);
  } else {
    // карта уже была — просто «пнуть» размеры на новом DOM
    setTimeout(()=> mapCtx.map?.invalidateSize(), 50);
  }

  // === ВНИМАНИЕ: обработчики всегда перевешиваем на актуальные элементы ===
  root.querySelector('#locateBtn')?.addEventListener('click', async ()=>{
    if(!navigator.geolocation){ alert(t("map.noGeo","Geolocation not supported on this device.")); return; }
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude,longitude}=pos.coords; mapCtx.map.setView([latitude,longitude],6);
      L.marker([latitude,longitude]).addTo(mapCtx.map).bindPopup(t("map.youAreHere","You are here")).openPopup();
    },()=>{ alert(t("map.noGeo","Geolocation not supported on this device.")); });
  });

  root.querySelector('#addMark')?.addEventListener('click', async ()=>{
    const name = root.querySelector('#name')?.value.trim() || '';
    const message = root.querySelector('#msg')?.value.trim()  || '';
    if(!message) return alert(t("alert.enterMessage","Enter a message"));
    if(!mapCtx.selectedLatLng) return alert(t("alert.clickMapFirst","Click on the map first!"));
    const {lat,lng} = mapCtx.selectedLatLng;
    const resp = await fetch('/.netlify/functions/marks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,message,lat,lon:lng})});
    if(!resp.ok){ const tt=await resp.text().catch(()=>'-'); alert((t("error.saveFailed","Save error: ")) + tt); return; }
    const msgInp = root.querySelector('#msg'); if (msgInp) msgInp.value='';
    mapCtx.selectedLatLng=null; if(mapCtx.previewMarker){ mapCtx.previewMarker.remove(); mapCtx.previewMarker=null; }
    mapCtx.marksOffset = 0;
    loadAllMarksPaged();
  });
}

function setMarksCount(n){ const el=$('#marksCount'); if(el) el.textContent=Number.isFinite(n)?String(n):'0'; }
async function fetchMarksPage() {
  const r = await fetch(`/.netlify/functions/marks?limit=${mapCtx.pageSize}&offset=${mapCtx.marksOffset}`, { cache: 'no-store' });
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
      L.circleMarker([lat, lon], { radius:4, color:'lime' })
        .bindPopup(`<b>${m.name||'Anon'}</b><br>${m.message||''}`)
        .addTo(mapCtx.layer);
    }
    if (i < points.length) requestAnimationFrame(step);
  })();
}
async function loadAllMarksPaged() {
  mapCtx.layer.clearLayers();
  let total = 0;
  while (true) {
    const chunk = await fetchMarksPage();
    if (!chunk.length) break;
    total += chunk.length;
    drawMarksBatch(chunk, 300);
    mapCtx.marksOffset += chunk.length;
    if (chunk.length < mapCtx.pageSize) break;
  }
  setMarksCount(total);
}

// ---------- Hearts + Splide ----------
let splide, heartsOffset=0, heartsPageSize=200, allHearts=[];
async function ensureSplide(){
  if (window.Splide) return;
  await loadScript('https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js');
}
function chunk(a,s){const out=[];for(let i=0;i<a.length;i+=s) out.push(a.slice(i,i+s));return out;}
function heartCard(n){return `<div class="p-4 rounded-2xl bg-gray-900/50 shadow-sm border border-gray-700"><div class="flex items-center gap-2"><span class="text-xl">❤️</span><div class="text-sm text-gray-200">${n||'Anon'}</div></div></div>`;}
function renderHeartsSlides(arr){
  const pages=chunk(arr,12), ul=$('#heartsSlides');
  ul.innerHTML=pages.map(p=>`<li class="splide__slide"><div class="grid md:grid-cols-3 gap-3">${p.map(x=>heartCard(x.name)).join('')}</div></li>`).join('')
    || `<li class="splide__slide"><div class="text-sm text-gray-300">${t("hearts.empty","No hearts yet.")}</div></li>`;
  if(splide) splide.destroy(true);
  splide=new window.Splide('#heartsSplide',{type:'slide',perPage:1,perMove:1,pagination:true,arrows:true,classes:{pagination:'splide__pagination mt-4'}}); splide.mount();
}
async function fetchHeartsPage() {
  const r = await fetch(`/.netlify/functions/hearts?limit=${heartsPageSize}&offset=${heartsOffset}`, { cache: 'no-store' });
  const chunk = await r.json();
  if (!Array.isArray(chunk)) return [];
  return chunk;
}
async function loadMoreHearts() {
  await ensureSplide();
  const chunk = await fetchHeartsPage();
  const btn = $('#loadMoreHearts');
  if (!chunk.length) {
    btn?.setAttribute('disabled','disabled');
    btn?.classList.add('opacity-50','cursor-not-allowed');
    return;
  }
  allHearts = allHearts.concat(chunk);
  heartsOffset += chunk.length;
  renderHeartsSlides(allHearts);
  if (chunk.length < heartsPageSize) {
    btn?.setAttribute('disabled','disabled');
    btn?.classList.add('opacity-50','cursor-not-allowed');
  }
}
async function initHeartsOnce(root){
  const el = root.querySelector('#heartsSplide');
  if (!el) return;
  allHearts = []; heartsOffset = 0;
  await ensureSplide();
  renderHeartsSlides([]);
  loadMoreHearts();
  root.querySelector('#loadMoreHearts')?.addEventListener('click', loadMoreHearts);
  root.querySelector('#addHeart')?.addEventListener('click', async ()=>{
    await ensureSplide();
    const inp=root.querySelector('#heartName'); const name=(inp.value||'').trim();
    await fetch('/.netlify/functions/hearts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});
    inp.value='';
    allHearts = []; heartsOffset = 0;
    const btn = $('#loadMoreHearts');
    btn?.removeAttribute('disabled'); btn?.classList.remove('opacity-50','cursor-not-allowed');
    loadMoreHearts();
  });
}

// ---------- boot ----------
(async function boot(){
  await loadLocale(initialLang);
  const start = (location.hash || '#story').replace('#','');
  loadSubpage(start);
})();
