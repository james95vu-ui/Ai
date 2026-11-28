(() => {
 'use strict';
 const section=document.getElementById('team');
 if(!section)return;
 const root=document.createElement('section');
 root.className='city-league tycoon-card';
 root.setAttribute('aria-label','Развитие городов');
 root.innerHTML='<h3>🏙️ Соревнование городов</h3><p class="city-league-status" role="status">Для городского рейтинга войди в онлайн-аккаунт.</p><div class="city-league-list" aria-live="polite"></div><button type="button" class="city-league-refresh">Обновить города</button>';
 section.insertBefore(root,section.querySelector('#social')||null);
 const status=root.querySelector('.city-league-status');
 const list=root.querySelector('.city-league-list');
 const button=root.querySelector('.city-league-refresh');
 const sessionKey='vozrozhdenie_social_session_v1';
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
  let session;
  try{session=JSON.parse(localStorage.getItem(sessionKey)||'null')}catch(_){session=null}
  if(!cfg.url||!cfg.key){status.textContent='Сервер не настроен';return}
  if(!session?.access_token){status.textContent='Войди в «Сообщество», чтобы увидеть соревнование городов';list.replaceChildren();return}
  loading=true;button.disabled=true;
  try{
   const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/city_leaderboard',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'
   });
   if(!response.ok)throw Error('HTTP '+response.status);
   const rows=await response.json();
   if(!Array.isArray(rows))throw Error('Некорректный ответ');
   list.replaceChildren(...rows.map((city,index)=>line(city,index+1)));
   status.textContent=rows.length+' городов · очки начисляются за подтверждённые сервером тапы';
  }catch(e){status.textContent='Не удалось обновить города: '+e.message}
  finally{loading=false;button.disabled=false}
 }
 button.addEventListener('click',refresh);
 document.querySelector('[data-go="team"]')?.addEventListener('click',()=>setTimeout(refresh,0));
 window.addEventListener('online',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!section.hidden)refresh()});
 setInterval(()=>{if(!document.hidden&&!section.hidden)refresh()},60000);
 if(!section.hidden)refresh();
})();
