import { $, loadScript } from '../dom.js';
import { t } from '../i18n.js';
import { openModal } from '../modal.js';

let L;                  // Leaflet
let map = null;
let layer = null;
let selectedLatLng = null;
let previewMarker = null;

let marksOffset = 0;
const marksPageSize = 500;

let splide = null;
let allHearts = [];
let heartsOffset = 0;
const heartsPageSize = 200;

async function ensureLeaflet() {
  if (window.L) { L = window.L; return; }
  await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
  L = window.L;
}
async function ensureSplide(){
  if (window.Splide) return;
  await loadScript('https://cdn.jsdelivr.net/npm/@splidejs/splide@4.1.4/dist/js/splide.min.js');
}

function setMarksCount(n){ const el=$('#marksCount'); if(el) el.textContent=Number.isFinite(n)?String(n):'0'; }
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
  marksOffset = 0;
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

function chunk(a,s){const out=[];for(let i=0;i<a.length;i+=s) out.push(a.slice(i,i+s));return out;}
function heartCard(n){return `<div class="p-4 rounded-2xl bg-gray-900/50 shadow-sm border border-gray-700"><div class="flex items-center gap-2"><span class="text-xl">❤️</span><div class="text-sm text-gray-200">${n||'Anon'}</div></div></div>`;}
function renderHeartsSlides(arr){
  const pages=chunk(arr,12);
  const ul = $('#heartsSlides');
  ul.innerHTML = pages.map(p=>`<li class="splide__slide"><div class="grid md:grid-cols-3 gap-3">${p.map(x=>heartCard(x.name)).join('')}</div></li>`).join('')
    || `<li class="splide__slide"><div class="text-sm text-gray-300">${t('hearts.empty','No hearts yet.')}</div></li>`;
  if (splide) splide.destroy(true);
  splide = new window.Splide('#heartsSplide',{type:'slide',perPage:1,perMove:1,pagination:true,arrows:true,classes:{pagination:'splide__pagination mt-4'}}); 
  splide.mount();
}

function initEngagement(root){
  const ENG_KEY='engagement_v1';
  const loadEng=()=>{ try{return JSON.parse(localStorage.getItem(ENG_KEY)||'[]');}catch{return []} };
  const saveEng=a=>{ try{localStorage.setItem(ENG_KEY,JSON.stringify(a));}catch{} };
  function applyEng(){ const on=loadEng(); root.querySelectorAll('.eng-btn').forEach((b,i)=>{const s=on.includes(i); b.classList.toggle('bg-green-700',s); b.classList.toggle('border-green-400',s); b.setAttribute('aria-pressed', s?'true':'false');}); }
  root.querySelectorAll('.eng-btn').forEach((b,i)=>b.addEventListener('click',()=>{const on=loadEng(); const p=on.indexOf(i); if(p>=0) on.splice(p,1); else on.push(i); saveEng(on); applyEng();}));
  applyEng();
}

export async function init(root){
  initEngagement(root);

  const mapEl = root.querySelector('#map');
  if (mapEl) {
    await ensureLeaflet();
    map = L.map(mapEl).setView([20,0],2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);
    layer = L.layerGroup().addTo(map);

    map.on('click', e=>{
      selectedLatLng = e.latlng; 
      if (previewMarker) previewMarker.remove();
      previewMarker = L.marker([selectedLatLng.lat,selectedLatLng.lng],{draggable:true})
        .addTo(map)
        .bindPopup(t('map.selectedPoint','Selected point (you can drag)'))
        .openPopup();
      previewMarker.on('dragend',()=>{selectedLatLng = previewMarker.getLatLng();});
    });

    await loadAllMarksPaged();

    root.querySelector('#locateBtn')?.addEventListener('click', ()=>{
      if(!navigator.geolocation){ alert(t('map.noGeo','Geolocation not supported on this device.')); return; }
      navigator.geolocation.getCurrentPosition(pos=>{
        const {latitude,longitude}=pos.coords; map.setView([latitude,longitude],6);
        L.marker([latitude,longitude]).addTo(map).bindPopup(t('map.youAreHere','You are here')).openPopup();
      },()=>{ alert(t('map.noGeo','Geolocation not supported on this device.')); });
    });

    root.querySelector('#addMark')?.addEventListener('click', async ()=>{
      const name = (root.querySelector('#name')?.value || '').trim();
      const message = (root.querySelector('#msg')?.value || '').trim();
      if(!message) return alert(t('alert.enterMessage','Enter a message'));
      if(!selectedLatLng) return alert(t('alert.clickMapFirst','Click on the map first!'));
      const {lat,lng}=selectedLatLng;
      const resp=await fetch('/.netlify/functions/marks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name,message,lat,lon:lng})});
      if(!resp.ok){ const tt=await resp.text().catch(()=>'-'); alert((t('error.saveFailed','Save error: ')) + tt); return; }
      const msgInp = root.querySelector('#msg'); if (msgInp) msgInp.value='';
      selectedLatLng=null; if(previewMarker){previewMarker.remove(); previewMarker=null;}
      await loadAllMarksPaged();
    });

    setTimeout(()=> map?.invalidateSize(), 50);
  }

  if (root.querySelector('#heartsSplide')) {
    await ensureSplide();
    allHearts = []; heartsOffset = 0;
    renderHeartsSlides([]);
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

  root.querySelector('#wantHelp')?.addEventListener('click', () => {
    openModal(
      t('modal.help.title', t('support.physical','Practical help')),
      t('modal.help.body', 'If you are ready to help — whether legal, medical, or practical support (nurses, caregivers), or if you want to arrange a personal meeting — please write to: <a href="mailto:theRealUnrealStory@gmail.com" class="underline">theRealUnrealStory@gmail.com</a>.<br><br>We are sincerely grateful to everyone who responds.')
    );
  });
}

export function destroy(){
  try { if (map) map.remove(); } catch {}
  map = layer = null;
  selectedLatLng = null;
  previewMarker = null;

  try { if (splide) splide.destroy(true); } catch {}
  splide = null;
  allHearts = [];
}
