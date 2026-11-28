(() => {
 'use strict';
 const section=document.getElementById('team');
 if(!section)return;
 const root=document.createElement('section');
 root.className='city-league tycoon-card';
 root.setAttribute('aria-label','Развитие городов');
 root.innerHTML='<h3>🏙️ Соревнование городов</h3><p class="city-league-status" role="status">Загружаем таблицу городов…</p><div class="city-league-list" aria-live="polite"></div>';
 section.insertBefore(root,section.querySelector('.tycoon-card'));
 const status=root.querySelector('.city-league-status');
 const list=root.querySelector('.city-league-list');
 const fmt=value=>Number(value).toLocaleString('ru-RU');
 let loading=false;
 function line(city,position){
  const row=document.createElement('div');row.className='city-league-item';
  const heading=document.createElement('div');heading.className='city-league-heading';
  const title=document.createElement('strong');
  title.textContent=position+'. '+city.city_name;
  const meta=document.createElement('span');
  meta.textContent='Ур. '+city.city_level+' · '+fmt(city.member_count)+' жителей';
  heading.append(title,meta);
  const score=document.createElement('div');score.className='city-league-score';
  score.textContent=fmt(city.total_contribution)+' очков развития';
  row.append(heading,score);return row;
 }
 async function refresh(){
  if(loading||document.hidden)return;
  const cfg=window.GAME_CONFIG||{};
   if(!cfg.url||!cfg.key){status.textContent='Сервер не настроен';return}
 
  loading=true;
  try{
   const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/city_leaderboard',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'},body:'{}'
   });
   if(!response.ok){const e=await response.json().catch(()=>({}));throw Error(e.message||'HTTP '+response.status);}
   const rows=await response.json();
   if(!Array.isArray(rows))throw Error('Некорректный ответ');
   list.replaceChildren(...rows.map((city,index)=>line(city,index+1)));
   status.textContent=rows.length+' городов · очки начисляются за подтверждённые сервером тапы';
  }catch(e){status.textContent='Не удалось обновить города: '+e.message}
  finally{loading=false}
 }
 window.addEventListener('game:refresh-cities',()=>{if(!section.hidden)refresh()});
 document.querySelector('[data-go="team"]')?.addEventListener('click',()=>setTimeout(refresh,0));
 window.addEventListener('online',refresh);
 window.addEventListener('game:auth-changed',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!section.hidden)refresh()});
 setInterval(()=>{if(!document.hidden&&!section.hidden)refresh()},10000);
 if(!section.hidden)refresh();
})();
