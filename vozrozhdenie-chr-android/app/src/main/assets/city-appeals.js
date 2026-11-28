(() => {
 'use strict';
 const town=document.getElementById('town');if(!town)return;
 const root=document.createElement('section');root.className='city-appeals';
 root.innerHTML='<h3>📜 Мои изгнания и апелляции</h3><p class="appeal-status" role="status">Для просмотра войди в онлайн-аккаунт.</p><div class="appeal-list"></div><button type="button" class="appeal-refresh">Обновить</button>';
 town.append(root);
 const status=root.querySelector('.appeal-status'),list=root.querySelector('.appeal-list'),refresh=root.querySelector('.appeal-refresh');
 let busy=false;
 function auth(){let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null}
 async function rpc(name,body){
  const a=auth();if(!a)throw Error('Нужен вход в аккаунт');
  const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){let msg='Ошибка '+response.status;try{const e=await response.json();if(e.message)msg=e.message}catch(_){}throw Error(msg)}
  return response.json();
 }
 async function load(){
  if(busy||document.hidden)return;
  if(!auth()){status.textContent='Войди в онлайн-аккаунт';list.replaceChildren();return}
  busy=true;refresh.disabled=true;
  try{
   const exiles=await rpc('city_my_exiles',{});
   list.replaceChildren();
   status.textContent=exiles.length?'История решений о твоём изгнании':'В истории нет изгнаний';
   for(const exile of exiles){
    const card=document.createElement('article');card.className='appeal-card';
    const title=document.createElement('strong');title.textContent=exile.city_name+' · '+new Date(exile.decided_at).toLocaleDateString('ru-RU');
    const note=document.createElement('p');note.textContent='Причина: '+exile.mayor_note;
    const ban=document.createElement('p');ban.textContent=exile.banned_until?'Запрет до: '+new Date(exile.banned_until).toLocaleDateString('ru-RU'):'Срок запрета истёк или изменён';
    card.append(title,note,ban);
    if(exile.appeal_status){
     const result=document.createElement('p');result.textContent='Апелляция: '+({pending:'на рассмотрении',accepted:'удовлетворена',rejected:'отклонена'}[exile.appeal_status]||exile.appeal_status);card.append(result);
    }else{
     const form=document.createElement('form');
     const label=document.createElement('label');label.textContent='Причина обжалования';
     const textarea=document.createElement('textarea');textarea.minLength=20;textarea.maxLength=2000;textarea.required=true;label.append(textarea);
     const button=document.createElement('button');button.type='submit';button.textContent='Подать апелляцию';
     form.append(label,button);
     form.addEventListener('submit',async e=>{
      e.preventDefault();button.disabled=true;
      try{await rpc('city_file_exile_appeal',{p_history_id:exile.history_id,p_statement:textarea.value.trim()});status.textContent='Апелляция отправлена';await load()}
      catch(error){status.textContent='Не удалось подать апелляцию: '+error.message}
      finally{button.disabled=false}
     });card.append(form);
    }
    list.append(card);
   }
  }catch(e){status.textContent='Не удалось загрузить историю: '+e.message}
  finally{busy=false;refresh.disabled=false}
 }
 refresh.addEventListener('click',load);
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 if(!town.hidden)load();
})();
