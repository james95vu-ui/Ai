(()=>{
'use strict';
const town=document.getElementById('town');if(!town)return;
const root=document.createElement('section');root.className='project-chat tycoon-card';
root.innerHTML='<h3>🏗️ Чат стройки</h3><label>Номер проекта <input class="project-chat-id" type="number" min="1" inputmode="numeric" placeholder="ID стройки"></label><button class="project-chat-open" type="button">Открыть чат стройки</button><p class="project-chat-status" role="status">Выбери проект из раздела строительства.</p><div class="project-chat-messages" role="log"></div><form class="project-chat-form"><input name="message" maxlength="1000" required placeholder="Сообщение участникам стройки…"><button>Отправить</button></form>';
town.append(root);
const status=root.querySelector('.project-chat-status'),list=root.querySelector('.project-chat-messages'),input=root.querySelector('.project-chat-id'),form=root.querySelector('form');
let room=null,loading=false;
function auth(){let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null}
async function request(path,body){
 const a=auth();if(!a)throw Error('Войди в аккаунт');
 const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(!response.ok){let msg='Ошибка '+response.status;try{msg=(await response.json()).message||msg}catch(_){}throw Error(msg)}
 return response.json();
}
async function openProject(){
 const id=Number(input.value);if(!Number.isSafeInteger(id)||id<1){status.textContent='Укажи ID проекта';return}
 room=null;list.replaceChildren();
 try{
  const result=await request('rpc/game_project_chat_room',{p_project_id:id});
  if(!result.length)throw Error('Чат проекта недоступен. Проверь свой город.');
  room=result[0].room_id;status.textContent=result[0].room_title;await load();
 }catch(error){status.textContent=error.message}
}
async function load(){
 if(!room||loading||document.hidden||town.hidden)return;
 loading=true;
 try{
  const rows=await request('game_public_messages?select=id,author,body,created_at&room_id=eq.'+room+'&hidden=eq.false&order=created_at.desc&limit=50');
  list.replaceChildren();
  for(const item of rows.reverse()){
   const p=document.createElement('p'),strong=document.createElement('strong'),text=document.createElement('span');
   strong.textContent=item.author.slice(0,8)+' · ';text.textContent=item.body;
   const report=document.createElement('button');report.type='button';report.textContent='Пожаловаться';
   report.addEventListener('click',async()=>{const reason=prompt('Причина жалобы (15–1000 символов):');if(reason===null)return;if(reason.trim().length<15){status.textContent='Минимум 15 символов';return}if(!confirm('Отправить жалобу?'))return;try{await request('rpc/game_report_public_message',{p_message_id:item.id,p_reason:reason.trim()});status.textContent='Жалоба отправлена'}catch(e){status.textContent=e.message}});
   p.append(strong,text,report);list.append(p);
  }
  list.scrollTop=list.scrollHeight;
 }catch(error){status.textContent=error.message}
 finally{loading=false}
}
root.querySelector('.project-chat-open').addEventListener('click',openProject);
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!room)return;const field=form.elements.namedItem('message'),body=field.value.trim();if(!body)return;
 const button=form.querySelector('button');button.disabled=true;
 try{await request('rpc/game_public_send_message',{p_room_id:room,p_body:body});field.value='';await load()}
 catch(error){status.textContent=error.message}
 finally{button.disabled=false}
});
window.openCityProjectChat=id=>{input.value=id;openProject();root.scrollIntoView({behavior:'smooth',block:'start'})};
setInterval(load,12000);
})();