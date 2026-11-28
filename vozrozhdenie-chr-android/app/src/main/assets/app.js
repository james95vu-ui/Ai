(()=>{'use strict';const $=id=>document.getElementById(id),KEY='vozrozhdenie_demo_v1',fmt=n=>Math.floor(n).toLocaleString('ru-RU');
const balanceFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cities = ['Урус-Мартан', 'Гудермес', 'Шали', 'Аргун', 'Ойсхара', 'Ачхой-Мартан', 'Курчалой', 'Серноводское', 'Шатой', 'Грозный'];
const thresholds = [0, 5, 12, 22, 35, 52, 74, 102, 137, 180];
const buildings=[['Городской парк','🌳',500,20,1],['Новая школа','🏫',900,35,1],['Мастерская','🏭',1400,50,1],['Жилой дом','🏠',1800,75,2],['Больница','🏥',2500,110,3],['Мечеть','🕌',3000,130,3],['Рынок','🏪',3800,180,4],['Стадион','🏟️',5000,240,5],['Библиотека','📚',6500,320,6]];const fresh=()=>({city:null,coins:1250,income:60,level:1,contribution:120,built:[],tapLevel:0,lastCollectedAt:Date.now(),daily:{}});let s;try{s={...fresh(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){s=fresh()}if(!Array.isArray(s.built))s.built=[];for(const k of ['coins','income','level','contribution','tapLevel','lastCollectedAt'])if(!Number.isFinite(s[k]))s[k]=fresh()[k];let combo=0,lastTap=0,selected=0,timer;let authoritativeOnlineCity=null;const save=()=>localStorage.setItem(KEY,JSON.stringify(s));const day=()=>new Date().toISOString().slice(0,10);function daily(){if(s.daily?.date!==day())s.daily={date:day(),taps:0,builds:0,claimed:[]};return s.daily}let lastActiveTick=performance.now();function collect(){const tick=performance.now(),elapsed=Math.max(0,Math.min(tick-lastActiveTick,60000));lastActiveTick=tick;const gain=s.city?elapsed*hourlyIncome()/3600000:0;s.coins+=gain;if(Math.abs(s.coins-Math.round(s.coins))<1e-8)s.coins=Math.round(s.coins);s.lastCollectedAt=Date.now();save();return gain}function notice(t){$('notice').textContent=t;clearTimeout(timer);timer=setTimeout(()=>$('notice').textContent='',2500)}function power(){return 10+5*s.tapLevel}function cost(){return Math.floor(200*1.7**s.tapLevel)}// Keep the existing active-city fields for saved games and achievement readers.
if (!s.campaign || typeof s.campaign !== 'object' || Array.isArray(s.campaign)) {
  s.campaign = {};
  if (s.city) {
    const restoredLevel = Math.max(1, Math.min(10, Math.trunc(s.level)));
    s.campaign[s.city] = { taps: thresholds[restoredLevel - 1], built: s.built };
    s.level = restoredLevel;
  }
}

const tycoon = Tycoon.normalize(s, Date.now());

function hourlyIncome() {
  const income = s.income + Tycoon.hourlyBonus(tycoon, s.campaign, buildings);
  return income * (tycoon.technologies.includes('yield') ? 1.15 : 1);
}

function useEnergy(amount) {
  if (Tycoon.spendEnergy(tycoon, amount, Date.now())) return true;
  notice('Не хватает энергии');
  return false;
}

function prestigeReward() {
  return cities.filter(city => cityLevel(s.campaign[city]?.taps || 0) === 10).length;
}

function showTycoon() {
  Tycoon.recharge(tycoon, Date.now());
  $('energy').textContent = tycoon.energy + ' / ' + Tycoon.energyCap(tycoon);
  $('energy-bar').max = Tycoon.energyCap(tycoon);
  $('energy-bar').value = tycoon.energy;
  $('tap').disabled = !s.city || tycoon.energy < 1;
  $('upgrade').disabled = !s.city || s.coins < cost() || tycoon.energy < 3;
  const minutes = Math.ceil(Math.max(0, tycoon.nextChest - Date.now()) / 60000);
  $('chest').disabled = !s.city || minutes > 0;
  $('chest').textContent = minutes ? 'Следующий сундук через ' + minutes + ' мин' : 'Открыть сундук';
}

function renderPrestige() {
  $('prestige-points').textContent = 'Очки престижа: ' + tycoon.points;
  const reward = prestigeReward();
  $('prestige').disabled = !reward;
  $('prestige').textContent = reward ? 'Начать заново · +' + reward + ' очков' : 'Заверши хотя бы один город';
  const tree = $('technology-tree');
  tree.replaceChildren();
  for (const perk of Tycoon.tech) {
    const row = document.createElement('div');
    row.className = 'task';
    const description = document.createElement('div');
    description.textContent = perk.name;
    const effect = document.createElement('small');
    const prerequisite = Tycoon.tech.find(tech => tech.id === perk.requires);
    effect.textContent = perk.effect + (prerequisite ? ' · после «' + prerequisite.name + '»' : '');
    description.append(effect);
    const button = document.createElement('button');
    const owned = tycoon.technologies.includes(perk.id);
    button.textContent = owned ? 'Изучено' : perk.price + ' очк.';
    button.disabled = owned || tycoon.points < perk.price ||
      (!!perk.requires && !tycoon.technologies.includes(perk.requires));
    button.onclick = () => {
      if (button.disabled || !button.isConnected) return;
      collect();
      tycoon.points -= perk.price;
      tycoon.technologies.push(perk.id);
      save();
      render();
    };
    row.append(description, button);
    tree.append(row);
  }
}

$('chest').onclick = () => {
  if (!s.city) return;
  const reward = Tycoon.chest(tycoon, Date.now(), Math.random());
  if (!reward) return;
  s.coins += reward.coins;
  save();
  render();
  notice('Сундук: +' + reward.coins + ' монет' + (reward.energy ? ' и +' + reward.energy + ' энергии' : ''));
};

$('prestige').onclick = () => {
  const reward = prestigeReward();
  if (!reward || !confirm('Сбросить города, постройки, менеджеров, монеты и текущие задания за ' + reward + ' очк. престижа?')) return;
  const firstCity = cities[0];
  Object.assign(s, fresh(), {city: firstCity, campaign: {
    [firstCity]: {taps: 0, built: []}
  }});
  s.built = s.campaign[firstCity].built;
  tycoon.points += reward;
  tycoon.energy = Tycoon.energyCap(tycoon);
  tycoon.energyAt = Date.now();
  combo = 0;
  lastTap = 0;
  selected = 0;
  save();
  render();
  notice('Получено очков престижа: ' + reward);
};

function cityLevel(taps) {
  return thresholds.filter(threshold => taps >= threshold).length;
}

function isUnlocked(city) {
  const index = cities.indexOf(city);
  return index === 0 || !!s.campaign[city] ||
    (index > 0 && cityLevel(s.campaign[cities[index - 1]]?.taps || 0) === 10);
}

function buildProject(building) {
  if (s.built.includes(building[0])) return;
  s.built.push(building[0]);
  s.income += building[3];
  s.contribution += Math.round(building[2] / 2);
  daily().builds++;
}

function developCity() {
  const progress = s.campaign[s.city];
  progress.taps = Math.min(thresholds.at(-1), progress.taps + 1);
  const level = cityLevel(progress.taps);
  if (level === s.level) return false;
  s.level = level;
  const project = buildings[level - 2];
  buildProject(project);
  notice('Уровень ' + level + ' · ' + project[0] + (level === 10 ? ' · Город завершён' : ''));
  return true;
}

function showCampaign() {
  const index = cities.indexOf(s.city);
  const progress = s.campaign[s.city];
  $('route').textContent = index >= 0 ? 'Маршрут · ' + (index + 1) + ' из ' + cities.length : 'Маршрут по Чеченской Республике';
  const previous = thresholds[s.level - 1];
  const next = thresholds[s.level];
  $('city-development').value = next ? ((progress?.taps || 0) - previous) / (next - previous) : 1;
  $('development-text').textContent = !progress ? 'Начни с Урус-Мартана' : next
    ? 'Уровень ' + s.level + ' из 10 · до улучшения ' + (next - progress.taps) + ' нажатий'
    : 'Уровень 10 из 10 · город завершён';
  const nextCity = cities[index + 1];
  if (index === cities.length - 1 && s.level === 10) {
    const completed = cities.every(city => cityLevel(s.campaign[city]?.taps || 0) === 10);
    if (completed) $('development-text').textContent = 'Все 10 городов завершены';
  }
  $('next-city').hidden = !!authoritativeOnlineCity || !nextCity || !s.city || (index >= 0 && s.level < 10);
  $('next-city').textContent = nextCity ? 'Перейти: ' + nextCity : '';
  $('walk').disabled = !s.city;
  $('town').dataset.level = s.level;
  $('development-stage').textContent = s.level >= 9 ? 'Новый город'
    : s.level >= 6 ? 'Рост' : s.level >= 3 ? 'Обновление' : 'Восстановление';
}

function renderCityOptions() {
  const select = $('cities');
  select.replaceChildren();
  const legacyCities = Object.keys(s.campaign).filter(city => !cities.includes(city) && !authoritativeOnlineCity);
  const options = [...cities, ...legacyCities];
  for (const city of options) {
    const option = document.createElement('option');
    option.value = city;
    option.disabled = authoritativeOnlineCity ? city !== authoritativeOnlineCity : city !== s.city && !isUnlocked(city);
    option.textContent = option.disabled ? city + ' · закрыт' : city;
    select.append(option);
  }
  select.value = s.city || cities[0];
}

function visitCity(city) {
  if (authoritativeOnlineCity && city !== authoritativeOnlineCity) { notice('Онлайн-город закреплён за аккаунтом: ' + authoritativeOnlineCity); return; }
  if ((!authoritativeOnlineCity && !isUnlocked(city)) || s.city === city) return;
  collect();
  const progress = s.campaign[city] ||= { taps: 0, built: [] };
  s.city = city;
  s.level = cityLevel(progress.taps);
  s.built = progress.built;
  selected = 0;
  save();
  render();
}

if (s.city && s.campaign[s.city]) s.built = s.campaign[s.city].built;
window.addEventListener('game:guest-started',event=>{const ids={'grozny':'Грозный','urus_martan':'Урус-Мартан','argun':'Аргун','gudermes':'Гудермес','shali':'Шали','kurchaloy':'Курчалой','achkhoy_martan':'Ачхой-Мартан','oyskhara':'Ойсхара','sernovodskoye':'Серноводское','shatoy':'Шатой'};const selected=ids[event.detail?.cityId]||'Грозный';if(authoritativeOnlineCity)return;collect();const progress=s.campaign[selected]||={taps:0,built:[]};s.city=selected;s.level=cityLevel(progress.taps);s.built=progress.built;selected=0;save();render();});


function showIncome() {
  const wholeCoins = Math.floor(s.coins);
  $('coins').textContent = balanceFormat.format(Math.floor((s.coins + 1e-8) * 100) / 100);
  const progress = $('income-progress');
  const label = $('income-next');
  progress.value = s.city ? Math.max(0, s.coins - wholeCoins) : 0;
  label.textContent = s.city && hourlyIncome() > 0
    ? 'Следующая монета через ' + Math.max(1, Math.ceil((1 - progress.value) * 3600 / hourlyIncome() - 1e-6)) + ' с'
    : 'Выбери город для начисления';
}
function showTapGain(amount) {
  const layer = $('pop');
  const particle = document.createElement('span');
  particle.textContent = '+' + fmt(amount);
  particle.style.setProperty('--drift', (Math.random() * 70 - 35) + 'px');
  layer.append(particle);
  setTimeout(() => particle.remove(), 700);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    particle.remove();
    return;
  }
  $('tap').animate?.([{ transform: 'scale(.95)' }, { transform: 'scale(1)' }], { duration: 160 });
}
function stats() {
  showIncome();
  showCampaign();
  for (const key of ['level', 'contribution']) $(key).textContent = fmt(s[key]);
  $('income').textContent = fmt(hourlyIncome());
  $('city').textContent = s.city || 'Выбери свой город';
  $('power').textContent = '+' + fmt(power() * (combo >= 10 ? 2 : 1)) + ' монет';
  $('combo').textContent = combo >= 10 ? 'Комбо ×2!' : 'Комбо ' + combo + ' / 10';
  $('bar').value = combo;
  $('upgrade').textContent = 'Улучшить нажатие: ' + fmt(cost()) + ' ◉ · 3 энергии';
  showTycoon();
}

function projectActions(project) {
  const [name, , basePrice, , minimumLevel] = project;
  const city = s.campaign[s.city];
  const level = city?.upgrades?.[name] || 0;
  const built = s.built.includes(name);
  return built ? [
    {label: level >= Tycoon.maxUpgrade ? 'Макс. уровень' : 'Улучшить · ' + fmt(Tycoon.price(basePrice, level)),
      cost: Tycoon.price(basePrice, level), energy: 3, locked: level >= Tycoon.maxUpgrade,
      apply() { (city.upgrades ||= {})[name] = level + 1; }},
    {label: city?.managers?.[name] ? 'Менеджер нанят' : 'Нанять · ' + fmt(basePrice * 3),
      cost: basePrice * 3, energy: 0, locked: !!city?.managers?.[name],
      apply() { (city.managers ||= {})[name] = true; }}
  ] : [{label: 'Построить · ' + fmt(basePrice), cost: basePrice, energy: 5,
    locked: s.level < minimumLevel, apply() { buildProject(project); }}];
}

function updateBuildButton() {
  const buttons = $('details').querySelectorAll('button');
  projectActions(buildings[selected]).forEach((action, index) => {
    buttons[index].disabled = !s.city || action.locked || s.coins < action.cost || tycoon.energy < action.energy;
  });
}

function map() {
  const el = $('map');
  el.replaceChildren();
  buildings.forEach((project, i) => {
    const button = document.createElement('button');
    const built = s.built.includes(project[0]);
    button.className = 'plot' + (built ? ' built' : '') + (selected === i ? ' selected' : '');
    const icon = document.createElement('span');
    icon.textContent = built ? project[1] : '＋';
    button.append(icon, document.createTextNode(project[0]));
    button.onclick = () => { selected = i; map(); };
    el.append(button);
  });

  const project = buildings[selected];
  const city = s.campaign[s.city];
  const level = city?.upgrades?.[project[0]] || 0;
  const details = $('details');
  details.replaceChildren();
  const description = document.createElement('p');
  description.textContent = project[0] + (s.built.includes(project[0])
    ? ' · улучшений: ' + level + ' · базовый доход +' + project[3] + '/час'
    : ' · уровень города ' + project[4] + ' · +'+ project[3] + '/час');
  details.append(description);
  for (const action of projectActions(project)) {
    const button = document.createElement('button');
    button.textContent = action.label + (!action.locked && action.energy ? ' · ⚡' + action.energy : '');
    button.onclick = () => {
      if (button.disabled || !button.isConnected) return;
      collect();
      if (s.coins < action.cost || !useEnergy(action.energy)) return;
      s.coins -= action.cost;
      action.apply();
      save();
      render();
    };
    details.append(button);
  }
  updateBuildButton();
}

function tasks(){const d=daily(),list=[['login','Ежедневный вход',1,1,500],['tap','Сделай 100 нажатий',d.taps,100,250],['build','Построй здание',d.builds,1,400]];$('tasks').replaceChildren();for(const [id,title,n,target,reward] of list){const row=document.createElement('div');row.className='task';const label=document.createElement('div');label.textContent=title;const sub=document.createElement('small');sub.textContent=Math.min(n,target)+' / '+target+' · +'+reward+' ◉';label.append(sub);const btn=document.createElement('button');btn.textContent=d.claimed.includes(id)?'Получено':'Забрать';btn.disabled=!s.city||n<target||d.claimed.includes(id);btn.onclick=()=>{const current=daily();if(current.date!==d.date||current.claimed.includes(id))return;current.claimed.push(id);s.coins+=reward;save();render()};row.append(label,btn);$('tasks').append(row)}}function render(){renderCityOptions();stats();map();tasks();renderPrestige()}$('join').onclick = () => visitCity($('cities').value);
$('next-city').onclick = () => visitCity(cities[cities.indexOf(s.city) + 1]);
$('walk').onclick = () => $('walk-view').dispatchEvent(new CustomEvent('walkstart', {
  detail: { city: s.city, level: s.level, built: buildings.map(building => s.built.includes(building[0])) }
}));
$('tap').onclick=()=>{if(!s.city||!useEnergy(1))return;const now=Date.now();combo=now-lastTap<1800?Math.min(10,combo+1):1;lastTap=now;const n=power()*(combo>=10?2:1);s.coins+=n;s.contribution+=n;daily().taps++;const leveled=developCity();save();if(leveled)render();else{stats();updateBuildButton();tasks()}showTapGain(n)};$('upgrade').onclick=()=>{if(!s.city||s.coins<cost()||!useEnergy(3))return;s.coins-=cost();s.tapLevel++;save();render()};const gained=collect();$('offline').textContent='Локальный доход за закрытую игру не начисляется. Онлайн-менеджеры копят до 24 часов по времени сервера.';setInterval(()=>{if(combo&&Date.now()-lastTap>=1800){combo=0;stats()}},250);setInterval(() => {
  if (document.hidden || !s.city) return;
  const wholeCoins = Math.floor(s.coins);
  const questDay = s.daily?.date;
  collect();
  if (questDay !== day()) tasks();
  if (Math.floor(s.coins) !== wholeCoins) {
    stats();
    updateBuildButton();
  } else {
    showIncome();
    showTycoon();
    updateBuildButton();
  }
}, 1000);document.addEventListener('visibilitychange',()=>{if(document.hidden){collect();lastActiveTick=performance.now()}else{lastActiveTick=performance.now();$('offline').textContent='Локальный таймер восстановлен. Пассивный онлайн-доход рассчитывает сервер.';render()}});
// Online leaderboard uses server-recorded community contributions, not editable local balances.
const cfg=window.GAME_CONFIG||{};let session=null;try{session=JSON.parse(localStorage.getItem("vozrozhdenie_online_session")||"null")}catch(e){}async function api(path,method='GET',body){const r=await fetch(cfg.url.replace(/\/$/,'')+path,{method,headers:{apikey:cfg.key,Authorization:'Bearer '+(session?.access_token||cfg.key),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}async function ranking(){if(!cfg.url||!cfg.key){notice('Сначала настрой Supabase');return}try{const rows=await api('/rest/v1/rpc/city_ranking','POST',{});$('ranking').replaceChildren();rows.forEach((r,i)=>{const div=document.createElement('div');div.className='rank';div.textContent=(i+1)+'. '+r.city+' · '+r.members+' игроков';$('ranking').append(div)});$('network').textContent='Онлайн-рейтинг подключён';}catch(e){notice('Не удалось загрузить рейтинг: '+e.message)}}$('refresh').onclick=ranking;$('connect').onclick=async()=>{if(!cfg.url||!cfg.key){notice('Нужно настроить config.js');return}if(!s.city){notice('Сначала выбери город');return}try{if(session?.refresh_token){try{session=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token})}catch(e){session=null}}if(!session){session=await api('/auth/v1/signup','POST',{})}localStorage.setItem('vozrozhdenie_online_session',JSON.stringify(session));await api('/rest/v1/rpc/join_city','POST',{p_city:s.city});$('network').textContent='Ты в онлайн-команде '+s.city;await ranking()}catch(e){notice('Ошибка подключения: '+e.message)}};
let onlineBusy=false;
async function autoOnline(){
 if(onlineBusy||document.hidden||!cfg.url||!cfg.key)return;
 onlineBusy=true;
 try{
  await ranking();
  if(session?.refresh_token&&s.city){
   try{
    const renewed=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token});
    if(renewed?.access_token){
     session=renewed;
     localStorage.setItem('vozrozhdenie_online_session',JSON.stringify(session));
     $('network').textContent='Онлайн-сессия обновлена · рейтинг доступен';
    }
   }catch(e){$('network').textContent='Рейтинг доступен · для команды потребуется вход';}
  }
 }finally{onlineBusy=false}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)autoOnline()});
window.addEventListener('online',autoOnline);
setInterval(()=>{if(!document.hidden)autoOnline()},60000);
// The authenticated server membership is authoritative; legacy local campaigns remain offline-only.
let syncCityBusy=false;
async function syncAuthoritativeCity(){
 if(syncCityBusy||document.hidden||!cfg.url||!cfg.key)return;
 let social;try{social=JSON.parse(localStorage.getItem('vozrozhdenie_social_session_v1')||'null')}catch(_){}
 if(!social?.access_token){authoritativeOnlineCity=null;return;}
 syncCityBusy=true;
 try{
  const response=await fetch(cfg.url.replace(/\/$/,'')+'/rest/v1/rpc/city_my_progress',{
   method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+social.access_token,'Content-Type':'application/json'},body:'{}'
  });
  if(!response.ok)return;
  const rows=await response.json();
  if(!Array.isArray(rows)||!rows.length){authoritativeOnlineCity=null;return;}
  const serverCity=rows[0].city_name;
  if(!cities.includes(serverCity))return;
  authoritativeOnlineCity=serverCity;
  if(s.city!==serverCity){
   collect();const progress=s.campaign[serverCity] ||= {taps:0,built:[]};
   s.city=serverCity;s.level=cityLevel(progress.taps);s.built=progress.built;selected=0;
   save();render();notice('Город синхронизирован: '+serverCity);
  }else{renderCityOptions();showCampaign()}
 }catch(_){/* Keep last confirmed server city if temporarily offline. */}
 finally{syncCityBusy=false}
}
window.addEventListener('online',syncAuthoritativeCity);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncAuthoritativeCity()});
setInterval(syncAuthoritativeCity,60000);
render();autoOnline();syncAuthoritativeCity();})();
