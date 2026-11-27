(()=>{
'use strict';
const town=document.getElementById('town');if(!town)return;
const root=document.createElement('section');root.className='game-nickname-card tycoon-card';
root.innerHTML='<h3>👤 Моё игровое имя</h3><form><input name="nickname" minlength="2" maxlength="30" required placeholder="Имя, видимое в чатах"><button>Сохранить имя</button></form><p role="status" class="nickname-status">Имя отображается в городских чатах и чатах строек.</p>';
town.append(root);
const form=root.querySelector('form'),status=root.querySelector('.nickname-status'),input=form.elements.namedItem('nickname');
input.value=localStorage.getItem('chr_player_name_v1')||'';
form.addEventListener('submit',async e=>{
 e.preventDefault();const name=input.value.trim();if(name.length<2||name.length>30)return;
 let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
 const cfg=window.GAME_CONFIG||{};
 if(!session?.access_token||!cfg.url||!cfg.key){status.textContent='Сначала войди в онлайн-аккаунт';return}
 const button=form.querySelector('button');button.disabled=true;
 try{
  const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/game_set_nickname',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_nickname:name})});
  if(!res.ok){const error=await res.json();throw Error(error.message||'Ошибка сохранения')}
  const saved=await res.json();localStorage.setItem('chr_player_name_v1',saved);status.textContent='Игровое имя сохранено: '+saved;
 }catch(error){status.textContent=error.message}finally{button.disabled=false}
});
})();