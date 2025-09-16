// /assets/js/core/pages/support.js
import { $, loadScript } from '../dom.js';
import { t } from '../i18n.js';
import { openModal } from '../modal.js';
import { openGlocalDonate } from '../glocal.js'; // Smart Glocal widget launcher

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
      L.circleMarker([lat, lon], { radius:4, color:'#06b6d4' })
        .bindPopup(`<b>${m.name||'Anon'}</b><br>${m.message||''}`)
        .addTo(layer);
    }
    if (i < points.length) requestAnimationFrame(step);
  })();
}
async function loadAllMarksPaged() {
  if (!layer) return;
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
function heartCard(n){
  return `
    <div class="p-4 rounded-2xl bg-gray-900/50 shadow-sm border border-gray-700 heart-card">
      <div class="flex items-center gap-2">
        <span class="heart-icon" aria-hidden="true"></span>
        <div class="text-sm text-gray-200">${n||'Anon'}</div>
      </div>
    </div>`;
}
function renderHeartsSlides(arr){
  const pages=chunk(arr,12);
  const ul = $('#heartsSlides');
  if (!ul) return;
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
  function applyEng(){
    const on=loadEng();
    root.querySelectorAll('.eng-btn').forEach((b,i)=>{
      const s=on.includes(i);
      b.classList.toggle('bg-cyan-700', s);
      b.classList.toggle('border-cyan-400', s);
      b.classList.toggle('bg-green-700', false);
      b.classList.toggle('border-green-400', false);
      b.setAttribute('aria-pressed', s?'true':'false');
    });
  }
  root.querySelectorAll('.eng-btn').forEach((b,i)=>b.addEventListener('click',()=>{
    const on=loadEng(); const p=on.indexOf(i); if(p>=0) on.splice(p,1); else on.push(i); saveEng(on); applyEng();
  }));
  applyEng();
}

/* =========================
   Donate buttons rendering
   ========================= */

function parseDonateConfigFromDOM(root){
  const wrap = root.querySelector('[data-donate-buttons]');
  if (!wrap) return null;

  // Read attributes
  let provider = (wrap.getAttribute('data-donate-provider') || 'gofundme').toLowerCase();
  const rawBase = (wrap.getAttribute('data-donate-base') || '').trim();
  const rawAmts = (wrap.getAttribute('data-donate-amounts') || '').trim();
  const currency = (wrap.getAttribute('data-donate-currency') || 'usd').toLowerCase();

  // Dev override via URL or localStorage (?donate=glocal|gofundme)
  try {
    const usp = new URLSearchParams(location.search);
    const urlProv = usp.get('donate');
    const lsProv = localStorage.getItem('donateProvider');
    const override = (urlProv || lsProv || '').toLowerCase();
    if (override === 'glocal' || override === 'gofundme') provider = override;
  } catch {}

  const base = rawBase
    ? String(rawBase).replace(/\/donate.*$/,'/donate')
    : 'https://www.gofundme.com/f/your-campaign-slug/donate';

  const amounts = rawAmts
    ? rawAmts.split(',').map(s=>Number(s.trim())).filter(n=>Number.isFinite(n) && n>0)
    : [5, 10, 25, 50, 100, 250, 500];

  return { provider, base, amounts, currency, wrap };
}

function renderDonateButtons(root){
  const cfg = parseDonateConfigFromDOM(root);
  if (!cfg || !cfg.wrap) return;

  const { provider, base, amounts, currency, wrap } = cfg;
  wrap.innerHTML = '';

  if (provider === 'glocal') {
    // Monthly toggle
    const toggleWrap = document.createElement('div');
    toggleWrap.className = 'mb-2 flex items-center gap-2';
    toggleWrap.innerHTML = `
      <input id="donateRecurring" type="checkbox" class="accent-cyan-500 rounded">
      <label for="donateRecurring" class="text-sm text-gray-200" data-i18n="donate.monthly">${t('donate.monthly','Make this monthly')}</label>
    `;
    wrap.appendChild(toggleWrap);

    // Fixed amount buttons
    amounts.forEach((amt) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'donate-tier px-3 py-2 rounded-xl text-sm';
      btn.dataset.amount = String(amt);
      btn.textContent = `$${amt}`;
      btn.addEventListener('click', () => {
        const recurrent = !!document.getElementById('donateRecurring')?.checked;
        openGlocalDonate({ amount: amt, currency, recurrent });
      });
      wrap.appendChild(btn);
    });

    // Custom / open form
    const custom = document.createElement('button');
    custom.type = 'button';
    custom.className = 'donate-tier px-3 py-2 rounded-xl text-sm';
    custom.setAttribute('data-i18n','btn.donate');
    custom.textContent = t('btn.donate','Donate');
    custom.addEventListener('click', () => {
      const recurrent = !!document.getElementById('donateRecurring')?.checked;
      openGlocalDonate({ currency, recurrent });
    });
    wrap.appendChild(custom);

    // Info button
    const infoBtn = document.createElement('button');
    infoBtn.type = 'button';
    infoBtn.className = 'inline-flex items-center gap-1 text-xs text-gray-300 underline ml-2';
    infoBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
      <span data-i18n="donate.info.link">${t('donate.info.link','Why this matters')}</span>
    `;
    infoBtn.addEventListener('click', ()=>{
      const title = t('donate.info.title','About support and project plans');
      const html = t('donate.info.body', `<div class="space-y-3 text-sm leading-relaxed">
        <p>I create and run the media side of this project alone: research and writing, editing and translation, visuals and audio, publishing, and site upkeep. To be clear: right now <strong>we are in a difficult financial situation</strong> — myself, Adam, and others involved — as a direct result of the events you read about here.</p>
        <p>Almost all my time and energy now go to <strong>supporting Adam</strong>: coordination, communication, daily logistics. In parallel, I <strong>tell this story</strong> across formats — writing, fact-gathering, translation, visuals and audio — and I keep the site running.</p>
        <p><strong>Your voluntary contribution is very important to us:</strong> it not only supports my work on creating and developing the project (research, texts, translations, visuals and audio, publishing, hosting, site maintenance), <strong>it also helps cover financial needs that arise directly from this story.</strong> That’s how I can keep the pace of work and care around it.</p>
        <p><strong>What’s next.</strong> In parallel I am preparing <strong>practical learning courses</strong> and <strong>my own web-apps</strong> where I’ll share <strong>my unique AI-driven methods</strong>; part of the functionality will be <strong>free</strong>. I want readers and followers to have clear, useful tools to create meaningful content by the same principles.</p>
        <p><strong>Stay tuned:</strong> even if today isn’t the moment to donate, please check back — updates, releases, and news will appear here.</p>
      </div>`);
      openModal(title, html);
    });
    wrap.appendChild(infoBtn);

    document.dispatchEvent(new CustomEvent('locale-apply-request'));
    return;
  }

  // === Default: GoFundMe links ===
  amounts.forEach((amt) => {
    const a = document.createElement('a');
    a.className = 'donate-tier px-3 py-2 rounded-xl text-sm';
    a.dataset.amount = String(amt);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.href = `${base}?amount=${encodeURIComponent(amt)}`;
    a.textContent = `$${amt}`;
    wrap.appendChild(a);
  });

  const custom = document.createElement('a');
  custom.className = 'donate-tier px-3 py-2 rounded-xl text-sm';
  custom.target = '_blank';
  custom.rel = 'noopener noreferrer';
  custom.href = base;
  custom.setAttribute('data-i18n', 'btn.donate');
  custom.textContent = t('btn.donate','Donate');
  wrap.appendChild(custom);

  document.dispatchEvent(new CustomEvent('locale-apply-request'));
}

export async function init(root){
  const subpageEl = document.getElementById('subpage');
  if (subpageEl) subpageEl.classList.add('page--support');

  initEngagement(root);
  renderDonateButtons(root);

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

  ['#addHeart', '#addMark'].forEach(sel => {
    const btn = root.querySelector(sel);
    if (btn) {
      btn.classList.remove('bg-green-600','bg-green-500','bg-cyan-500','text-white','btn-ghost');
      btn.classList.add('donate-tier','px-3','py-2','rounded-xl','text-sm');
    }
  });

  const wantHelp = root.querySelector('#wantHelp');
  if (wantHelp) {
    wantHelp.classList.remove('btn-ghost','bg-green-600','bg-green-500','bg-cyan-500','text-white');
    wantHelp.classList.add('donate-tier','px-3','py-2','rounded-xl','text-sm');
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

  const subpageEl = document.getElementById('subpage');
  if (subpageEl) subpageEl.classList.remove('page--support');
}

export default { init, destroy };
