(() => {
 'use strict';
 const town=document.getElementById('town');if(!town)return;
 const root=document.createElement('section');root.className='online-city-join';
 root.innerHTML='<h3>🌐 Мой онлайн-город</h3><p class="online-city-status" role="status">Войди в онлайн-аккаунт, чтобы закрепить город.</p><form class="online-city-form" hidden><label>Выбери город навсегда <select required></select></label><button type="submit">Вступить в город</button></form><button type="button" class="online-city-refresh">Проверить город</button>';
 const hero=town.querySelector('.city-hero');if(hero)hero.after(root);else town.prepend(root);
 const status=root.querySelector('.online-city-status'),form=root.querySelector('form'),select=form.querySelector('select'),refresh=root.querySelector('.online-city-refresh');
 const cities=[['grozny','Грозный'],['urus_martan','Урус-Мартан'],['argun','Аргун'],['gudermes','Гудермес'],['shali','Шали'],['kurchaloy','Курчалой'],['achkhoy_martan','Ачхой-Мартан'],['oyskhara','Ойсхара'],['sernovodskoye','Серноводское'],['shatoy','Шатой']];
 for(const [id,name] of cities){const option=document.createElement('option');option.value=id;option.textContent=name;select.append(option)}
 let busy=false;
 function auth(){let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null}
 async function rpc(name,body){
  const a=auth();if(!a)throw Error('Нужен вход в онлайн-аккаунт');
  const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){let msg='Ошибка '+response.status;try{const e=await response.json();if(e.message)msg=e.message}catch(_){}throw Error(msg)}
  return response.json();
 }
 async function load(){
  if(busy||document.hidden)return;
  if(!auth()){status.textContent='Войди в онлайн-аккаунт в разделе «Сообщество»';form.hidden=true;return}
  busy=true;refresh.disabled=true;
  try{
   const me=await rpc('city_my_progress',{});
   if(me.length){status.textContent='Твой онлайн-город: '+me[0].city_name+' · уровень '+me[0].city_level;form.hidden=true}
   else{status.textContent='Город ещё не закреплён. Выбери один из десяти городов.';form.hidden=false}
  }catch(e){status.textContent='Ошибка проверки города: '+e.message;form.hidden=true}
  finally{busy=false;refresh.disabled=false}
 }
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;
  if(!confirm('Ты закрепишь этот город за аккаунтом. Сменить его можно только после изгнания. Продолжить?'))return;
  busy=true;const button=form.querySelector('button');button.disabled=true;
  try{const name=await rpc('city_join',{p_city_id:select.value});status.textContent='Ты вступил в '+name;form.hidden=true;window.dispatchEvent(new Event('online'))}
  catch(e){status.textContent='Не удалось вступить: '+e.message}
  finally{busy=false;button.disabled=false}
 });
 refresh.addEventListener('click',load);
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 if(!town.hidden)load();
})();
