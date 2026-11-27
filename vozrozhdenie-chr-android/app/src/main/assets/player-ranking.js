(() => {
 'use strict';
 const list=document.getElementById('player-ranking');
 const status=document.getElementById('player-ranking-status');
 const button=document.getElementById('player-ranking-refresh');
 const key='vozrozhdenie_social_session_v1';
 const fmt=n=>Number(n).toLocaleString('ru-RU');
 let busy=false;
 async function load(){
  if(busy||document.hidden)return;
  const cfg=window.GAME_CONFIG||{};
  let session;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){session=null}
  if(!cfg.url||!cfg.key){status.textContent='Сервер пока не настроен';return}
  if(!session?.access_token){status.textContent='Войди в разделе «Сообщество», чтобы увидеть рейтинг игроков';return}
  busy=true;button.disabled=true;
  try{
   const response=await fetch(cfg.url.replace(/\\/$/,'')+'/rest/v1/rpc/tycoon_player_ranking',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_limit:50})
   });
   if(!response.ok)throw Error('HTTP '+response.status);
   const rows=await response.json();list.replaceChildren();
   for(const player of rows){
    const item=document.createElement('div');item.className='rank';
    item.textContent=player.rank+'. '+player.nickname+' · '+fmt(player.coins)+' кредитов · '+fmt(player.materials)+' материалов';
    list.append(item);
   }
   status.textContent=rows.length?'Рейтинг по серверным кредитам · топ '+rows.length:'Пока нет участников';
  }catch(e){status.textContent='Не удалось получить рейтинг игроков: '+e.message}
  finally{busy=false;button.disabled=false}
 }

 async function tapRanking(){
  const cfg=window.GAME_CONFIG||{};
  let session;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){session=null}
  if(!session?.access_token||!cfg.url||!cfg.key)return;
  try{
   const response=await fetch(cfg.url.replace(/\\/$/,'')+'/rest/v1/rpc/tycoon_tap_ranking',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_limit:50})
   });
   if(!response.ok)return;
   const rows=await response.json();
   const target=document.getElementById('tap-ranking');if(!target)return;
   target.replaceChildren();
   for(const player of rows){const item=document.createElement('div');item.className='rank';item.textContent=player.rank+'. '+player.nickname+' · '+fmt(player.taps)+' тапов · '+fmt(player.earned)+' очков';target.append(item)}
  }catch(_){/* Offline: retain previously shown rankings */}
 }
 button.addEventListener('click',()=>{load();tapRanking()});
 document.querySelector('[data-go="team"]')?.addEventListener('click',()=>setTimeout(()=>{load();tapRanking()},0));
 window.addEventListener('online',load);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
 setInterval(()=>{if(!document.hidden&&!document.getElementById('team').hidden){load();tapRanking()}},60000);
})();
