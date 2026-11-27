(() => {
 'use strict';
 const root=document.createElement('section');
 root.className='owner-panel';root.hidden=true;
 root.innerHTML='<h3>🛡️ Панель владельца</h3><p class="owner-status" role="status">Проверка полномочий…</p><button type="button" class="owner-refresh">Обновить жалобы и апелляции</button><div class="owner-queue"></div>';
 const town=document.getElementById('town');if(!town)return;
 const main=document.querySelector('main');const nav=document.querySelector('.game-nav');
 const screen=document.createElement('section');screen.id='owner-admin';screen.dataset.screen='';screen.hidden=true;screen.className='owner-admin-screen';
 screen.append(root);main.append(screen);
 const tab=document.createElement('button');tab.type='button';tab.dataset.go='owner-admin';tab.setAttribute('aria-controls','owner-admin');tab.innerHTML='<span aria-hidden="true">🛡</span>Админ';tab.hidden=true;nav.append(tab);
 let lastToken='';

 const center=document.createElement('div');center.className='owner-control-center';
 center.innerHTML='<h4>Центр управления</h4><div class="owner-stats"></div><form class="owner-search"><label>Найти игрока по email или UUID<input name="query" required minlength="3"></label><button>Найти</button></form><div class="owner-players"></div><form class="owner-action"><label>Действие<select name="action"><option value="add_coins">Добавить / списать монеты</option><option value="set_coins">Установить баланс монет</option><option value="add_materials">Добавить / списать материалы</option><option value="set_materials">Установить материалы</option><option value="appoint_mayor">Назначить мэра</option><option value="announce">Опубликовать объявление</option><option value="close_announcement">Закрыть объявление</option></select></label><label>Игрок UUID / заголовок / ID объявления<input name="target" required></label><label>Количество / текст объявления<input name="value"></label><label>Причина действия<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Выполнить с подтверждением</button></form><h4>Последние действия</h4><button type="button" class="owner-audit-refresh">Показать журнал</button><div class="owner-audit"></div>';
 root.insertBefore(center,root.querySelector('.owner-queue'));

 const reports=document.createElement('section');reports.className='owner-chat-reports';
 reports.innerHTML='<h4>🚩 Жалобы на сообщения</h4><button type="button" class="owner-chat-report-refresh">Обновить жалобы</button><div class="owner-chat-report-list"></div>';
 center.append(reports);
 async function loadChatReports(){
  const list=reports.querySelector('.owner-chat-report-list');list.replaceChildren();
  try{
   const items=await rpc('game_owner_chat_reports',{});
   if(!items.length){list.textContent='Новых жалоб нет';return}
   for(const item of items){
    const card=document.createElement('article');card.className='owner-item';
    const description=document.createElement('p');description.textContent='Жалоба #'+item.report_id+' · Комната #'+item.room_id+' · Автор '+item.author+' · Заявитель '+item.reporter+' · Сообщение: '+item.body+' · Причина: '+item.reason;
    const note=document.createElement('textarea');note.placeholder='Причина решения (10–1000 символов)';note.minLength=10;note.maxLength=1000;
    const hide=document.createElement('button');hide.type='button';hide.textContent='Скрыть сообщение';
    const reject=document.createElement('button');reject.type='button';reject.textContent='Отклонить жалобу';
    async function decide(shouldHide){
     if(note.value.trim().length<10){status.textContent='Напиши причину решения';return}
     if(!confirm('Подтвердить решение по жалобе #'+item.report_id+'?'))return;
     hide.disabled=reject.disabled=true;
     try{await rpc('game_owner_review_chat_report',{p_report_id:item.report_id,p_hide:shouldHide,p_reason:note.value.trim()});card.remove();status.textContent='Жалоба рассмотрена'}
     catch(error){status.textContent=error.message}
     finally{hide.disabled=reject.disabled=false}
    }
    hide.addEventListener('click',()=>decide(true));reject.addEventListener('click',()=>decide(false));
    card.append(description,note,hide,reject);list.append(card);
   }
  }catch(error){status.textContent='Ошибка загрузки жалоб: '+error.message}
 }
 reports.querySelector('.owner-chat-report-refresh').addEventListener('click',loadChatReports);


 const sanctions=document.createElement('section');sanctions.className='owner-sanctions-center';
 sanctions.innerHTML='<h4>🚫 Санкции игроков</h4><form class="owner-sanction-form"><label>UUID игрока<input name="player" required></label><label>Область<select name="scope"><option value="public_chat">Публичные чаты</option><option value="gameplay">Игровая блокировка (частичная интеграция)</option></select></label><label>Срок в часах (1–8760)<input name="hours" type="number" min="1" max="8760" value="24" required></label><label>Причина<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Назначить санкцию</button></form><button type="button" class="owner-sanctions-list">Посмотреть санкции</button><div class="owner-sanctions-results"></div><form class="owner-revoke-form"><label>ID санкции для отмены<input name="id" type="number" min="1" required></label><label>Причина отмены<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Отменить санкцию</button></form><h4>⚙️ Настройки игры</h4><form class="owner-settings-form"><label>Настройка<select name="key"><option value="welcome_message">Приветственное сообщение</option><option value="maintenance_notice">Сообщение о работах</option><option value="chat_slow_mode_seconds">Задержка чата (0–300 секунд)</option><option value="events_enabled">Игровые события (true/false)</option></select></label><label>Значение<input name="value" required></label><label>Причина<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Сохранить настройку</button></form>';
 center.append(sanctions);
 const sanctionForm=sanctions.querySelector('.owner-sanction-form');
 sanctionForm.addEventListener('submit',async e=>{
  e.preventDefault();const el=e.currentTarget.elements;
  if(!confirm('Назначить санкцию игроку?'))return;
  try{const id=await rpc('game_owner_sanction',{p_player:el.player.value.trim(),p_scope:el.scope.value,p_hours:Number(el.hours.value),p_reason:el.reason.value.trim()});status.textContent='Санкция №'+id+' создана'}
  catch(error){status.textContent='Ошибка санкции: '+error.message}
 });
 sanctions.querySelector('.owner-sanctions-list').addEventListener('click',async()=>{
  const results=sanctions.querySelector('.owner-sanctions-results');results.replaceChildren();
  try{
   const records=await rpc('game_owner_sanctions',{p_player:null});
   for(const record of records){const p=document.createElement('p');p.textContent='#'+record.id+' · '+record.player+' · '+record.scope+' · до '+new Date(record.ends_at).toLocaleString('ru-RU')+(record.revoked_at?' · отменена':'')+' · '+record.reason;results.append(p)}
   if(!records.length)results.textContent='Санкций нет';
  }catch(error){status.textContent=error.message}
 });
 sanctions.querySelector('.owner-revoke-form').addEventListener('submit',async e=>{
  e.preventDefault();const el=e.currentTarget.elements;
  if(!confirm('Отменить санкцию №'+el.id.value+'?'))return;
  try{await rpc('game_owner_revoke_sanction',{p_id:Number(el.id.value),p_reason:el.reason.value.trim()});status.textContent='Санкция отменена'}
  catch(error){status.textContent=error.message}
 });
 sanctions.querySelector('.owner-settings-form').addEventListener('submit',async e=>{
  e.preventDefault();const el=e.currentTarget.elements,key=el.key.value,raw=el.value.value.trim();
  let value=raw;
  if(key==='chat_slow_mode_seconds'){value=Number(raw);if(!Number.isInteger(value)||value<0||value>300){status.textContent='Введите целое число 0–300';return}}
  if(key==='events_enabled'){if(raw!=='true'&&raw!=='false'){status.textContent='Введите true или false';return}value=raw==='true'}
  if(!confirm('Сохранить настройку «'+key+'»?'))return;
  try{await rpc('game_owner_set_setting',{p_key:key,p_value:value,p_reason:el.reason.value.trim()});status.textContent='Настройка сохранена'}
  catch(error){status.textContent=error.message}
 });


 const buildings=document.createElement('section');buildings.className='owner-project-center';
 buildings.innerHTML='<h4>🏗️ Управление стройками</h4><form class="owner-project-search"><label>Город<select name="city"><option value="">Все города</option></select></label><button>Показать проекты</button></form><div class="owner-project-list"></div><form class="owner-project-action"><label>ID проекта<input name="project" inputmode="numeric" required></label><label>Действие<select name="action"><option value="rename">Переименовать</option><option value="set_cost">Изменить стоимость</option><option value="complete">Завершить строительство</option><option value="set_upgrade">Установить уровень 1–5</option></select></label><label>Новое значение (кроме завершения)<input name="value"></label><label>Причина<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Применить с подтверждением</button></form>';
 center.append(buildings);
 const citySelector=buildings.querySelector('select[name="city"]'),projectList=buildings.querySelector('.owner-project-list'),projectForm=buildings.querySelector('.owner-project-action');
 async function loadProjectCities(){
  const data=await rpc('game_owner_dashboard',{});
  citySelector.replaceChildren();const all=document.createElement('option');all.value='';all.textContent='Все города';citySelector.append(all);
  for(const city of data.cities){const option=document.createElement('option');option.value=city.id;option.textContent=city.name;citySelector.append(option)}
 }
 buildings.querySelector('.owner-project-search').addEventListener('submit',async e=>{
  e.preventDefault();projectList.replaceChildren();
  try{
   const projects=await rpc('game_owner_projects',{p_city_id:citySelector.value||null});
   for(const p of projects){
    const button=document.createElement('button');button.type='button';
    button.textContent='#'+p.project_id+' · '+p.title+' · '+p.contributed_points+'/'+p.required_points+' · улучшение '+p.upgrade_level;
    button.addEventListener('click',()=>{projectForm.elements.project.value=p.project_id});projectList.append(button)
   }
   status.textContent='Загружено проектов: '+projects.length;
  }catch(error){status.textContent=error.message}
 });
 projectForm.addEventListener('submit',async e=>{
  e.preventDefault();const fields=e.currentTarget.elements;
  const action=fields.namedItem('action').value,id=Number(fields.namedItem('project').value),value=fields.namedItem('value').value.trim(),reason=fields.namedItem('reason').value.trim();
  if(!Number.isSafeInteger(id)||id<1){status.textContent='Неверный ID проекта';return}
  if(!confirm('Подтвердить изменение проекта #'+id+'? Это повлияет на общий город.'))return;
  try{
   const result=await rpc('game_owner_project_action',{p_project_id:id,p_action:action,p_value:value,p_reason:reason});
   status.textContent='Проект обновлён: '+JSON.stringify(result);
  }catch(error){status.textContent='Ошибка: '+error.message}
 });


 const moderation=document.createElement('section');moderation.className='owner-room-center';
 moderation.innerHTML='<h4>💬 Комнаты и модерация</h4><button type="button" class="owner-load-rooms">Обновить список комнат</button><div class="owner-room-list"></div><div class="owner-room-messages"></div><form class="owner-room-action"><label>Комната ID<input name="room" required inputmode="numeric"></label><label>Действие<select name="action"><option value="disable_room">Закрыть комнату</option><option value="enable_room">Открыть комнату</option><option value="hide_message">Скрыть сообщение</option><option value="mute_player">Ограничить сообщения игрока</option><option value="unmute_player">Снять ограничение</option></select></label><label>ID сообщения / UUID игрока / UUID:часы<input name="subject"></label><label>Причина<textarea name="reason" minlength="10" maxlength="1000" required></textarea></label><button>Применить с подтверждением</button></form>';
 center.append(moderation);
 const roomList=moderation.querySelector('.owner-room-list'),roomMessages=moderation.querySelector('.owner-room-messages'),roomForm=moderation.querySelector('.owner-room-action');
 moderation.querySelector('.owner-load-rooms').addEventListener('click',async()=>{
  try{
   const rooms=await rpc('game_owner_rooms',{});roomList.replaceChildren();
   for(const room of rooms){
    const button=document.createElement('button');button.type='button';
    button.textContent='#'+room.room_id+' · '+room.city_name+' · '+room.title+' · '+room.kind+' · '+(room.enabled?'открыта':'закрыта')+' · сообщений: '+room.message_count;
    button.addEventListener('click',async()=>{
     roomForm.elements.room.value=room.room_id;
     roomMessages.replaceChildren();
     if(room.kind!=='text'){roomMessages.textContent='Голосовая комната: аудиосервис пока не подключён';return}
     try{
      const messages=await rpc('game_owner_room_messages',{p_room_id:room.room_id,p_limit:50});
      for(const m of messages){const row=document.createElement('button');row.type='button';row.textContent='#'+m.message_id+' · '+m.author+' · '+(m.hidden?'[скрыто] ':'')+m.body;row.addEventListener('click',()=>{roomForm.elements.action.value='hide_message';roomForm.elements.subject.value=m.message_id});roomMessages.append(row)}
      if(!messages.length)roomMessages.textContent='Сообщений пока нет';
     }catch(e){status.textContent=e.message}
    });roomList.append(button);
   }
  }catch(e){status.textContent='Не удалось загрузить комнаты: '+e.message}
 });
 roomForm.addEventListener('submit',async e=>{
  e.preventDefault();const el=e.currentTarget.elements;
  if(!confirm('Подтвердить действие модерации?'))return;
  try{
   await rpc('game_owner_room_action',{p_action:el.action.value,p_room_id:Number(el.room.value),p_subject:el.subject.value.trim(),p_reason:el.reason.value.trim()});
   status.textContent='Действие модерации выполнено';
  }catch(error){status.textContent='Ошибка модерации: '+error.message}
 });

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
   const found=await rpc('game_owner_find_player',{p_query:e.currentTarget.elements.namedItem('query').value.trim()});
   players.replaceChildren();
   for(const p of found){const row=document.createElement('button');row.type='button';row.textContent=(p.email||p.player_id)+' · '+(p.city||'без города')+' · монеты: '+(p.coins??0)+' · материалы: '+(p.materials??0)+' · тапы: '+(p.taps??0);row.addEventListener('click',()=>{center.querySelector('.owner-action').elements.target.value=p.player_id});players.append(row)}
   if(!found.length)players.textContent='Игрок не найден';
  }catch(error){status.textContent=error.message}
  finally{button.disabled=false}
 });
 center.querySelector('.owner-action').addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget,fields=form.elements;
  const action=fields.namedItem('action').value,target=fields.namedItem('target').value.trim(),value=fields.namedItem('value').value.trim(),reason=fields.namedItem('reason').value.trim();
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
  if(!auth()){root.hidden=true;tab.hidden=true;if(!screen.hidden){nav.querySelector('[data-go="town"]')?.click()}return}
  busy=true;refresh.disabled=true;
  try{
   const isOwner=await rpc('game_is_owner',{});
   if(!isOwner){root.hidden=true;tab.hidden=true;queue.replaceChildren();if(!screen.hidden){nav.querySelector('[data-go="town"]')?.click()}return}
   root.hidden=false;tab.hidden=false;
   try{await loadStats()}catch(error){stats.textContent='Не удалось загрузить статистику: '+error.message}
   await loadChatReports();
   if(!citySelector.options.length||citySelector.options.length===1){try{await loadProjectCities()}catch(error){status.textContent='Ошибка списка городов: '+error.message}}
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
  }catch(e){status.textContent='Ошибка загрузки панели: '+e.message}
  finally{busy=false;refresh.disabled=false}
 }
 refresh.addEventListener('click',load);
 tab.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 load();
 window.setInterval(()=>{const token=auth()?.session?.access_token||'';if(token!==lastToken){lastToken=token;load()}},10000);
})();
