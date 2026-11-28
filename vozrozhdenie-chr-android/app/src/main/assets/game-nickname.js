(()=>{
'use strict';
const town=document.getElementById('town');if(!town)return;
const root=document.createElement('section');root.className='game-nickname-card tycoon-card';
root.innerHTML='<h3>👤 Моё игровое имя</h3><form><input name="nickname" minlength="2" maxlength="30" required placeholder="Имя, видимое в чатах"><button>Сохранить имя</button></form><p role="status" class="nickname-status">Имя отображается в городских чатах и чатах строек.</p>';
town.append(root);
const history=document.createElement('p');history.className='nickname-history';history.setAttribute('aria-live','polite');root.append(history);
window.addEventListener('game:auth-changed',()=>{refreshProfile()});
window.addEventListener('online',()=>{refreshProfile()});
document.querySelector('[data-go="town"]')?.addEventListener('click',()=>refreshProfile());
let expiryTimer=null;
const form=root.querySelector('form'),status=root.querySelector('.nickname-status'),input=form.elements.namedItem('nickname');
input.value=localStorage.getItem('chr_player_name_v1')||'';
async function refreshProfile(){
 let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
 const cfg=window.GAME_CONFIG||{};if(!session?.access_token||!cfg.url||!cfg.key){form.querySelector('button').disabled=true;history.textContent='Для смены имени нужен подтверждённый онлайн-аккаунт';return;}
 try{
  const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/game_my_nickname',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}'});
  if(!res.ok)throw Error('Не удалось получить профиль');const data=(await res.json())?.[0];if(!data){history.textContent='Имя ещё не создано';return;}
  input.value=data.nickname;
  const old=data.old_nickname?'Старое имя: '+data.old_nickname+' (до '+new Date(data.old_name_expires_at).toLocaleString('ru-RU')+')':'';
  const next=data.can_change?'Имя можно изменить сейчас.':'Следующая смена имени: '+new Date(data.next_change_at).toLocaleString('ru-RU');
  history.textContent=[old,next].filter(Boolean).join(' · ');
  if(expiryTimer)clearTimeout(expiryTimer);
  if(data.old_name_expires_at){const remaining=new Date(data.old_name_expires_at).getTime()-Date.now();if(remaining>0)expiryTimer=setTimeout(refreshProfile,Math.min(remaining+1000,2147483647));}
  form.querySelector('button').disabled=!data.can_change;
 }catch(_){history.textContent='Не удалось проверить историю имени';form.querySelector('button').disabled=true}
}
form.addEventListener('submit',async e=>{
 e.preventDefault();const name=input.value.trim();if(name.length<2||name.length>30)return;
 let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
 const cfg=window.GAME_CONFIG||{};
 if(!session?.access_token||!cfg.url||!cfg.key){status.textContent='Сначала войди в онлайн-аккаунт';return}
 const button=form.querySelector('button');button.disabled=true;
 try{
  const res=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/game_set_nickname',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_nickname:name})});
  if(!res.ok){const error=await res.json();throw Error(error.message||'Ошибка сохранения')}
  const saved=await res.json();localStorage.setItem('chr_player_name_v1',saved);status.textContent='Игровое имя сохранено: '+saved;await refreshProfile();
 }catch(error){status.textContent=error.message}finally{await refreshProfile()}
});
setTimeout(refreshProfile,0);
})();