(()=>{
'use strict';
const town=document.getElementById('town');if(!town)return;
const root=document.createElement('section');root.className='public-city-chat tycoon-card';
root.innerHTML='<h3>💬 Чат города</h3><p class="public-chat-status" role="status">Для общения войди в аккаунт и выбери город.</p><div class="public-chat-messages" role="log" aria-live="polite"></div><form class="public-chat-form"><input name="message" maxlength="1000" placeholder="Написать жителям города…" required><button>Отправить</button></form>';
town.append(root);
const status=root.querySelector('.public-chat-status'),messages=root.querySelector('.public-chat-messages'),form=root.querySelector('form');
let currentRoom=null,busy=false;
function auth(){let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null}
async function request(path,body){
 const a=auth();if(!a)throw Error('Нужен вход в аккаунт');
 const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){let msg='Ошибка '+response.status;try{msg=(await response.json()).message||msg}catch(_){}throw Error(msg)}
 return response.json();
}
async function load(){
 if(busy||document.hidden||town.hidden)return;
 busy=true;
 try{
  if(!auth()){currentRoom=null;messages.replaceChildren();status.textContent='Войди в аккаунт, чтобы открыть городской чат.';return}
  const my=await request('rpc/city_my_progress',{});
  if(!Array.isArray(my)||!my.length){currentRoom=null;messages.replaceChildren();status.textContent='Сначала выбери город в разделе онлайн-команды.';return}
  const city=my[0],cityId=city.city_id;
  if(!cityId){currentRoom=null;status.textContent='Город пока не определён';return}
  const rooms=await request('game_public_rooms?select=id,title,city_id&kind=eq.text&enabled=eq.true&city_id=eq.'+encodeURIComponent(cityId)+'&project_id=is.null&limit=1');
  if(!rooms.length){currentRoom=null;status.textContent='Городской чат пока недоступен';return}
  currentRoom=rooms[0].id;status.textContent=rooms[0].title;
  const rows=await request('rpc/game_chat_messages',{p_room_id:currentRoom,p_limit:50});
  messages.replaceChildren();
  for(const item of rows.reverse()){
   const p=document.createElement('p');p.className='public-chat-message';
   const head=document.createElement('strong');head.textContent=item.author_name+' · '+new Date(item.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})+' ';
   const text=document.createElement('span');text.textContent=item.body;
   p.append(head,text);
   const report=document.createElement('button');report.type='button';report.className='public-chat-report';report.textContent='Пожаловаться';
   report.addEventListener('click',async()=>{const reason=prompt('Причина жалобы (15–1000 символов):');if(reason===null)return;if(reason.trim().length<15){status.textContent='Опиши причину подробнее (минимум 15 символов)';return}if(!confirm('Отправить жалобу на сообщение?'))return;try{await request('rpc/game_report_public_message',{p_message_id:item.message_id,p_reason:reason.trim()});status.textContent='Жалоба отправлена на проверку'}catch(e){status.textContent=e.message}});
   p.append(report);messages.append(p);
  }
  messages.scrollTop=messages.scrollHeight;
 }catch(error){status.textContent=error.message}
 finally{busy=false}
}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!currentRoom)return;
 const input=form.elements.namedItem('message'),body=input.value.trim();if(!body)return;
 const button=form.querySelector('button');button.disabled=true;
 try{await request('rpc/game_public_send_message',{p_room_id:currentRoom,p_body:body});input.value='';await load()}
 catch(error){status.textContent=error.message}
 finally{button.disabled=false}
});
document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
window.addEventListener('online',load);
setInterval(load,12000);load();
})();