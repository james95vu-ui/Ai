
(()=>{'use strict';
const $=id=>document.getElementById(id);
const key='chr_new_era_settings_v1',defaults={sound:true,music:false,volume:60,vibration:true};
let settings;try{settings={...defaults,...JSON.parse(localStorage.getItem(key)||'{}')}}catch(e){settings={...defaults}}
const persist=()=>localStorage.setItem(key,JSON.stringify(settings));
const main=document.querySelector('main'),nav=document.querySelector('nav');
const section=(id,title)=>{const s=document.createElement('section');s.id=id;const h=document.createElement('h2');h.textContent=title;s.append(h);main.insertBefore(s,$('notice'));return s};
const achievements=section('achievements','🏅 Достижения');
const settingsPanel=section('settings','⚙ Настройки');
const addNav=(id,label)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>$(id).scrollIntoView({behavior:'smooth'});nav.append(b)};
addNav('achievements','🏅 Награды');addNav('settings','⚙ Настройки');
const checkbox=(title,field)=>{const l=document.createElement('label');l.textContent=title;const c=document.createElement('input');c.type='checkbox';c.checked=!!settings[field];c.onchange=()=>{settings[field]=c.checked;persist();if(field==='music')updateMusic()};l.append(c);settingsPanel.append(l)};
checkbox('Звуковые эффекты','sound');checkbox('Фоновая музыка','music');checkbox('Вибрация','vibration');
const l=document.createElement('label');l.textContent='Громкость';const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=settings.volume;slider.oninput=()=>{settings.volume=Number(slider.value);persist();updateMusic()};l.append(slider);settingsPanel.append(l);
const hint=document.createElement('p');hint.textContent='Настройки сохраняются на этом устройстве.';settingsPanel.append(hint);
let audioCtx,osc,gain;function ctx(){try{return audioCtx||(audioCtx=new(window.AudioContext||window.webkitAudioContext)())}catch(e){return null}}
function sound(){if(!settings.sound||!settings.volume)return;const a=ctx();if(!a)return;try{const o=a.createOscillator(),g=a.createGain(),t=a.currentTime;o.type='sine';o.frequency.setValueAtTime(640,t);o.frequency.exponentialRampToValueAtTime(900,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,settings.volume/100*.055),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.12);o.connect(g).connect(a.destination);o.start(t);o.stop(t+.13)}catch(e){}}
function updateMusic(){if(!settings.music||!settings.volume||document.hidden){if(osc){try{osc.stop()}catch(e){}osc.disconnect();osc=null}return}const a=ctx();if(!a||osc)return;try{osc=a.createOscillator();gain=a.createGain();osc.type='sine';osc.frequency.value=174.61;gain.gain.value=settings.volume/100*.008;osc.connect(gain).connect(a.destination);osc.start()}catch(e){osc=null}}
document.addEventListener('visibilitychange',updateMusic);
$('tap').addEventListener('click', () => {
  sound();
  if (!settings.vibration) return;
  if (window.CityHaptics) window.CityHaptics.tap();
  else navigator.vibrate?.(16);
});
$('join').addEventListener('click',sound);$('upgrade').addEventListener('click',sound);
const oldKey='vozrozhdenie_demo_v1';
const awards=[['Первый шаг','Выбери город',s=>!!s.city],['Строитель','Построй первое здание',s=>(s.built||[]).length>=1],['Архитектор','Построй 5 зданий',s=>(s.built||[]).length>=5],['Мастер дохода','Достигни 500 монет в час',s=>s.income>=500],['Герой города','Достигни 5 уровня',s=>s.level>=5],['Тысяча вкладов','Набери 1000 очков вклада',s=>s.contribution>=1000]];
function renderAwards(){let s={};try{s=JSON.parse(localStorage.getItem(oldKey)||'{}')}catch(e){}achievements.querySelectorAll('.achievement').forEach(e=>e.remove());for(const [name,desc,check] of awards){const ok=check(s),r=document.createElement('div');r.className='achievement'+(ok?'':' locked');const t=document.createElement('div');t.textContent=(ok?'🏆 ':'🔒 ')+name;const small=document.createElement('small');small.textContent=desc;t.append(document.createElement('br'),small);const status=document.createElement('strong');status.textContent=ok?'✓':'—';r.append(t,status);achievements.append(r)}}
renderAwards();document.addEventListener('click',()=>setTimeout(renderAwards,30));setInterval(renderAwards,15000);
})();
