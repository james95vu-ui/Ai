(()=>{'use strict';
const intro=document.getElementById('intro'),name=document.getElementById('intro-name'),email=document.getElementById('intro-email'),code=document.getElementById('intro-code'),error=document.getElementById('intro-error'),step=document.getElementById('intro-verification'),start=document.getElementById('intro-start'),confirm=document.getElementById('intro-confirm'),resend=document.getElementById('intro-resend');
const sessionKey='vozrozhdenie_social_session_v1',pendingKey=sessionKey+'_login';
const hasSession=()=>{try{return !!JSON.parse(localStorage.getItem(sessionKey)||'null')?.access_token}catch(_){return false}};
function sync(){if(hasSession()){intro.hidden=true;return}intro.hidden=false;try{const p=JSON.parse(localStorage.getItem(pendingKey)||'null');if(p?.email){step.hidden=false;email.value=p.email;error.textContent='Подтверди почту, чтобы выбрать свой город.'}}catch(_){}}
name.value=localStorage.getItem('chr_player_name_v1')||'';
email.value=localStorage.getItem('chr_player_email_v1')||'';
function valid(){const player=name.value.trim(),address=email.value.trim().toLowerCase();if(player.length<2||player.length>30){error.textContent='Имя должно содержать от 2 до 30 символов';return false}if(!email.checkValidity()||!address){error.textContent='Укажи действительный email';return false}localStorage.setItem('chr_player_name_v1',player);localStorage.setItem('chr_player_email_v1',address);return true}
function status(){const msg=document.getElementById('social-status')?.textContent||'';if(/Ошибка|ошибка|не удалось|HTTP|сервер/i.test(msg))error.textContent=msg;else if(/отправлено|письм/i.test(msg)){step.hidden=false;error.textContent='Письмо отправлено. Введи код или вставь ссылку.'}}
start.onclick=()=>{if(!valid())return;const field=document.querySelector('#social-login input[name="email"]');if(!field){error.textContent='Форма входа недоступна';return}field.value=email.value.trim().toLowerCase();error.textContent='Отправляем письмо…';document.getElementById('social-login').requestSubmit();setTimeout(status,1200);step.hidden=false};
resend.onclick=()=>start.click();
confirm.onclick=()=>{if(!valid())return;const value=code.value.trim();if(!value){error.textContent='Введи код подтверждения';return}const field=document.querySelector('#social-verify input[name="credential"]');if(!field){error.textContent='Форма подтверждения недоступна';return}field.value=value;error.textContent='Проверяем код…';document.getElementById('social-verify').requestSubmit();setTimeout(status,1200)};
window.addEventListener('game:auth-changed',sync);
window.addEventListener('pageshow',sync);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});
sync();
})();