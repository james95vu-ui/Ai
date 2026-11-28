(()=>{'use strict';
const town=document.getElementById('town');if(!town)return;
const hero=town.querySelector('.city-hero'),picker=hero?.querySelector('.city-picker');
const toggle=document.createElement('button');toggle.type='button';toggle.className='city-services-toggle';toggle.textContent='☰ Сервисы';toggle.setAttribute('aria-expanded','false');
const drawer=document.createElement('aside');drawer.className='city-services-drawer';drawer.hidden=true;drawer.setAttribute('aria-label','Городские сервисы');
const close=document.createElement('button');close.type='button';close.className='city-services-close';close.textContent='✕ Закрыть сервисы';
drawer.append(close);
if(picker){
 const title=document.createElement('h2');title.className='city-services-city-title';title.textContent='Выбор города';
 drawer.append(title,picker);
}
document.body.append(toggle,drawer);
if(hero)hero.hidden=true;
function closeDrawer(){drawer.hidden=true;toggle.setAttribute('aria-expanded','false')}
function openDrawer(){if(town.hidden)return;drawer.hidden=false;toggle.setAttribute('aria-expanded','true')}
toggle.addEventListener('click',()=>drawer.hidden?openDrawer():closeDrawer());
close.addEventListener('click',closeDrawer);
const screenObserver=new MutationObserver(()=>{if(town.hidden)closeDrawer();toggle.hidden=town.hidden});
screenObserver.observe(town,{attributes:true,attributeFilter:['hidden']});
document.querySelectorAll('.game-nav button,.game-nav a').forEach(button=>button.addEventListener('click',closeDrawer));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden)closeDrawer()});
let pending=false;
function organize(){
 pending=false;
 for(const child of Array.from(town.children)){
  if(child.id==='details'||child.classList.contains('city-hero')||child.classList.contains('development')||child.classList.contains('landscape'))continue;
  if(child.nodeType===1)drawer.append(child);
 }
 // City selector is always available, even when online-only panels are absent.
 toggle.hidden=town.hidden;
}
const observer=new MutationObserver(records=>{
 if(records.some(r=>r.target===town&&Array.from(r.addedNodes).some(n=>n.nodeType===1&&n!==toggle&&n!==drawer))){
  if(!pending){pending=true;queueMicrotask(organize)}
 }
});
observer.observe(town,{childList:true});
organize();
})();