(() => {
 'use strict';
 // Competitive taps are recorded independently of offline coins.
 const button=document.getElementById('tap');
 const key='vozrozhdenie_social_session_v1';
 let pending=false,last=0;
 button?.addEventListener('click',async()=>{
  const now=Date.now();if(pending||now-last<220)return;
  const cfg=window.GAME_CONFIG||{};
  let session;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){session=null}
  if(!session?.access_token||!cfg.url||!cfg.key||!navigator.onLine)return;
  last=now;pending=true;
  try{
   await fetch(cfg.url.replace(/\\/$/,'')+'/rest/v1/rpc/tycoon_record_tap',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'
   });
  }catch(_){/* Offline play continues; rejected taps are not ranked. */}
  finally{pending=false}
 });
})();
