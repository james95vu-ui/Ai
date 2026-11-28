(()=>{'use strict';
const shapes={
town:'<path d="M5 22V10L16 3l11 7v12M2 22h28M11 22v-8h10v8M10 10h3m6 0h3"/><path d="M16 3V0" stroke="#fff1b5"/>',
earn:'<circle cx="16" cy="16" r="12"/><circle cx="16" cy="16" r="8" stroke="#fff1b5"/><path d="M20 11c-2-2-9-2-9 2 0 5 10 1 10 6 0 4-7 5-10 2m5-13v16"/>',
quests:'<path d="M7 5h18v23H7zM11 5V2h10v3M11 12h10M11 17h10M11 22h6"/><path d="m3 17 2 2 4-5" stroke="#fff1b5"/>',
team:'<path d="M4 27V12l12-7 12 7v15M4 27h24M11 27v-8h10v8M10 13h3m6 0h3"/><path d="M16 3v6" stroke="#fff1b5"/>',
achievements:'<path d="M10 4h12v10c0 5-3 8-6 8s-6-3-6-8zM10 7H5v4c0 4 3 6 7 6M22 7h5v4c0 4-3 6-7 6M16 22v5m-6 1h12"/><path d="m16 9 1.4 3 3.2.5-2.3 2.2.5 3.2-2.8-1.5-2.8 1.5.5-3.2-2.3-2.2 3.2-.5z" fill="#eac66d"/>',
settings:'<path d="M13 3h6l1 4 3 2 4-1 3 5-3 3 0 3 3 3-3 5-4-1-3 2-1 4h-6l-1-4-3-2-4 1-3-5 3-3v-3l-3-3 3-5 4 1 3-2z" transform="translate(0 -2) scale(.94)"/><circle cx="16" cy="16" r="5" stroke="#fff1b5"/>'
};
for(const button of document.querySelectorAll('.game-nav button[data-go]')){
 const key=button.dataset.go,path=shapes[key];if(!path)continue;
 const old=button.querySelector('span');if(!old)continue;
 old.innerHTML='<svg class="hud-icon" viewBox="0 0 32 32" width="29" height="29" aria-hidden="true" fill="none" stroke="#e9c779" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+path+'</svg>';
}
const map=document.getElementById('map');if(map){map.classList.add('hud-map');}
const intro=document.querySelector('#intro .intro-art');if(intro){intro.classList.add('hud-intro-art');}
})();