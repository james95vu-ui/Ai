(()=>{'use strict';
const settings=document.getElementById('settings'),team=document.getElementById('team');
if(settings){
 const profile=document.createElement('section');profile.className='tycoon-card game-profile';profile.id='game-profile';
 profile.innerHTML='<h3>👤 Профиль игрока</h3><p>Игровое имя и вход в сообщество находятся здесь.</p>';
 settings.prepend(profile);
 const nickname=document.querySelector('.game-nickname-card');if(nickname)profile.append(nickname);
 const social=document.getElementById('social');if(social)profile.append(social);
}
const connect=document.getElementById('connect');if(connect){connect.hidden=true;connect.style.display='none'}
if(team){const hint=document.createElement('p');hint.textContent='Для входа в сообщество открой «Настройки» → «Профиль игрока». Рейтинг можно просматривать здесь.';team.insertBefore(hint,team.firstElementChild?.nextSibling||null)}
const reset=document.querySelector('#settings .chr-reset');
if(reset){
 reset.onclick=()=>{
  const existing=document.getElementById('reset-confirm-overlay');if(existing){existing.remove();return}
  const overlay=document.createElement('div');overlay.id='reset-confirm-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.innerHTML='<div class="reset-confirm-card"><h3>Начать новую игру?</h3><p>Монеты, локальные постройки, уровни, задания и достижения будут сброшены. Онлайн-профиль и серверный прогресс останутся без изменений.</p><div class="reset-confirm-actions"><button type="button" class="reset-cancel">Отмена</button><button type="button" class="reset-accept">Удалить локальный прогресс</button></div></div>';
  document.body.append(overlay);
  overlay.querySelector('.reset-cancel').onclick=()=>overlay.remove();
  overlay.querySelector('.reset-accept').onclick=()=>{
   ['vozrozhdenie_demo_v1','chr_player_name_v1','chr_new_era_settings_v1'].forEach(k=>localStorage.removeItem(k));
   location.reload();
  };
 }
}
})();