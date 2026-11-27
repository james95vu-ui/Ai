(() => {
 'use strict';
 const town=document.getElementById('town');
 if(!town)return;
 const root=document.createElement('section');
 root.className='community-build';
 root.innerHTML='<h3>🏗️ Общие стройки</h3><p class="build-status" role="status">Войди в онлайн-аккаунт для совместного строительства.</p><div class="build-controls"><label>Объект <select class="build-project"></select></label><div class="build-progress" hidden><progress max="100" value="0"></progress><p class="build-details"></p></div><form class="build-form"><label>Вложить заработанные очки <input type="number" min="1" max="100000" value="1" required></label><button type="submit">Внести вклад</button></form><button type="button" class="build-refresh">Обновить стройки</button></div>';
 town.append(root);
 const status=root.querySelector('.build-status'),select=root.querySelector('.build-project'),details=root.querySelector('.build-details'),bar=root.querySelector('progress'),progress=root.querySelector('.build-progress'),form=root.querySelector('.build-form'),refreshButton=root.querySelector('.build-refresh');
 const key='vozrozhdenie_social_session_v1',fmt=n=>Number(n).toLocaleString('ru-RU');
 let rows=[],cityId=null,busy=false;
 const auth=()=>{let session;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch(_){};const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null};
 async function rpc(name,body){
  const access=auth();if(!access)throw Error('Сначала войди в онлайн-аккаунт');
  const response=await fetch(access.cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:access.cfg.key,Authorization:'Bearer '+access.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){let msg='HTTP '+response.status;try{const error=await response.json();if(error.message)msg=error.message}catch(_){}throw Error(msg)}
  return response.json();
 }
 function display(){
  const item=rows.find(p=>String(p.project_id)===select.value);
  progress.hidden=!item;form.hidden=!item||item.completed;
  if(!item)return;
  bar.value=Math.min(100,Number(item.contributed_points)/Number(item.required_points)*100);
  details.textContent=fmt(item.contributed_points)+' / '+fmt(item.required_points)+' очков · участников: '+fmt(item.workers)+(item.completed?' · Построено':'');
 }
 async function load(){
  if(busy||document.hidden)return;
  busy=true;refreshButton.disabled=true;
  try{
   const me=await rpc('city_my_progress',{});
   if(!me.length){status.textContent='Выбери город в онлайн-профиле';root.querySelector('.build-controls').hidden=true;return}
   const previous=select.value;
   cityId=me[0].city_id;
   rows=await rpc('city_project_list',{p_city_id:cityId});
   select.replaceChildren(...rows.map(p=>{const option=document.createElement('option');option.value=p.project_id;option.textContent=p.title+(p.completed?' ✓':'');return option}));
   if(rows.some(p=>String(p.project_id)===previous))select.value=previous;
   root.querySelector('.build-controls').hidden=false;
   status.textContent=me[0].city_name+' · '+rows.length+' общественных объектов';
   display();
  }catch(e){status.textContent='Не удалось загрузить стройки: '+e.message;root.querySelector('.build-controls').hidden=true}
  finally{busy=false;refreshButton.disabled=false}
 }
 select.addEventListener('change',display);
 refreshButton.addEventListener('click',load);
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const amount=Number(form.querySelector('input').value);
  if(!Number.isSafeInteger(amount)||amount<1||amount>100000){status.textContent='Укажи от 1 до 100 000 очков';return}
  busy=true;form.querySelector('button').disabled=true;
  try{
   const result=await rpc('city_project_contribute',{p_project_id:Number(select.value),p_points:amount});
   status.textContent='Вклад принят! Осталось свободных очков: '+fmt(result[0].remaining_allocatable);
  }catch(e){status.textContent='Вклад не принят: '+e.message}
  finally{busy=false;form.querySelector('button').disabled=false}
  await load();
 });
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 if(!town.hidden)load();
})();
