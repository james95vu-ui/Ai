(() => {
 'use strict';
 const root=document.createElement('section');
 root.className='owner-panel';root.hidden=true;
 root.innerHTML='<h3>🛡️ Панель владельца</h3><p class="owner-status" role="status">Проверка полномочий…</p><button type="button" class="owner-refresh">Обновить жалобы и апелляции</button><div class="owner-queue"></div>';
 const town=document.getElementById('town');if(!town)return;town.append(root);

 const center=document.createElement('div');center.className='owner-control-center';
 center.innerHTML='<h4>Центр управления</h4><div class="owner-stats"></div><form class="owner-search"><label>Найти игрока по email или UUID<input name="query" required minlength="3"></label><button>Найти</button></form><div class="owner-players"></div><form class="owner-action"><label>Действие<select name="action"><option value="add_coins">Добавить / списать монеты</option><option value="set_coins">Установить баланс монет</option><option value="add_materials">Добавить / списать материалы</option><option value="set_materials">Установить материалы</option><option value="appoint_mayor">Назначить мэра</option><option value="announce">Опубликовать объявление</option><option value="close_announcement">Закрыть объявление</option></select></label><label>Игрок UUID / заголовок / ID объявления<input name="target" required></label><label>Количество / текст объявления<input name="value"></label><label>Причина действия<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Выполнить с подтверждением</button></form><h4>Последние действия</h4><button type="button" class="owner-audit-refresh">Показать журнал</button><div class="owner-audit"></div>';
 root.insertBefore(center,root.querySelector('.owner-queue'));
 const stats=center.querySelector('.owner-stats'),players=center.querySelector('.owner-players'),audit=center.querySelector('.owner-audit');
 async function loadStats(){
  const d=await rpc('game_owner_dashboard',{});
  stats.textContent='Игроков: '+d.users+' · жителей: '+d.members+' · городов: '+d.cities.length+' · мэров: '+d.mayors+' · жалоб на проверке: '+d.pending_complaints+' · подтверждённых: '+d.validated_complaints+' · апелляций: '+d.pending_appeals+' · активных запретов: '+d.active_bans;
  const list=document.createElement('div');list.className='owner-cities';
  for(const city of d.cities){const line=document.createElement('p');line.textContent=city.name+' · '+Number(city.points).toLocaleString('ru-RU')+' очков';list.append(line)}
  stats.append(list);
 }
 center.querySelector('.owner-search').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('button');button.disabled=true;
  try{
   const found=await rpc('game_owner_find_player',{p_query:e.currentTarget.elements.query.value.trim()});
   players.replaceChildren();
   for(const p of found){const row=document.createElement('button');row.type='button';row.textContent=(p.email||p.player_id)+' · '+(p.city||'без города')+' · монеты: '+(p.coins??0)+' · материалы: '+(p.materials??0)+' · тапы: '+(p.taps??0);row.addEventListener('click',()=>{center.querySelector('.owner-action').elements.target.value=p.player_id});players.append(row)}
   if(!found.length)players.textContent='Игрок не найден';
  }catch(error){status.textContent=error.message}
  finally{button.disabled=false}
 });
 center.querySelector('.owner-action').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,fields=form.elements;
  const action=fields.action.value,target=fields.target.value.trim(),value=fields.value.value.trim(),reason=fields.reason.value.trim();
  if(!confirm('Подтвердить административное действие «'+action+'»? Оно изменит реальные данные игры.'))return;
  const button=form.querySelector('button');button.disabled=true;
  try{const result=await rpc('game_owner_action',{p_action:action,p_target:target,p_value:value,p_reason:reason});status.textContent='Действие выполнено: '+JSON.stringify(result);await loadStats()}
  catch(error){status.textContent='Действие отклонено: '+error.message}
  finally{button.disabled=false}
 });
 center.querySelector('.owner-audit-refresh').addEventListener('click',async()=>{
  try{
   const records=await rpc('game_owner_audit',{p_limit:50});audit.replaceChildren();
   for(const a of records){const p=document.createElement('p');p.textContent=new Date(a.created_at).toLocaleString('ru-RU')+' · '+a.action+' · '+(a.note||'');audit.append(p)}
  }catch(error){status.textContent=error.message}
 });

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
   await loadStats();
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
