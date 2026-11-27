(() => {
 'use strict';
 const town=document.getElementById('town');if(!town)return;
 const root=document.createElement('section');root.className='city-governance';
 root.innerHTML='<h3>⚖️ Управление городом</h3><p class="governance-status" role="status">Для городского управления нужен онлайн-аккаунт.</p><form class="complaint-form"><h4>Жалоба на жителя</h4><label>ID игрока <input name="accused" required placeholder="UUID игрока"></label><label>Описание нарушения <textarea name="reason" minlength="20" maxlength="1000" required placeholder="Не менее 20 символов"></textarea></label><button type="submit">Отправить жалобу</button></form><form class="deputy-form" hidden><h4>Назначить заместителя</h4><label>ID жителя <input name="deputy" required placeholder="UUID игрока"></label><button type="submit">Назначить</button></form><form class="remove-deputy-form" hidden><h4>Снять заместителя</h4><label>ID заместителя <input name="deputy" required placeholder="UUID игрока"></label><button type="submit">Снять</button></form>';
 town.append(root);
 const status=root.querySelector('.governance-status'),deputyForm=root.querySelector('.deputy-form'),removeForm=root.querySelector('.remove-deputy-form');
 const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 function auth(){
  let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
  const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null;
 }
 async function rpc(name,body){
  const a=auth();if(!a)throw Error('Сначала войди в аккаунт');
  const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){let msg='Ошибка '+response.status;try{const e=await response.json();if(e.message)msg=e.message}catch(_){}throw Error(msg)}
  return response.json();
 }
 async function refresh(){
  deputyForm.hidden=true;removeForm.hidden=true;
  const a=auth();if(!a){status.textContent='Войди в онлайн-аккаунт';return}
  try{
   const me=await rpc('city_my_progress',{});
   if(!me.length){status.textContent='Выбери город в онлайн-профиле';return}
   const terms=await rpc('city_mayor_overview',{p_city_id:me[0].city_id});
   const isMayor=terms.length&&terms[0].mayor===a.session.user?.id;
   deputyForm.hidden=!isMayor;removeForm.hidden=!isMayor;
   status.textContent=isMayor?'Ты мэр: можешь назначить до двух заместителей.':'Жители могут сообщать о нарушениях.';
  }catch(e){status.textContent='Ошибка проверки полномочий: '+e.message}
 }
 function wire(form,action,field){
  form.addEventListener('submit',async e=>{
   e.preventDefault();
   const id=form.elements[field].value.trim();
   if(!uuid.test(id)){status.textContent='Укажи корректный ID игрока';return}
   const button=form.querySelector('button');button.disabled=true;
   try{
    const body=action==='city_file_complaint'?{p_accused:id,p_reason:form.elements.reason.value.trim()}:{p_deputy:id};
    await rpc(action,body);
    status.textContent=action==='city_file_complaint'?'Жалоба отправлена на проверку':'Изменение заместителя сохранено';
    form.reset();await refresh();
   }catch(error){status.textContent='Действие не выполнено: '+error.message}
   finally{button.disabled=false}
  });
 }
 wire(root.querySelector('.complaint-form'),'city_file_complaint','accused');
 wire(deputyForm,'city_appoint_deputy','deputy');
 removeForm.addEventListener('submit',async e=>{
  e.preventDefault();const id=removeForm.elements.deputy.value.trim();
  if(!uuid.test(id)){status.textContent='Укажи корректный ID заместителя';return}
  const button=removeForm.querySelector('button');button.disabled=true;
  try{await rpc('city_remove_deputy',{p_deputy:id});status.textContent='Заместитель снят';removeForm.reset()}
  catch(error){status.textContent='Не удалось снять заместителя: '+error.message}
  finally{button.disabled=false}
 });
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(refresh,0));
 if(!town.hidden)refresh();
})();
