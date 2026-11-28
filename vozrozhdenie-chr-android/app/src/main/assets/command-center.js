(()=>{'use strict';
const nav=document.querySelector('.game-nav');
if(!nav||document.querySelector('.command-drawer'))return;
const drawer=document.createElement('div');
drawer.className='command-drawer';
drawer.hidden=true;
drawer.setAttribute('aria-hidden','true');
drawer.innerHTML='<section class="command-sheet" role="dialog" aria-modal="true" aria-labelledby="command-title"><div class="command-sheet-head"><h2 id="command-title">Управление городом</h2><button class="command-close" type="button" aria-label="Закрыть">✕</button></div><div class="command-shortcuts"><button type="button" data-screen="regional-map"><span>🗺️</span>Карта республики</button><button type="button" data-screen="town"><span>🏙️</span>Мой город</button><button type="button" class="command-primary" data-screen="earn"><span>⚡</span>Заработок и улучшения</button><button type="button" data-screen="quests"><span>📜</span>Ежедневные задания</button><button type="button" data-screen="team"><span>🏆</span>Команда и рейтинг</button><button type="button" data-action="chest"><span>🎁</span>Открыть сундук</button><button type="button" data-action="energy"><span>🔋</span>Улучшить запас энергии</button><button type="button" data-action="tap-upgrade"><span>👆</span>Усилить тапалку</button></div><p class="command-status">Все ресурсы и улучшения привязаны к текущему игровому сохранению.</p></section>';
nav.insertAdjacentElement('afterend',drawer);
const openButton=document.createElement('button');
openButton.type='button';openButton.dataset.commandOpen='';openButton.setAttribute('aria-haspopup','dialog');openButton.setAttribute('aria-expanded','false');
openButton.innerHTML='<span aria-hidden="true">⋯</span>Ещё';
nav.append(openButton);
const sheet=drawer.querySelector('.command-sheet');
const closeButton=drawer.querySelector('.command-close');
function open(){drawer.hidden=false;drawer.setAttribute('aria-hidden','false');openButton.setAttribute('aria-expanded','true');document.body.style.overflow='hidden';closeButton.focus()}
function close(){drawer.hidden=true;drawer.setAttribute('aria-hidden','true');openButton.setAttribute('aria-expanded','false');document.body.style.overflow='';openButton.focus()}
openButton.addEventListener('click',open);
closeButton.addEventListener('click',close);
drawer.addEventListener('click',e=>{if(e.target===drawer)close()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!drawer.hidden)close()});
sheet.addEventListener('click',e=>{
 const screen=e.target.closest('[data-screen]');
 if(screen){const tab=nav.querySelector('[data-go="'+screen.dataset.screen+'"]');if(tab)tab.click();close();return}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(!action)return;
 const targetId=action==='chest'?'quests':'earn';
 const tab=nav.querySelector('[data-go="'+targetId+'"]');
 const control=document.getElementById(action==='chest'?'chest':action==='energy'?'energy-upgrade':'upgrade');
 close();
 if(tab)tab.click();
 requestAnimationFrame(()=>{if(control&&!control.disabled)control.click()});
});
nav.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;openButton.removeAttribute('aria-current');});
})();
