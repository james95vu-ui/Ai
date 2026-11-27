(()=>{
 'use strict';
 const town=document.getElementById('town');if(!town)return;
 const panel=document.createElement('section');panel.className='my-sanctions-panel';
 panel.innerHTML='<h3>🛡️ Ограничения аккаунта</h3><div class="my-sanctions-body">Проверка…</div>';
 town.append(panel);
 const body=panel.querySelector('.my-sanctions-body');
 async function load(){
  let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
  const cfg=window.GAME_CONFIG||{};
  if(!session?.access_token||!cfg.url||!cfg.key){panel.hidden=true;return}
  try{
   const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/game_my_sanctions',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});
   if(!res.ok)throw Error('Не удалось получить санкции');
   const records=await res.json();panel.hidden=!records.length;body.replaceChildren();
   for(const s of records){
    const row=document.createElement('p');
    row.textContent=(s.scope==='gameplay'?'Игровые действия':'Публичные чаты')+' · до '+new Date(s.ends_at).toLocaleString('ru-RU')+' · '+s.reason;
    body.append(row);
   }
  }catch(e){panel.hidden=false;body.textContent=e.message}
 }
 document.querySelector('[data-go="town"]')?.addEventListener('click',()=>setTimeout(load,0));
 window.addEventListener('online',load);
 if(!town.hidden)load();
})();