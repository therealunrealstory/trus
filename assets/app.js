// ===== helpers =====
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const loadScript = (src)=> new Promise((res,rej)=>{ if($(`script[src="${src}"]`)) return res(); const s=document.createElement('script'); s.src=src; s.async=true; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

// ===== i18n (EN/RU) =====
let I18N = {};
const DEFAULT_I18N = {};
// собрать дефолтные тексты из DOM (чтобы fallback был как в верстке)
(function captureDefaults(){
  $$('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); if(!(k in DEFAULT_I18N)) DEFAULT_I18N[k]=el.innerHTML; });
  $$('[data-i18n-placeholder]').forEach(el=>{ const k=el.getAttribute('data-i18n-placeholder'); if(!(k in DEFAULT_I18N)) DEFAULT_I18N[k]=el.getAttribute('placeholder')||''; });
})();
const t = (key,fb)=> (I18N[key] ?? DEFAULT_I18N[key] ?? fb);
async function loadLocale(lang){
  try {
    const r = await fetch(`i18n/${lang}.json`, { cache:'no-store' });
    I18N = r.ok ? await r.json() : {};
  } catch { I18N = {}; }
  document.documentElement.lang = lang.toLowerCase();
  // применяем тексты
  $$('[data-i18n]').forEach(el=>{ const k=el.getAttribute('data-i18n'); const v=t(k, el.innerHTML); if(v!=null) el.innerHTML=v; });
  $$('[data-i18n-placeholder]').forEach(el=>{ const k=el.getAttribute('data-i18n-placeholder'); const v=t(k, el.getAttribute('placeholder')); if(v!=null) el.setAttribute('placeholder', v); });
  // если модалка открыта — перерисовать содержимое (barcode/share/tiles/help)
  rerenderOpenModal();
  // обновить подписи аудио‑кнопок/статусов
  updateAudioLabels();
  updateMiniLabels();
}

// ===== hashtag typing + модалка по клику =====
(function initHashtag(){
  const el = $('#hashtagType'); const btn = $('#hashtagBtn');
  if(!el || !btn) return;
  const TEXT = '#TheRealUnrealStory'; let i=0, dir=1;
  const typeDelay=90, eraseDelay=45, pause=900;
  (function step(){
    el.textContent = TEXT.slice(0, i);
    if (dir>0){ if(i<TEXT.length){ i++; setTimeout(step,typeDelay);} else { setTimeout(()=>{dir=-1; step();},pause);} }
    else { if(i>0){ i--; setTimeout(step,eraseDelay);} else { setTimeout(()=>{dir=1; step();},pause);} }
  })();
  btn.addEventListener('click', ()=> openShareModal());
})();

// ===== универсальная модалка =====
const modal = $('#modalBackdrop'), mTitle = $('#modalTitle'), mBody = $('#modalBody');
let lastModal = null; // { kind:'share'|'tile1'|'tile2'|'tile3'|'help'|'image', payload?:any }
function openModal(title, html, kind='custom', payload=null){
  mTitle.innerHTML = title; mBody.innerHTML = html; lastModal = { kind, payload };
  modal.classList.add('show');
}
function closeModal(){ modal.classList.remove('show'); lastModal=null; }
$('#modalClose').onclick=closeModal; $('#modalOk').onclick=closeModal;
modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

// ререндер открытой модалки при смене языка
function rerenderOpenModal(){
  if (!lastModal) return;
  const k = lastModal.kind;
  if (k === 'share') openShareModal(true);
  if (k === 'tile1') openTileModal('tile1', true);
  if (k === 'tile2') openTileModal('tile2', true);
  if (k === 'tile3') openTileModal('tile3', true);
  if (k === 'help')  openHelpModal(true);
  // image/custom оставляем как есть
}

// ===== SHARE / «штрих‑код» =====
function openShareModal(isRerender=false){
  const title = t('share.title','Share');
  const body  = `
    <div class="space-y-3">
      <p>${t('share.body','Thank you for sharing our story. Copy the link below or scan the code.')}</p>
      <div class="p-3 rounded-xl border border-gray-700 bg-black/30 break-all">${location.href}</div>
      <div class="text-xs text-gray-300">${t('share.note','Tip: use #TheRealUnrealStory')}</div>
    </div>
  `;
  openModal(title, body, 'share');
}

// ===== плёнки (tile1/2/3) =====
const tileMap = {
  tile1: { titleKey:'tiles.me', bodyKey:'tiles.meBody', fallbackTitle:'I’m Nico', fallbackBody:'Hi! I’m Nico…' },
  tile2: { titleKey:'tiles.about', bodyKey:'tiles.aboutBody', fallbackTitle:'About Adam', fallbackBody:'A few words about Adam…' },
  tile3: { titleKey:'tiles.others', bodyKey:'tiles.othersBody', fallbackTitle:'Other people in the story', fallbackBody:'…and about other people in our story.' },
};
function openTileModal(id, isRerender=false){
  const m = tileMap[id]; if(!m) return;
  openModal(t(m.titleKey, m.fallbackTitle), t(m.bodyKey, m.fallbackBody), id);
}
['tile1','tile2','tile3'].forEach(id => $('#'+id)?.addEventListener('click', ()=> openTileModal(id)));

// ===== Practical help =====
$('#wantHelp')?.addEventListener('click', ()=> openHelpModal());
function openHelpModal(isRerender=false){
  const title = t('help.title','Practical help');
  const body  = t('help.body', 'We need nurses/caregivers, logistics and legal support. Write us in Telegram.');
  openModal(title, `<p>${body}</p>`, 'help');
}

// ===== AUDIO =====
const bgAudio = $('#bgAudio');
const audioBtn = $('#audioBtn');
const announceAudio = $('#announceAudio');
const announceBtn = $('#announceBtn');
const announceStatus = $('#announceStatus');
const shortAudio = $('#shortAudio');
const shortBtn = $('#shortBtn');
const shortStatus = $('#shortStatus');
const langSelect = $('#lang');

// пути соответствуют вашим mp3 в v190825 (переименуйте при необходимости)
function mainSrcFor(lang){ return `audio/ORUS-${lang}.mp3`; }
function annSrcFor(lang){  return `audio/ANN-${lang}.mp3`; }
function shortSrcFor(lang){return `audio/SHORT-${lang}.mp3`; }

function updateAudioLabels(){
  if (audioBtn)    audioBtn.textContent    = bgAudio?.paused     ? (t("audio.play","Story in music")) : (t("audio.pause","‖ Pause"));
}
function updateMiniLabels(){
  if (announceBtn) announceBtn.textContent = announceAudio?.paused? (t("announce.play","▶︎ Play")) : (t("announce.pause","‖ Pause"));
  if (announceStatus) announceStatus.textContent = (t("announce.langLabel","Language: ") + (langSelect?.value||'EN'));
  if (shortBtn)   shortBtn.textContent     = shortAudio?.paused  ? (t("short.play","▶︎ Play")) : (t("short.pause","‖ Pause"));
  if (shortStatus)shortStatus.textContent  = (t("short.langLabel","Language: ") + (langSelect?.value||'EN'));
}
function pauseOthers(except){
  [bgAudio, announceAudio, shortAudio].forEach(a=>{ if(a && a!==except && !a.paused){ a.pause(); } });
  updateAudioLabels(); updateMiniLabels();
}

audioBtn?.addEventListener('click', ()=>{
  if (!bgAudio.src) bgAudio.src = mainSrcFor(langSelect.value);
  if (bgAudio.paused){ pauseOthers(bgAudio); bgAudio.play().catch(()=>{}); }
  else bgAudio.pause();
  updateAudioLabels();
});

announceBtn?.addEventListener('click', ()=>{
  if (!announceAudio.src) announceAudio.src = annSrcFor(langSelect.value);
  if (announceAudio.paused){ pauseOthers(announceAudio); announceAudio.play().catch(()=>{}); }
  else announceAudio.pause();
  updateMiniLabels();
});

shortBtn?.addEventListener('click', ()=>{
  if (!shortAudio.src) shortAudio.src = shortSrcFor(langSelect.value);
  if (shortAudio.paused){ pauseOthers(shortAudio); shortAudio.play().catch(()=>{}); }
  else shortAudio.pause();
  updateMiniLabels();
});

$('#lang')?.addEventListener('change', async ()=>{
  const lang = langSelect.value;
  const url = new URL(location.href); url.searchParams.set('lang', lang); history.replaceState(null,'',url.toString());
  // переключить i18n
  await loadLocale(lang);
  // подменить источники аудио под язык (если играет — не прерываем)
  if (bgAudio?.src) bgAudio.src = mainSrcFor(lang);
  if (announceAudio?.src) announceAudio.src = annSrcFor(lang);
  if (shortAudio?.src) shortAudio.src = shortSrcFor(lang);
  updateAudioLabels(); updateMiniLabels();
});

// ===== PWA install =====
let deferredPrompt=null;
window.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferredPrompt=e; $('#installBtn')?.classList.remove('hidden');});
window.addEventListener('appinstalled',()=>$('#installBtn')?.classList.add('hidden'));
$('#installBtn')?.addEventListener('click', async ()=>{
  if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null;
});

// ===== News feed (дизайн/логика как было; только заголовок из i18n) =====
async function renderTgFeed(){
  const box=$('#tgFeed'); if(!box) return;
  box.innerHTML = `<div class="text-sm text-gray-300">${t("feed.loading","Loading news…")}</div>`;
  try{
    const res=await fetch('/.netlify/functions/news?limit=30',{cache:'no-store'});
    if(!res.ok) throw new Error(res.statusText);
    const arr=await res.json();
    if(!Array.isArray(arr)||!arr.length){ box.innerHTML=`<div class="text-sm text-gray-300">${t("feed.empty","No posts yet.")}</div>`; return; }
    box.innerHTML=arr.map(p=>{
      const dt=p.date?new Date(p.date):null, time=dt?dt.toLocaleString():'';
      const link=p.link?`<a href="${p.link}" target="_blank" class="text-sky-400">${t("feed.openTelegram","Open in Telegram")}</a>`:'';
      const text=(p.text||'').replace(/\n/g,'<br>');
      return `<article class="mb-3 p-3 rounded-xl bg-gray-900/50 border border-gray-700">
        <div class="text-xs text-gray-300 mb-2">${time}${link?` · ${link}`:''}</div>
        ${text?`<div class="text-sm leading-relaxed">${text}</div>`:''}
      </article>`;
    }).join('');
  }catch(e){
    box.innerHTML = `<div class="text-sm text-red-400">${t("feed.error","Failed to load news.")}</div>`;
  }
}
renderTgFeed();

// ===== MAP (как было: locate + клик для выставления своей метки) =====
let LMap=null, map=null, layer=null, selectedLatLng=null, previewMarker=null;
async function ensureLeaflet(){ if(window.L) return; await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'); }
async function initMap(){
  if(map) return;
  await ensureLeaflet(); LMap=window.L;
  map = LMap.map('map', { zoomControl:true }).setView([51.1,10.45], 4);
  LMap.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18, attribution:'&copy; OpenStreetMap'}).addTo(map);
  layer=LMap.layerGroup().addTo(map);
  // click → выбрать позицию
  map.on('click', (e)=>{ selectedLatLng=e.latlng; if(!previewMarker) previewMarker=LMap.marker(selectedLatLng).addTo(map); else previewMarker.setLatLng(selectedLatLng); });
  await loadAllMarksPaged();
}
initMap();

$('#locateBtn')?.addEventListener('click', async ()=>{
  try{
    $('#locateBtn').disabled=true; $('#locateBtn').textContent=t('map.locating','Locating…');
    await ensureLeaflet(); if(!map) await initMap();
    navigator.geolocation.getCurrentPosition(pos=>{
      const {latitude, longitude}=pos.coords;
      map.setView([latitude,longitude], 10);
      selectedLatLng={lat:latitude,lng:longitude};
      if(!previewMarker) previewMarker=LMap.marker(selectedLatLng).addTo(map); else previewMarker.setLatLng(selectedLatLng);
      $('#locateBtn').textContent=t('map.locateMe','Show my location'); $('#locateBtn').disabled=false;
    }, ()=>{
      alert(t('map.geoError',"Couldn't get your location. Please try again."));
      $('#locateBtn').textContent=t('map.locateMe','Show my location'); $('#locateBtn').disabled=false;
    });
  }catch{ $('#locateBtn').textContent=t('map.locateMe','Show my location'); $('#locateBtn').disabled=false; }
});

function setMarksCount(n){ const el=$('#marksCount'); if(el) el.innerHTML=String(n||0); }
let marksOffset=0; const marksPage=500;
async function fetchMarksPage(){ const r=await fetch(`/.netlify/functions/marks?limit=${marksPage}&offset=${marksOffset}`,{cache:'no-store'}); return r.ok?await r.json():[]; }
function drawMarks(points){
  for (const m of points){
    const lat=Number(m.lat), lon=Number(m.lon); if(!Number.isFinite(lat)||!Number.isFinite(lon)) continue;
    LMap.circleMarker([lat,lon],{radius:4,color:'lime'}).bindPopup(`<b>${m.name||'Anon'}</b><br>${m.message||''}`).addTo(layer);
  }
}
async function loadAllMarksPaged(){
  layer.clearLayers(); let total=0; marksOffset=0;
  while(true){ const chunk=await fetchMarksPage(); if(!chunk.length) break; drawMarks(chunk); total+=chunk.length; marksOffset+=marksPage; }
  setMarksCount(total);
}
$('#reloadMarks')?.addEventListener('click', loadAllMarksPaged);
$('#addMark')?.addEventListener('click', async ()=>{
  if(!selectedLatLng){ alert('Click on the map to select a place.'); return; }
  const name=($('#name')?.value||'').trim(); const message=($('#msg')?.value||'').trim();
  await fetch('/.netlify/functions/marks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ name, message, lat:selectedLatLng.lat, lon:selectedLatLng.lng })});
  await loadAllMarksPaged();
});

// ===== HEARTS (иконка/карусель как было) =====
let heartsOffset=0;
async function ensureSplide(){ if(window.Splide) return; await loadScript('https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js'); }
async function appendHearts(arr){
  const ul=$('#heartsSlides'); if(!ul) return;
  for(const h of arr){
    const li=document.createElement('li'); li.className='splide__slide';
    li.innerHTML=`<div class="px-4 py-3 rounded-xl bg-gray-900/60 border border-gray-700">
      <div class="text-xs text-gray-400">${h.date||''}</div><div class="text-sm">${h.name||'Anon'}</div></div>`;
    ul.appendChild(li);
  }
  await ensureSplide();
  if(!window.__hearts){
    window.__hearts = new Splide('#heartsSplide',{ perPage:2, gap:'10px', arrows:false, pagination:true, autoplay:true, interval:4000, breakpoints:{768:{perPage:1}} }).mount();
  } else {
    window.__hearts.refresh();
  }
}
async function loadMoreHearts(){
  const btn=$('#loadMoreHearts'); if(btn){ btn.disabled=true; btn.classList.add('opacity-50'); }
  const res=await fetch(`/.netlify/functions/hearts?offset=${heartsOffset}&limit=30`,{cache:'no-store'});
  const arr=res.ok?await res.json():[];
  if(arr.length){ heartsOffset += arr.length; await appendHearts(arr); }
  if(btn){ btn.disabled=false; btn.classList.remove('opacity-50'); }
}
$('#loadMoreHearts')?.addEventListener('click', loadMoreHearts);
(async()=>{ await ensureSplide(); await loadMoreHearts(); })();
$('#addHeart')?.addEventListener('click', async ()=>{
  const name=($('#heartName')?.value||'').trim();
  await fetch('/.netlify/functions/hearts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name})});
  $('#heartName').value='';
  // перезагрузим ленту сердечек
  $('#heartsSlides').innerHTML=''; heartsOffset=0; if(window.__hearts){ try{window.__hearts.destroy();}catch{} window.__hearts=null; }
  await loadMoreHearts();
});

// ===== ROUTING Story/Live =====
function show(mode){
  const story=$('#story'), live=$('#live'); if(!story||!live) return;
  if(mode==='live'){ story.classList.add('hidden'); live.classList.remove('hidden'); localStorage.setItem('trus:lastMode','live'); }
  else { live.classList.add('hidden'); story.classList.remove('hidden'); localStorage.setItem('trus:lastMode','story'); }
}
function onHashChange(){
  const h=(location.hash||'#story').toLowerCase();
  if(h.startsWith('#live')){ show('live'); const id=h.slice(1); if(id!=='live') setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'}),30); }
  else { show('story'); const id=h.slice(1); if(id && id!=='story') setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'}),30); }
}
window.addEventListener('hashchange', onHashChange);

// ===== SHARE кнопка (штрих‑код/модалка) =====
$('#shareBtn')?.addEventListener('click', openShareModal);

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async ()=>{
  const lang = new URLSearchParams(location.search).get('lang')?.toUpperCase() || 'EN';
  $('#lang').value = lang; await loadLocale(lang);
  updateAudioLabels(); updateMiniLabels();

  if(!location.hash){
    const last=localStorage.getItem('trus:lastMode'); if(last) location.hash = '#'+last;
  }
  onHashChange();
});
