(()=>{'use strict';
const town=document.getElementById('town'),landscape=town?.querySelector(':scope > .landscape'),map=document.getElementById('map'),development=town?.querySelector(':scope > .development');
if(!town||!landscape||!map)return;
const important=(el,values)=>{if(!el)return;for(const [key,value] of Object.entries(values))el.style.setProperty(key,value,'important')};
function repair(){
 if(town.hidden)return;
 const viewport=window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight;
 const top=Math.max(150,Math.min(190,Math.round(viewport*.17)));
 const bottom=Math.max(88,Math.min(116,Math.round(viewport*.085)));
 const height=Math.max(260,Math.round(viewport-top-bottom));
 important(landscape,{display:'block',position:'fixed',top:top+'px',bottom:bottom+'px',left:'0',right:'0',width:'100%',height:height+'px','min-height':'0','max-height':'none',overflow:'hidden',visibility:'visible',opacity:'1','z-index':'1',transform:'none'});
 important(map,{display:'block',position:'absolute',top:'0',left:'0',right:'0',bottom:'0',width:'100%',height:'100%','min-height':'0','max-height':'none',visibility:'visible',opacity:'1',overflow:'hidden'});
 const scenery=map.querySelector('.city-scenery');
 important(scenery,{display:'block',position:'absolute',inset:'0',width:'100%',height:'100%',visibility:'visible',opacity:'1'});
 important(development,{display:'block',position:'fixed',bottom:Math.max(74,bottom-45)+'px',left:'8px',right:'8px',visibility:'visible','z-index':'85'});
}
window.addEventListener('resize',repair);window.visualViewport?.addEventListener('resize',repair);
new MutationObserver(repair).observe(town,{attributes:true,attributeFilter:['hidden']});
new MutationObserver(()=>{if(!town.hidden)repair()}).observe(map,{childList:true});
document.querySelector('[data-go="town"]')?.addEventListener('click',()=>requestAnimationFrame(repair));
repair();requestAnimationFrame(repair);
})();