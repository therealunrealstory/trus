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

  document.documentElement.lang = (lang || 'en').toLowerCase();
  document.documentElement.dir  = LOCALE_DIRS[lang] || 'ltr';

  const titleRest = I18N["meta.titleRest"] || DEFAULT_I18N["hero.titleRest"] || "support for Adam";
  document.title = `The Real Unreal Story — ${titleRest}`;

  if (I18N["meta.description"]) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.setAttribute('name','description'); document.head.appendChild(m); }
    m.setAttribute('content', I18N["meta.description"]);
  }

  $$("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.innerHTML = val;
  });
  $$("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    const val = (I18N[key] ?? DEFAULT_I18N[key]);
    if (val != null) el.setAttribute('placeholder', val);
  });

  // update labels for player buttons given current states
  updateAudioLabels();
  updateMiniLabels(lang);

  // switch sources ONLY if currently playing (strict lazy)
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

// ---------- Practical help (modal) ----------
$('#wantHelp')?.addEventListener('click', () => {
  openModal(
    t('modal.help.title', t('support.physical', 'Practical help')),
    t('modal.help.body', 'If you are ready to help — whether legal, medical, or practical support (nurses, caregivers), or if you want to arrange a personal meeting — please write to: <a href=\"mailto:theRealUnrealStory@gmail.com\" class=\"underline\">theRealUnrealStory@gmail.com</a>.<br><br>We are sincerely grateful to everyone who responds.')
  );
});

// ---------- overlay tiles ----------
const tileEls = [$('#tile1'), $('#tile2'), $('#tile3')];
function lockOverlay(idx, lock){ const el = tileEls[idx]; if(!el) return; el.classList.toggle('overlay-off', !!lock); }
$('#tile1').onclick=()=>{ lockOverlay(0,true); openModal(t('tiles.me','I’m Nico'), t('modal.tile1.body', `…`)); };
$('#tile2').onclick=()=>{ lockOverlay(1,true); openModal(t('tiles.about','About Adam'), t('modal.tile2.body', `…`)); };
$('#tile3').onclick=()=>{ lockOverlay(2,true); openModal(t('tiles.others','Other people in the story'), t('modal.tile3.body', `…`)); };
$('#modalClose').addEventListener('click', ()=> tileEls.forEach(el=>el.classList.remove('overlay-off')));
$('#modalOk').addEventListener('click', ()=> tileEls.forEach(el=>el.classList.remove('overlay-off')));
$('#modalBackdrop').addEventListener('click', (e)=>{ if(e.target===$('#modalBackdrop')) tileEls.forEach(el=>el.classList.remove('overlay-off')); });

// ---------- share ----------
$('#shareBtn').addEventListener('click', async () => {
  try {
    const u = new URL(location.href);
    u.searchParams.set('lang', $('#lang').value);
    const url = u.toString();
    if (navigator.share) { await navigator.share({ title: 'The Real Unreal Story', url }); }
    else { await navigator.clipboard.writeText(url); alert((I18N && I18N["share.copied"]) || 'Link copied'); }
  } catch {}
});

// ---------- engagement local state ----------
const ENG_KEY='engagement_v1';
const loadEng=()=>{ try{return JSON.parse(localStorage.getItem(ENG_KEY)||'[]');}catch{return []} };
const saveEng=a=>{ try{localStorage.setItem(ENG_KEY,JSON.stringify(a));}catch{} };
function applyEng(){ const on=loadEng(); $$('.eng-btn').forEach((b,i)=>{const s=on.includes(i); b.classList.toggle('bg-green-700',s); b.classList.toggle('border-green-400',s); b.setAttribute('aria-pressed', s?'true':'false');}); }
$$('.eng-btn').forEach((b,i)=>b.addEventListener('click',()=>{const on=loadEng(); const p=on.indexOf(i); if(p>=0) on.splice(p,1); else on.push(i); saveEng(on); applyEng();}));
applyEng();

// ---------- players (mutual exclusivity + strict lazy) ----------
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
  if (audioBtn)    audioBtn.textContent    = bgAudio.paused       ? (I18N["audio.play"]    || DEFAULT_I18N["audio.play"]    || "Story in music") : (I18N["audio.pause"] || "‖ Pause");
}
function updateMiniLabels(lang){
  if (announceBtn) announceBtn.textContent = announceAudio.paused ? (I18N["announce.play"] || DEFAULT_I18N["announce.play"] || "▶︎ Play") : (I18N["announce.pause"] || "‖ Pause");
  if (announceStatus) announceStatus.textContent = (I18N["announce.langLabel"] || DEFAULT_I18N["announce.langLabel"] || "Language: ") + (lang || langSelect.value);
  if (shortBtn)   shortBtn.textContent     = shortAudio.paused    ? (I18N["short.play"]    || DEFAULT_I18N["short.play"]    || "▶︎ Play") : (I18N["short.pause"] || "‖ Pause");
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
  const src=`audio/ANNOUNCEMENT-${l}.mp3`;
  if (announceAudio.src.endsWith(src)) { if(autoplay && announceAudio.paused) announceAudio.play().catch(()=>{}); return; }
  announceAudio.pause(); announceAudio.src=src; updateMiniLabels(l); if(autoplay) announceAudio.play().catch(()=>{});
}
function setShortForLang(l, autoplay=false){
  const src = `audio/SHORTSTORY-${l}.mp3`;
  if (shortAudio.src.endsWith(src)) { if(autoplay && shortAudio.paused) shortAudio.play().catch(()=>{}); return; }
  shortAudio.pause(); shortAudio.src = src; updateMiniLabels(l); if(autoplay) shortAudio.play().catch(()=>{});
}

// buttons
audioBtn.addEventListener('click', async ()=>{
  if (bgAudio.paused){
    setMainAudioForLang(langSelect.value, true);
    pauseOthers(bgAudio);
  } else {
    bgAudio.pause();
  }
  updateAudioLabels();
});
announceBtn.addEventListener('click', async ()=>{
  if (announceAudio.paused){
    setAnnouncementForLang(langSelect.value, true);
    pauseOthers(announceAudio);
  } else {
    announceAudio.pause();
  }
  updateMiniLabels();
});
shortBtn.addEventListener('click', async ()=>{
  if (shortAudio.paused){
    setShortForLang(langSelect.value, true);
    pauseOthers(shortAudio);
  } else {
    shortAudio.pause();
  }
  updateMiniLabels();
});
announceAudio.addEventListener('ended', ()=>{ updateMiniLabels(); });
shortAudio.addEventListener('ended',   ()=>{ updateMiniLabels(); });

// ---------- language init & change ----------
$('#donateHero')?.setAttribute('href', donateURL);

const fromQuery = getLangFromQuery();
const initialLang = fromQuery || localStorage.getItem('site_lang') || 'EN';
langSelect.value = initialLang;
localStorage.setItem('site_lang', initialLang);
loadLocale(initialLang);
if (fromQuery) {
  const u = new URL(location.href); u.searchParams.delete('lang'); history.replaceState({}, '', u);
}
langSelect.addEventListener('change', e => {
  const l = e.target.value;
  localStorage.setItem('site_lang', l);
  const u = new URL(location.href); u.searchParams.set('lang', l); history.replaceState({}, '', u);
  loadLocale(l);
  if (!bgAudio.paused)        setMainAudioForLang(l, true);
  if (!announceAudio.paused)  setAnnouncementForLang(l, true);
  if (!shortAudio.paused)     setShortForLang(l, true);
});

// ---------- PWA install ----------
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; $('#installBtn')?.classList.remove('hidden'); });
window.addEventListener('appinstalled', () => $('#installBtn')?.classList.add('hidden'));
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
  map = L.map('map').setView([20,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
  layer=L.layerGroup().addTo(map);

  map.on('click', e=>{
    selectedLatLng=e.latlng; if(previewMarker) previewMarker.remove();
    previewMarker=L.marker([selectedLatLng.lat,selectedLatLng.lng],{draggable:true}).addTo(map).bindPopup(t("map.selectedPoint","Selected point (you can drag)")).openPopup();
    previewMarker.on('dragend',()=>{selectedLatLng=previewMarker.getLatLng();});
  });

  // initial load
  loadAllMarksPaged();
}
function ioObserve(el, cb){
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ cb(); io.disconnect(); } });
  }, { rootMargin: '160px' });
  io.observe(el);
}
ioObserve($('#map'), initMapOnce);

// Locate button
$('#locateBtn').addEventListener('click', async ()=>{
  await initMapOnce();
  if(!navigator.geolocation){ alert(t("map.noGeo","Geolocation not supported on this device.")); return; }
  navigator.geolocation.getCurrentPosition(pos=>{
    const {latitude,longitude}=pos.coords; map.setView([latitude,longitude],6);
    L.marker([latitude,longitude]).addTo(map).bindPopup(t("map.youAreHere","You are here")).openPopup();
  },()=>{ alert(t("map.noGeo","Geolocation not supported on this device.")); });
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
      L.circleMarker([lat, lon], { radius:4, color:'lime' })
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
    drawMarksBatch(chunk, 300);
    marksOffset += chunk.length;
    if (chunk.length < marksPageSize) break;
  }
  setMarksCount(total);
}
$('#addMark').addEventListener('click', async ()=>{
  await initMapOnce();
  const name=$('#name').value.trim();
  const message=$('#msg').value.trim();
  if(!message) return alert(t("alert.enterMessage","Enter a message"));
  if(!selectedLatLng) return alert(t("alert.clickMapFirst","Click on the map first!"));
  const {lat,lng}=selectedLatLng;
  const resp=await fetch('/.netlify/functions/marks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,message,lat,lon:lng})});
  if(!resp.ok){ const tt=await resp.text().catch(()=>'-'); alert((t("error.saveFailed","Save error: ")) + tt); return; }
  $('#msg').value=''; selectedLatLng=null; if(previewMarker){previewMarker.remove(); previewMarker=null;}
  marksOffset = 0;
  loadAllMarksPaged();
});

// ---------- Lazy init: Hearts + Splide ----------
let splide;
function chunk(a,s){const out=[];for(let i=0;i<a.length;i+=s) out.push(a.slice(i,i+s));return out;}
function heartCard(n){return `<div class="p-4 rounded-2xl bg-gray-900/50 shadow-sm border border-gray-700"><div class="flex items-center gap-2"><span class="text-xl">❤️</span><div class="text-sm text-gray-200">${n||'Anon'}</div></div></div>`;}
function renderHeartsSlides(arr){
  const pages=chunk(arr,12), ul=$('#heartsSlides');
  ul.innerHTML=pages.map(p=>`<li class="splide__slide"><div class="grid md:grid-cols-3 gap-3">${p.map(x=>heartCard(x.name)).join('')}</div></li>`).join('')
    || `<li class="splide__slide"><div class="text-sm text-gray-300">${t("hearts.empty","No hearts yet.")}</div></li>`;
  if(splide) splide.destroy(true);
  splide=new window.Splide('#heartsSplide',{type:'slide',perPage:1,perMove:1,pagination:true,arrows:true,classes:{pagination:'splide__pagination mt-4'}}); splide.mount();
}

let heartsOffset = 0;
const heartsPageSize = 200;
let allHearts = [];
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
async function ensureSplide(){
  if (window.Splide) return;
  await loadScript('https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js');
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
