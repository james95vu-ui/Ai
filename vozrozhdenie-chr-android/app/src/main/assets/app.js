(()=>{'use strict';const $=id=>document.getElementById(id),KEY='vozrozhdenie_demo_v1',fmt=n=>Math.floor(n).toLocaleString('ru-RU');
const balanceFormat = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cities = ['Урус-Мартан', 'Гудермес', 'Шали', 'Аргун', 'Ойсхара', 'Ачхой-Мартан', 'Курчалой', 'Шелковская', 'Наурская', 'Грозный'];
const thresholds = [0, 5, 12, 22, 35, 52, 74, 102, 137, 180];
const buildings=[['Городской парк','🌳',500,20,1],['Новая школа','🏫',900,35,1],['Мастерская','🏭',1400,50,1],['Жилой дом','🏠',1800,75,2],['Больница','🏥',2500,110,3],['Мечеть','🕌',3000,130,3],['Рынок','🏪',3800,180,4],['Стадион','🏟️',5000,240,5],['Библиотека','📚',6500,320,6]];const fresh=()=>({city:null,coins:1250,income:60,level:1,contribution:120,built:[],tapLevel:0,lastCollectedAt:Date.now(),daily:{}});let s;try{s={...fresh(),...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(e){s=fresh()}if(!Array.isArray(s.built))s.built=[];for(const k of ['coins','income','level','contribution','tapLevel','lastCollectedAt'])if(!Number.isFinite(s[k]))s[k]=fresh()[k];let combo=0,lastTap=0,selected=0,timer;const save=()=>localStorage.setItem(KEY,JSON.stringify(s));const day=()=>new Date().toISOString().slice(0,10);function daily(){if(s.daily?.date!==day())s.daily={date:day(),taps:0,builds:0,claimed:[]};return s.daily}function collect(){const now=Date.now(),gain=s.city?Math.max(0,Math.min(now-s.lastCollectedAt,86400000))*s.income/3600000:0;s.coins+=gain;if(Math.abs(s.coins-Math.round(s.coins))<1e-8)s.coins=Math.round(s.coins);s.lastCollectedAt=Math.max(now,s.lastCollectedAt);save();return gain}function notice(t){$('notice').textContent=t;clearTimeout(timer);timer=setTimeout(()=>$('notice').textContent='',2500)}function power(){return 10+5*s.tapLevel}function cost(){return Math.floor(200*1.7**s.tapLevel)}// Keep the existing active-city fields for saved games and achievement readers.
if (!s.campaign || typeof s.campaign !== 'object' || Array.isArray(s.campaign)) {
  s.campaign = {};
  if (s.city) {
    const restoredLevel = Math.max(1, Math.min(10, Math.trunc(s.level)));
    s.campaign[s.city] = { taps: thresholds[restoredLevel - 1], built: s.built };
    s.level = restoredLevel;
  }
}

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
  $('next-city').hidden = !nextCity || !s.city || (index >= 0 && s.level < 10);
  $('next-city').textContent = nextCity ? 'Перейти: ' + nextCity : '';
  $('walk').disabled = !s.city;
  $('town').dataset.level = s.level;
  $('development-stage').textContent = s.level >= 9 ? 'Новый город'
    : s.level >= 6 ? 'Рост' : s.level >= 3 ? 'Обновление' : 'Восстановление';
}

function renderCityOptions() {
  const select = $('cities');
  select.replaceChildren();
  const legacyCities = Object.keys(s.campaign).filter(city => !cities.includes(city));
  const options = [...cities, ...legacyCities];
  for (const city of options) {
    const option = document.createElement('option');
    option.value = city;
    option.disabled = city !== s.city && !isUnlocked(city);
    option.textContent = option.disabled ? city + ' · закрыт' : city;
    select.append(option);
  }
  select.value = s.city || cities[0];
}

function visitCity(city) {
  if (!isUnlocked(city) || s.city === city) return;
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

function showIncome() {
  const wholeCoins = Math.floor(s.coins);
  $('coins').textContent = balanceFormat.format(Math.floor((s.coins + 1e-8) * 100) / 100);
  const progress = $('income-progress');
  const label = $('income-next');
  progress.value = s.city ? Math.max(0, s.coins - wholeCoins) : 0;
  label.textContent = s.city && s.income > 0
    ? 'Следующая монета через ' + Math.max(1, Math.ceil((1 - progress.value) * 3600 / s.income - 1e-6)) + ' с'
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
function stats(){showIncome();showCampaign();for(const k of ['income','level','contribution'])$(k).textContent=fmt(s[k]);$('city').textContent=s.city||'Выбери свой город';$('power').textContent='+'+fmt(power()*(combo>=10?2:1))+' монет';$('combo').textContent=combo>=10?'Комбо ×2!':'Комбо '+combo+' / 10';$('bar').value=combo;$('upgrade').textContent='Улучшить нажатие: '+fmt(cost())+' ◉';$('upgrade').disabled=!s.city||s.coins<cost();$('tap').disabled=!s.city}function updateBuildButton() {
  const building = buildings[selected];
  const button = $('details').querySelector('button');
  button.disabled = s.built.includes(building[0]) || !s.city || s.level < building[4] || s.coins < building[2];
}
function map(){const el=$('map');el.replaceChildren();buildings.forEach((b,i)=>{const btn=document.createElement('button');btn.className='plot'+(s.built.includes(b[0])?' built':'')+(selected===i?' selected':'');const icon=document.createElement('span');icon.textContent=s.built.includes(b[0])?b[1]:'＋';btn.append(icon,document.createTextNode(b[0]));btn.onclick=()=>{selected=i;map()};el.append(btn)});const b=buildings[selected],done=s.built.includes(b[0]);$('details').replaceChildren();const p=document.createElement('p');p.textContent=b[0]+' · '+fmt(b[2])+' монет · +'+b[3]+'/час · уровень '+b[4];const btn=document.createElement('button');btn.textContent=done?'Построено ✓':'Построить';btn.onclick=()=>{collect();if(s.built.includes(b[0])||s.coins<b[2]||s.level<b[4])return;s.coins-=b[2];buildProject(b);save();render();notice('Построено: '+b[0]);};$('details').append(p,btn);updateBuildButton()}function tasks(){const d=daily(),list=[['login','Ежедневный вход',1,1,500],['tap','Сделай 100 нажатий',d.taps,100,250],['build','Построй здание',d.builds,1,400]];$('tasks').replaceChildren();for(const [id,title,n,target,reward] of list){const row=document.createElement('div');row.className='task';const label=document.createElement('div');label.textContent=title;const sub=document.createElement('small');sub.textContent=Math.min(n,target)+' / '+target+' · +'+reward+' ◉';label.append(sub);const btn=document.createElement('button');btn.textContent=d.claimed.includes(id)?'Получено':'Забрать';btn.disabled=!s.city||n<target||d.claimed.includes(id);btn.onclick=()=>{const current=daily();if(current.date!==d.date||current.claimed.includes(id))return;current.claimed.push(id);s.coins+=reward;save();render()};row.append(label,btn);$('tasks').append(row)}}function render(){renderCityOptions();stats();map();tasks()}$('join').onclick = () => visitCity($('cities').value);
$('next-city').onclick = () => visitCity(cities[cities.indexOf(s.city) + 1]);
$('walk').onclick = () => $('walk-view').dispatchEvent(new CustomEvent('walkstart', {
  detail: { city: s.city, level: s.level, built: buildings.map(building => s.built.includes(building[0])) }
}));
$('tap').onclick=()=>{if(!s.city)return;const now=Date.now();combo=now-lastTap<1800?Math.min(10,combo+1):1;lastTap=now;const n=power()*(combo>=10?2:1);s.coins+=n;s.contribution+=n;daily().taps++;const leveled=developCity();save();if(leveled)render();else{stats();updateBuildButton();tasks()}showTapGain(n)};$('upgrade').onclick=()=>{if(!s.city||s.coins<cost())return;s.coins-=cost();s.tapLevel++;save();render()};const gained=collect();$('offline').textContent='Офлайн-доход: +'+fmt(gained)+' монет (до 24 часов)';setInterval(()=>{if(combo&&Date.now()-lastTap>=1800){combo=0;stats()}},250);setInterval(() => {
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
  }
}, 1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){const n=collect();$('offline').textContent='Начислено: +'+fmt(n)+' монет';render()}});
// Online leaderboard uses server-recorded community contributions, not editable local balances.
const cfg=window.GAME_CONFIG||{};let session=null;try{session=JSON.parse(localStorage.getItem("vozrozhdenie_online_session")||"null")}catch(e){}async function api(path,method='GET',body){const r=await fetch(cfg.url.replace(/\/$/,'')+path,{method,headers:{apikey:cfg.key,Authorization:'Bearer '+(session?.access_token||cfg.key),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error('HTTP '+r.status);return r.json()}async function ranking(){if(!cfg.url||!cfg.key){notice('Сначала настрой Supabase');return}try{const rows=await api('/rest/v1/rpc/city_ranking','POST',{});$('ranking').replaceChildren();rows.forEach((r,i)=>{const div=document.createElement('div');div.className='rank';div.textContent=(i+1)+'. '+r.city+' · '+r.members+' игроков';$('ranking').append(div)});$('network').textContent='Онлайн-рейтинг подключён';}catch(e){notice('Не удалось загрузить рейтинг: '+e.message)}}$('refresh').onclick=ranking;$('connect').onclick=async()=>{if(!cfg.url||!cfg.key){notice('Нужно настроить config.js');return}if(!s.city){notice('Сначала выбери город');return}try{if(session?.refresh_token){try{session=await api('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token})}catch(e){session=null}}if(!session){session=await api('/auth/v1/signup','POST',{})}localStorage.setItem('vozrozhdenie_online_session',JSON.stringify(session));await api('/rest/v1/rpc/join_city','POST',{p_city:s.city});$('network').textContent='Ты в онлайн-команде '+s.city;await ranking()}catch(e){notice('Ошибка подключения: '+e.message)}};render();})();
