(()=>{'use strict';
const screen=document.getElementById('earn');if(!screen)return;
const panel=document.createElement('section');panel.className='server-managers';
panel.innerHTML='<h3>👷 Онлайн-менеджеры</h3><p class="manager-status" role="status">Для найма менеджеров войди в онлайн-аккаунт.</p><div class="manager-stats"></div><div class="manager-controls"><button type="button" class="manager-hire">Нанять менеджера</button><button type="button" class="manager-claim">Забрать доход</button><button type="button" class="manager-refresh">Обновить</button></div><small>Пассивный доход начисляется сервером, максимум за 24 часа. Локальные монеты пока учитываются отдельно.</small>';
screen.append(panel);
const status=panel.querySelector('.manager-status'),stats=panel.querySelector('.manager-stats'),hire=panel.querySelector('.manager-hire'),claim=panel.querySelector('.manager-claim'),refresh=panel.querySelector('.manager-refresh');
let busy=false;
function auth(){let session;try{session=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}const cfg=window.GAME_CONFIG||{};return session?.access_token&&cfg.url&&cfg.key?{session,cfg}:null}
async function rpc(name){const a=auth();if(!a)throw Error('Нужен вход в онлайн-аккаунт');const response=await fetch(a.cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:a.cfg.key,Authorization:'Bearer '+a.session.access_token,'Content-Type':'application/json'},body:'{}'});if(!response.ok){let msg='HTTP '+response.status;try{const error=await response.json();msg=error.message||msg}catch(_){}throw Error(msg)}return response.json()}
function number(v){return Number(v||0).toLocaleString('ru-RU')}
async function load(){if(busy||document.hidden)return;if(!auth()){status.textContent='Войди в онлайн-аккаунт в разделе «Сообщество»';stats.replaceChildren();hire.disabled=true;claim.disabled=true;return}
busy=true;refresh.disabled=true;
try{const rows=await rpc('game_my_managers'),data=rows[0];if(!data)throw Error('Нет данных менеджеров');
status.textContent='Менеджеров: '+data.manager_count+' из 10';
stats.textContent='Доход: '+number(data.hourly_coins)+' монет/час · Накоплено: '+number(data.can_claim_coins)+' · Серверный кошелёк: '+number(data.wallet_coins);
hire.textContent=data.manager_count>=10?'Все менеджеры наняты':data.next_cost===0?'Получить первого менеджера бесплатно':'Нанять за '+number(data.next_cost)+' монет';
hire.disabled=data.manager_count>=10;claim.disabled=Number(data.can_claim_coins)<1;
}catch(e){status.textContent='Не удалось загрузить менеджеров: '+e.message;hire.disabled=true;claim.disabled=true}
finally{busy=false;refresh.disabled=false}}
async function act(name){if(busy)return;busy=true;hire.disabled=true;claim.disabled=true;refresh.disabled=true;
try{const result=await rpc(name);status.textContent=name==='game_claim_manager_income'?'Получено серверных монет: '+number(result):'Менеджер нанят. Всего: '+number(result)}
catch(e){status.textContent='Ошибка: '+e.message}
finally{busy=false;refresh.disabled=false;await load()}}
hire.addEventListener('click',()=>act('game_hire_manager'));claim.addEventListener('click',()=>act('game_claim_manager_income'));refresh.addEventListener('click',load);
document.querySelector('[data-go="earn"]')?.addEventListener('click',()=>setTimeout(load,0));window.addEventListener('online',load);
if(!screen.hidden)load();
})();