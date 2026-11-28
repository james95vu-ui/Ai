(()=>{'use strict';
const town=document.getElementById('town');if(!town)return;
const core=new Set(['city-hero','development','landscape']);
const toggle=document.createElement('button');toggle.type='button';toggle.className='city-services-toggle';toggle.textContent='☰ Сервисы';toggle.setAttribute('aria-expanded','false');
const drawer=document.createElement('aside');drawer.className='city-services-drawer';drawer.hidden=true;drawer.setAttribute('aria-label','Дополнительные городские сервисы');
const close=document.createElement('button');close.type='button';close.className='city-services-close';close.textContent='✕ Закрыть сервисы';
drawer.append(close);town.append(toggle,drawer);
function closeDrawer(){drawer.hidden=true;toggle.setAttribute('aria-expanded','false')}
toggle.addEventListener('click',()=>{drawer.hidden=!drawer.hidden;toggle.setAttribute('aria-expanded',String(!drawer.hidden))});
close.addEventListener('click',closeDrawer);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden)closeDrawer()});
let pending=false;
function organize(){
 pending=false;
 for(const child of Array.from(town.children)){
  if(child===toggle||child===drawer||child.id==='details'||core.has(child.className))continue;
  // Third-party features can append their panels to town at any time.
  if(child.nodeType===1)drawer.append(child);
 }
 toggle.hidden=drawer.children.length<=1;
 if(toggle.hidden)closeDrawer();
}
const observer=new MutationObserver(records=>{
 if(records.some(r=>r.target===town&&Array.from(r.addedNodes).some(n=>n.nodeType===1&&n!==toggle&&n!==drawer))){
  if(!pending){pending=true;queueMicrotask(organize)}
 }
});
observer.observe(town,{childList:true});
organize();
})();