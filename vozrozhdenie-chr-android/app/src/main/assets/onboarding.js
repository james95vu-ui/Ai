(()=>{'use strict';
const intro=document.getElementById('intro'),name=document.getElementById('intro-name'),email=document.getElementById('intro-email'),code=document.getElementById('intro-code'),error=document.getElementById('intro-error'),step=document.getElementById('intro-verification'),start=document.getElementById('intro-start'),confirm=document.getElementById('intro-confirm'),resend=document.getElementById('intro-resend');
const sessionKey='vozrozhdenie_social_session_v1',pendingKey=sessionKey+'_login',guestKey='chr_guest_started_v1';
const hasGuest=()=>localStorage.getItem(guestKey)==='1';
function enterGuest(){const selected=citySelect.value;localStorage.setItem('chr_guest_city_v1',selected);localStorage.setItem(guestKey,'1');intro.hidden=true;window.dispatchEvent(new CustomEvent('game:guest-started',{detail:{cityId:selected}}));}
const hasSession=()=>{try{return !!JSON.parse(localStorage.getItem(sessionKey)||'null')?.access_token}catch(_){return false}};
function sync(){if(hasSession()){checkCity();return}intro.hidden=false;step.hidden=true;start.hidden=false;name.disabled=false;email.disabled=false;error.textContent='Укажи имя для онлайн-игры.'}
name.value=localStorage.getItem('chr_player_name_v1')||'';
email.value=localStorage.getItem('chr_player_email_v1')||'';
function valid(){const player=name.value.trim();if(player.length<2||player.length>30){error.textContent='Имя должно содержать от 2 до 30 символов';return false}localStorage.setItem('chr_player_name_v1',player);return true}
start.onclick=async()=>{if(!valid()||cityBusy)return;start.disabled=true;error.textContent='Подключаемся к серверу…';try{await window.gameEnsureSession();await checkCity()}catch(e){error.textContent='Не удалось подключиться: '+e.message}finally{start.disabled=false}};
const cityStep=document.getElementById('intro-city-step'),citySelect=document.getElementById('intro-city-select'),cityJoin=document.getElementById('intro-city-join');
const cities=[['grozny','Грозный'],['urus_martan','Урус-Мартан'],['argun','Аргун'],['gudermes','Гудермес'],['shali','Шали'],['kurchaloy','Курчалой'],['achkhoy_martan','Ачхой-Мартан'],['oyskhara','Ойсхара'],['sernovodskoye','Серноводское'],['shatoy','Шатой']];
for(const [id,title] of cities){const option=document.createElement('option');option.value=id;option.textContent=title;citySelect.append(option)}
citySelect.value=localStorage.getItem('chr_guest_city_v1')||'grozny';
let cityBusy=false;
function credentials(){let session;try{session=JSON.parse(localStorage.getItem(sessionKey)||'null')}catch(_){}const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null}
async function rpc(method,payload={}){const a=credentials();if(!a)throw Error('Нет онлайн-сессии');if(a.session.expires_at&&a.session.expires_at<Date.now()/1000+60&&a.session.refresh_token){const refreshed=await fetch(a.cfg.url.replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:a.cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:a.session.refresh_token})});if(!refreshed.ok)throw Error('Сессия истекла. Повтори подключение');const fresh=await refreshed.json();localStorage.setItem(sessionKey,JSON.stringify(fresh));a.session=fresh}const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+method,{method:'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok){let msg='Ошибка '+response.status;try{const body=await response.json();msg=body.message||msg}catch(_){}throw Error(msg)}return response.json()}
async function syncNickname(){
 const a=credentials(),proposed=(localStorage.getItem('chr_player_name_v1')||'').trim();
 if(!a)return;
 try{
  const profile=await rpc('game_my_nickname');
  if(profile?.[0]?.nickname){
   localStorage.setItem('chr_player_name_v1',profile[0].nickname);
   name.value=profile[0].nickname;
   return;
  }
  if(proposed.length>=2&&proposed.length<=30){
   const saved=await rpc('game_set_nickname',{p_nickname:proposed});
   localStorage.setItem('chr_player_name_v1',saved);
  }
 }catch(e){error.textContent='Не удалось синхронизировать имя: '+e.message}
}
async function checkCity(){
 if(cityBusy)return;
 const a=credentials();if(!a){cityStep.hidden=true;return}
 cityBusy=true;cityJoin.disabled=false;intro.hidden=false;step.hidden=true;start.hidden=true;name.disabled=true;email.disabled=true;cityStep.hidden=true;error.textContent='Проверяем закреплённый город…';
 try{
  const rows=await rpc('city_my_progress');
  if(rows?.length){await syncNickname();intro.hidden=true;window.dispatchEvent(new Event('online'));return}
  cityStep.hidden=false;error.textContent='Выбери город. После подтверждения изменить его можно только по правилам игры.';
 }catch(e){cityStep.hidden=false;cityJoin.disabled=true;error.textContent='Не удалось проверить город: '+e.message+'. Повтори проверку после восстановления соединения.'}
 finally{cityBusy=false}
}
cityJoin.onclick=async()=>{
 if(cityBusy)return;
 if(!credentials()){error.textContent='Нет подключения к серверу. Повтори вход.';return;}
 if(!window.confirm('Закрепить выбранный город за аккаунтом? Свободная смена города недоступна.'))return;
 cityBusy=true;cityJoin.disabled=true;error.textContent='Закрепляем город на сервере…';
 try{await rpc('city_join',{p_city_id:citySelect.value});await syncNickname();intro.hidden=true;window.dispatchEvent(new Event('online'))}
 catch(e){error.textContent='Не удалось закрепить город: '+e.message}
 finally{cityBusy=false;cityJoin.disabled=false}
};
window.addEventListener('game:auth-changed',()=>{if(credentials())checkCity();else{cityStep.hidden=true;start.hidden=false;name.disabled=false;email.disabled=false;sync()}});
window.addEventListener('online',()=>{if(credentials())checkCity()});
window.addEventListener('pageshow',()=>{if(credentials())checkCity();else sync()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(credentials())checkCity();else sync()}});
if(credentials())checkCity();else sync();
})();