(() => {
 'use strict';
 const town=document.getElementById('town');
 if(!town)return;
 const widget=document.createElement('section');
 widget.className='city-online-progress';
 widget.setAttribute('aria-label','Общий прогресс города');
 widget.innerHTML='<div class="city-online-head"><h3>🏗️ Развитие твоего города</h3><button type="button" class="city-online-reload">↻</button></div><p class="city-online-status" role="status">Для общего прогресса войди в онлайн-аккаунт.</p><div class="city-online-data" hidden><div class="city-online-summary"></div><progress class="city-online-bar" max="100" value="0" aria-label="Прогресс до следующего уровня"></progress><p class="city-online-target"></p><p class="city-online-personal"></p></div>';
 const development=town.querySelector('.development');
 if(development)development.after(widget);else town.prepend(widget);
 const status=widget.querySelector('.city-online-status'),data=widget.querySelector('.city-online-data'),reload=widget.querySelector('.city-online-reload');
 const summary=widget.querySelector('.city-online-summary'),bar=widget.querySelector('.city-online-bar'),target=widget.querySelector('.city-online-target'),personal=widget.querySelector('.city-online-personal');
 const fmt=n=>Number(n).toLocaleString('ru-RU');
 const key='vozrozhdenie_social_session_v1';
 let busy=false;
 async function refresh(){
  if(busy||document.hidden)return;
  const cfg=window.GAME_CONFIG||{};
  let session;
  try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){session=null}
  if(!cfg.url||!cfg.key){status.textContent='Онлайн-сервер не настроен';data.hidden=true;return}
  if(!session?.access_token){status.textContent='Войди в «Сообщество», чтобы увидеть общий прогресс';data.hidden=true;return}
  busy=true;reload.disabled=true;
  try{
   const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/city_my_progress',{
    method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'
   });
   if(!response.ok)throw Error('HTTP '+response.status);
   const rows=await response.json();
   if(!Array.isArray(rows))throw Error('Некорректный ответ сервера');
   if(!rows.length){status.textContent='Выбери город в онлайн-профиле, чтобы участвовать в строительстве';data.hidden=true;return}
   const city=rows[0],current=Number(city.total_contribution),start=Number(city.previous_threshold),next=city.next_threshold===null?null:Number(city.next_threshold);
   const percent=next===null?100:Math.max(0,Math.min(100,(current-start)/(next-start)*100));
   summary.textContent=city.city_name+' · уровень '+city.city_level+' из 20';
   bar.value=percent;
   target.textContent=next===null?'Максимальный уровень достигнут!':fmt(current)+' / '+fmt(next)+' очков · '+Math.floor(percent)+'% уровня';
   personal.textContent='Твой вклад: '+fmt(city.personal_contribution)+' очков';
   status.textContent='Серверный прогресс · обновляется раз в минуту';
   data.hidden=false;
  }catch(e){status.textContent='Не удалось получить прогресс: '+e.message;data.hidden=true}
  finally{busy=false;reload.disabled=false}
 }
 reload.addEventListener('click',refresh);
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(refresh,0));
 window.addEventListener('online',refresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!town.hidden)refresh()});
 setInterval(()=>{if(!document.hidden&&!town.hidden)refresh()},60000);
 if(!town.hidden)refresh();
})();
