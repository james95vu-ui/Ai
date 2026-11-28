(() => {
 'use strict';
 // Offline taps remain local; only accepted online taps mint server coins.
 const button=document.getElementById('tap');
 const key='vozrozhdenie_social_session_v1';
 let pending=false,last=0,accepted=0;
 button?.addEventListener('click',async()=>{
  const now=Date.now();if(pending||now-last<220)return;
  const cfg=window.GAME_CONFIG||{};
  let session;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){session=null}
  if(!cfg.url||!cfg.key||!navigator.onLine)return;
  last=now;pending=true;
  try{
   if(window.gameEnsureSession) session=await window.gameEnsureSession();
   if(!session?.access_token) throw Error('Нет онлайн-сессии');
   const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/tycoon_record_tap',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'
   });
   if(!response.ok){let msg='HTTP '+response.status;try{const error=await response.json();msg=error.message||msg}catch(_){}throw Error(msg)}
   const rows=await response.json();accepted++;
   window.dispatchEvent(new Event('game:refresh-cities'));
   window.dispatchEvent(new CustomEvent('game:online-tap',{detail:{accepted,serverEarned:rows?.[0]?.earned}}));
  }catch(e){
   // Never claim a rejected tap earned server money.
   const notice=document.getElementById('network');
   if(notice)notice.textContent='Онлайн-нажатие не засчитано: '+e.message;
  }finally{pending=false}
 });
})();