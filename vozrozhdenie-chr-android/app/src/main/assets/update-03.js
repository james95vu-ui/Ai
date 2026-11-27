
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const tap=$('tap'),stats=document.querySelector('.stats'),settings=$('settings');
if(stats)stats.classList.add('chr-sticky-stats');
if(tap){
  let active=new Set(),ignoreClickUntil=0;
  tap.style.touchAction='none';
  tap.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    e.preventDefault();
    if(active.has(e.pointerId)||active.size>=5)return;
    active.add(e.pointerId);
    ignoreClickUntil=Date.now()+900;
    // Reuse the game's existing click handler, preserving combo and earnings.
    tap.click();
  },{passive:false});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>
    tap.addEventListener(type,e=>active.delete(e.pointerId)));
  tap.addEventListener('click',e=>{
    if(e.isTrusted&&Date.now()<ignoreClickUntil){
      e.stopImmediatePropagation();e.preventDefault();
    }
  },true);
}
if(settings){
  const title=document.createElement('h3');
  title.textContent='Новая игра';
  settings.append(title);
  const info=document.createElement('p');
  info.textContent='Сброс удалит монеты, здания, задания, достижения и имя на этом устройстве. Онлайн-данные других игроков не изменятся.';
  settings.append(info);
  const reset=document.createElement('button');
  reset.type='button';reset.className='chr-reset';
  reset.textContent='Сбросить весь прогресс';
  reset.onclick=()=>{
    if(!confirm('Сбросить весь прогресс и начать игру заново? Это действие нельзя отменить.'))return;
    if(!confirm('Подтверди окончательный сброс монет, зданий, заданий и достижений.'))return;
    ['vozrozhdenie_demo_v1','chr_player_name_v1','chr_new_era_settings_v1'].forEach(k=>localStorage.removeItem(k));
    // Preserve online session and server data; local reset is not a server reset.
    location.reload();
  };
  settings.append(reset);
}
const ranking=$('ranking');
if(ranking){
  const hint=document.createElement('p');
  hint.className='chr-ranking-hint';
  hint.textContent='Очки города появятся, когда онлайн-сервер начнёт возвращать общий вклад команды. Пока сервер показывает только число игроков.';
  ranking.parentNode.insertBefore(hint,ranking.nextSibling);
  // Do not fabricate a score. Display only a value returned by the backend.
  const observer=new MutationObserver(()=>{
    const rows=ranking.querySelectorAll('.rank');
    if(!rows.length)return;
    // Current city_ranking endpoint returns city/members; aggregate score
    // requires a separate, verified server-side RPC update.
    hint.style.display='block';
  });
  observer.observe(ranking,{childList:true});
}
})();
