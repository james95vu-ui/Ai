(()=>{'use strict';
const map=document.getElementById('map'),details=document.getElementById('details');
if(!map||!details)return;
let lastSelected=null;
function refresh(){
 const buttons=Array.from(map.querySelectorAll('.city-building'));
 for(const button of buttons){
  const built=button.classList.contains('built');
  const selected=button.classList.contains('selected');
  button.setAttribute('aria-pressed',String(selected));
  button.setAttribute('aria-description',built?'Здание построено. Нажмите для улучшения.':'Нажмите, чтобы открыть строительство.');
  if(selected&&button!==lastSelected){
   lastSelected=button;
   button.classList.remove('city-building-spotlight');
   void button.offsetWidth;
   button.classList.add('city-building-spotlight');
  }
 }
 if(!buttons.some(button=>button===lastSelected))lastSelected=null;
}
const observer=new MutationObserver(records=>{
 if(records.some(r=>r.target===map||r.target===details))refresh();
});
observer.observe(map,{childList:true});
observer.observe(details,{childList:true,attributes:true,attributeFilter:['hidden']});
document.addEventListener('keydown',event=>{
 if(event.key!=='Escape'||details.hidden)return;
 const close=details.querySelector('.city-details-close');
 if(close){close.click();lastSelected?.focus({preventScroll:true});}
});
refresh();
})();