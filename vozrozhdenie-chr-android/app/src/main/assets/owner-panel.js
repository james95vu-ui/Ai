(() => {
 'use strict';
 const root=document.createElement('section');
 root.className='owner-panel';root.hidden=true;
 root.innerHTML='<h3>🛡️ Панель владельца</h3><p class="owner-status" role="status">Проверка полномочий…</p><button type="button" class="owner-refresh">Обновить жалобы и апелляции</button><div class="owner-queue"></div>';
 const town=document.getElementById('town');if(!town)return;town.append(root);
 const status=root.querySelector('.owner-status'),queue=root.querySelector('.owner-queue'),refresh=root.querySelector('.owner-refresh');
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
  if(!auth()){root.hidden=true;return}
  busy=true;refresh.disabled=true;
  try{
   const isOwner=await rpc('game_is_owner',{});
   if(!isOwner){root.hidden=true;queue.replaceChildren();return}
   root.hidden=false;
   const items=await rpc('game_owner_queue',{});
   queue.replaceChildren();
   status.textContent=items.length?'На проверке: '+items.length:'Нет жалоб и апелляций на проверке';
   for(const item of items){
    const card=document.createElement('article');card.className='owner-item';
    const title=document.createElement('strong');title.textContent=(item.kind==='complaint'?'Жалоба':'Апелляция')+' №'+item.item_id+' · '+item.city_name;
    const player=document.createElement('p');player.textContent='Игрок: '+item.subject_id;
    const description=document.createElement('p');description.textContent=item.description;
    const form=document.createElement('form');
    const label=document.createElement('label');label.textContent='Обоснование решения';
    const note=document.createElement('textarea');note.minLength=10;note.maxLength=1000;note.required=true;label.append(note);
    const approve=document.createElement('button');approve.type='button';approve.textContent=item.kind==='complaint'?'Подтвердить жалобу':'Удовлетворить апелляцию';
    const reject=document.createElement('button');reject.type='button';reject.textContent='Отклонить';
    async function decide(accepted){
     if(!form.reportValidity())return;
     if(!confirm('Подтвердить решение? Оно будет записано в журнал.'))return;
     approve.disabled=reject.disabled=true;
     try{
      const name=item.kind==='complaint'?'game_owner_review_complaint':'game_owner_review_appeal';
      const body=item.kind==='complaint'?{p_complaint_id:item.item_id,p_approve:accepted,p_note:note.value.trim()}:{p_appeal_id:item.item_id,p_accept:accepted,p_note:note.value.trim()};
      await rpc(name,body);status.textContent='Решение сохранено';card.remove();
     }catch(e){status.textContent='Ошибка решения: '+e.message}
     finally{approve.disabled=reject.disabled=false}
    }
    approve.addEventListener('click',()=>decide(true));
    reject.addEventListener('click',()=>decide(false));
    form.append(label,approve,reject);card.append(title,player,description,form);queue.append(card);
   }
  }catch(e){root.hidden=true;status.textContent='Не удалось проверить полномочия: '+e.message}
  finally{busy=false;refresh.disabled=false}
 }
 refresh.addEventListener('click',load);
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 if(!town.hidden)load();
})();
