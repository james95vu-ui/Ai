(() => {
 'use strict';
 const town=document.getElementById('town');if(!town)return;
 const root=document.createElement('section');
 root.className='completed-buildings';
 root.innerHTML='<div class="completed-head"><h3>🏘️ Построенные объекты города</h3><button type="button" class="completed-refresh">Обновить</button></div><p class="completed-status" role="status">Для просмотра городских объектов войди в онлайн-аккаунт.</p><div class="completed-map" aria-label="Схема построенных объектов"></div>';
 town.append(root);
 const status=root.querySelector('.completed-status'),map=root.querySelector('.completed-map'),refresh=root.querySelector('.completed-refresh');
 const key='vozrozhdenie_social_session_v1';
 let busy=false;
 function icon(title){if(/школ/i.test(title))return '🏫';if(/больниц/i.test(title))return '🏥';if(/парк/i.test(title))return '🌳';if(/мост/i.test(title))return '🌉';if(/спорт/i.test(title))return '🏟️';if(/библиотек/i.test(title))return '📚';if(/науч/i.test(title))return '🔬';if(/культур/i.test(title))return '🎭';if(/мастерск/i.test(title))return '🏭';return '🏠'}
 async function rpc(name,body,access,cfg){
  const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok)throw Error('HTTP '+res.status);
  return res.json();
 }
 async function load(){
  if(busy||document.hidden)return;
  let session;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){}
  const cfg=window.GAME_CONFIG||{};
  if(!session?.access_token||!cfg.url||!cfg.key){status.textContent='Войди в онлайн-аккаунт, чтобы увидеть построенные объекты';map.replaceChildren();return}
  busy=true;refresh.disabled=true;
  try{
   const me=await rpc('city_my_progress',{},session.access_token,cfg);
   if(!me.length){status.textContent='Выбери город в онлайн-профиле';map.replaceChildren();return}
   const buildings=await rpc('city_completed_buildings',{p_city_id:me[0].city_id},session.access_token,cfg);
   map.replaceChildren();
   for(const building of buildings){
    const tile=document.createElement('div');tile.className='completed-tile';
    const emoji=document.createElement('span');emoji.className='completed-icon';emoji.textContent=icon(building.title);
    const title=document.createElement('span');title.textContent=building.title;
    const caption=document.createElement('small');caption.textContent='Ур. '+building.upgrade_level+'/5 · участников: '+Number(building.workers).toLocaleString('ru-RU');
    tile.append(emoji,title,caption);
    if(building.next_upgrade_cost!==null){
     const bar=document.createElement('progress');bar.max=Number(building.next_upgrade_cost);bar.value=Number(building.upgrade_progress);bar.setAttribute('aria-label','Прогресс улучшения');
     const info=document.createElement('small');info.textContent=Number(building.upgrade_progress).toLocaleString('ru-RU')+' / '+Number(building.next_upgrade_cost).toLocaleString('ru-RU')+' очков';
     const form=document.createElement('form');form.className='completed-upgrade-form';
     const input=document.createElement('input');input.type='number';input.min='1';input.max=String(Math.min(100000,Number(building.next_upgrade_cost)-Number(building.upgrade_progress)));input.value='1';input.required=true;input.setAttribute('aria-label','Очки для улучшения');
     const button=document.createElement('button');button.type='submit';button.textContent='Улучшить';
     form.append(input,button);
     form.addEventListener('submit',async event=>{
      event.preventDefault();
      const points=Number(input.value);
      if(!Number.isSafeInteger(points)||points<1||points>Number(input.max)){status.textContent='Недопустимый размер вклада';return}
      button.disabled=true;
      try{
       await rpc('city_upgrade_building',{p_project_id:building.building_id,p_points:points},session.access_token,cfg);
       status.textContent='Очки на улучшение приняты';
       await load();
      }catch(e){status.textContent='Не удалось улучшить здание: '+e.message}
      finally{button.disabled=false}
     });
     tile.append(bar,info,form);
    }
    map.append(tile);
   }
   status.textContent=me[0].city_name+' · построено '+buildings.length+' из 100 объектов';
   if(!buildings.length){const empty=document.createElement('p');empty.textContent='Здесь появятся здания, которые жители достроят вместе.';map.append(empty)}
  }catch(e){status.textContent='Не удалось загрузить здания: '+e.message}
  finally{busy=false;refresh.disabled=false}
 }
 refresh.addEventListener('click',load);
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 if(!town.hidden)load();
})();
