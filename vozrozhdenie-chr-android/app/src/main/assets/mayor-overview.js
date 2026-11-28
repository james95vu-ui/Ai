(() => {
 'use strict';
 const town=document.getElementById('town');if(!town)return;
 const root=document.createElement('section');root.className='mayor-overview';
 root.innerHTML='<h3>🏛️ Мэр города</h3><p class="mayor-status" role="status">Для просмотра мэра войди в онлайн-аккаунт.</p><div class="mayor-data"></div><button type="button" class="mayor-refresh">Обновить</button>';
 town.append(root);
 const status=root.querySelector('.mayor-status'),data=root.querySelector('.mayor-data'),button=root.querySelector('.mayor-refresh');
 let busy=false;
 async function rpc(name,body,session,cfg){
  const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok)throw Error('HTTP '+res.status);return res.json();
 }
 async function load(){
  if(busy||document.hidden)return;
  const cfg=window.GAME_CONFIG||{};let session;
  try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
  if(!session?.access_token||!cfg.url||!cfg.key){status.textContent='Войди в онлайн-аккаунт, чтобы увидеть мэра';return}
  busy=true;button.disabled=true;
  try{
   const me=await rpc('city_my_progress',{},session,cfg);
   if(!me.length){status.textContent='Сначала выбери город в онлайн-профиле';data.replaceChildren();return}
   await rpc('city_elect_mayors',{},session,cfg);
   const terms=await rpc('city_mayor_overview',{p_city_id:me[0].city_id},session,cfg);
   data.replaceChildren();
   if(!terms.length){status.textContent='Мэр ещё не избран: ждём итогов полной игровой недели';return}
   const term=terms[0];
   status.textContent=me[0].city_name+' · срок до '+new Date(term.term_ends_at).toLocaleDateString('ru-RU');
   const p=document.createElement('p');
   p.textContent='Мэр: '+(term.mayor===session.user?.id?'ты':String(term.mayor).slice(0,8)+'…')+' · вклад за прошлую неделю: '+Number(term.points_last_week).toLocaleString('ru-RU')+' · заместителей: '+term.deputies+'/2';
   data.append(p);
  }catch(e){status.textContent='Не удалось загрузить данные мэра: '+e.message}
  finally{busy=false;button.disabled=false}
 }
 button.addEventListener('click',load);
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 if(!town.hidden)load();
})();
