import { $, } from '../core/dom.js';
import { t } from '../core/i18n.js';
import { openModal } from '../core/modal.js';

let onOpenImage;

export async function init(root){
  const box = root.querySelector('#tgFeed');
  if (!box) return;
  box.innerHTML = `<div class="text-sm text-gray-300">${t('feed.loading','Loading news…')}</div>`;

  try{
    const res=await fetch('/.netlify/functions/news?limit=30',{cache:'no-store'});
    if(!res.ok) throw new Error('news API '+res.status);
    const arr=await res.json();
    if(!Array.isArray(arr)||!arr.length){ box.innerHTML=`<div class="text-sm text-gray-300">${t('feed.empty','No posts yet.')}</div>`; }
    else {
      box.innerHTML=arr.map(p=>{
        const dt=p.date?new Date(p.date):null, time=dt?dt.toLocaleString():'';
        const link=p.link?`<a href="${p.link}" target="_blank" class="underline text-sky-400">${t('feed.openTelegram','Open in Telegram')}</a>`:'';
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
    }
  }catch(e){
    console.error(e);
    box.innerHTML=`<div class="text-sm text-red-400">${t('feed.error','Failed to load news.')}</div>`;
  }

  // Просмотр фото в модалке
  onOpenImage = (e)=> openModal('', `<img src="${e.detail}" class="w-full h-auto rounded-xl">`);
  document.addEventListener('openImage', onOpenImage);
}

export function destroy(){
  document.removeEventListener('openImage', onOpenImage);
}
