
(()=>{'use strict';
const $=id=>document.getElementById(id);
const key='chr_new_era_settings_v1',defaults={sound:true,music:true,volume:60,vibration:true};
let settings;try{settings={...defaults,...JSON.parse(localStorage.getItem(key)||'{}')}}catch(e){settings={...defaults}}
const persist=()=>localStorage.setItem(key,JSON.stringify(settings));
const screens = document.querySelector('.game-screens');
function section(id, title) {
  const panel = document.createElement('section');
  panel.id = id;
  panel.dataset.screen = '';
  panel.hidden = true;
  const heading = document.createElement('h2');
  heading.textContent = title;
  panel.append(heading);
  screens.append(panel);
  return panel;
}
const achievements = section('achievements', 'Достижения');
achievements.insertAdjacentHTML('beforeend', `<div class="tycoon-card">
  <h3>Престиж и технологии</h3><p id="prestige-points"></p>
  <p>Заверши города и начни новый цикл, чтобы получить очки. Изученные технологии действуют во всех городах.</p>
  <button id="prestige" type="button"></button><div id="technology-tree"></div>
</div>`);
const settingsPanel = section('settings', 'Настройки');
const checkbox=(title,field)=>{const l=document.createElement('label');l.textContent=title;const c=document.createElement('input');c.type='checkbox';c.checked=!!settings[field];c.onchange=()=>{settings[field]=c.checked;persist();if(field==='music')updateMusic()};l.append(c);settingsPanel.append(l)};
checkbox('Звуковые эффекты','sound');checkbox('Фоновая музыка','music');checkbox('Вибрация','vibration');
const l=document.createElement('label');l.textContent='Громкость';const slider=document.createElement('input');slider.type='range';slider.min=0;slider.max=100;slider.value=settings.volume;slider.oninput=()=>{settings.volume=Number(slider.value);persist();updateMusic()};l.append(slider);settingsPanel.append(l);
const hint=document.createElement('p');hint.textContent='Настройки сохраняются на этом устройстве.';settingsPanel.append(hint);
let audioCtx,musicTimer=null,musicStep=0;
function ctx(){try{return audioCtx||(audioCtx=new(window.AudioContext||window.webkitAudioContext)())}catch(e){return null}}
function sound(){if(!settings.sound||!settings.volume)return;const a=ctx();if(!a)return;try{const o=a.createOscillator(),g=a.createGain(),t=a.currentTime;o.type='sine';o.frequency.setValueAtTime(640,t);o.frequency.exponentialRampToValueAtTime(900,t+.09);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,settings.volume/100*.055),t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.12);o.connect(g).connect(a.destination);o.start(t);o.stop(t+.13)}catch(e){}}
// Original quiet ambient theme: changing chords, bell melody and a soft bass pulse.
const chords=[[196,246.94,293.66],[174.61,220,261.63],[164.81,207.65,246.94],[146.83,196,246.94]];
const melody=[392,440,493.88,587.33,493.88,440,392,329.63,349.23,392,440,523.25,440,392,349.23,293.66];
function playTone(a,freq,start,duration,volume,type='sine'){try{const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.00001,start);g.gain.linearRampToValueAtTime(volume,start+.07);g.gain.exponentialRampToValueAtTime(.00001,start+duration);o.connect(g).connect(a.destination);o.start(start);o.stop(start+duration+.02)}catch(e){}}
function musicNote(){if(!settings.music||!settings.volume||document.hidden)return;const a=ctx();if(!a||a.state!=='running')return;const t=a.currentTime,step=musicStep++,scale=settings.volume/100;const chord=chords[Math.floor(step/4)%chords.length];if(step%4===0){chord.forEach((f,i)=>playTone(a,f,t,3.8,scale*.0035,'sine'));playTone(a,chord[0]/2,t,2.4,scale*.009,'triangle')}if(step%2===0)playTone(a,melody[step%melody.length],t,.85,scale*.014,'sine');else if(step%4===3)playTone(a,melody[(step+2)%melody.length]/2,t,1.1,scale*.006,'triangle')}
function updateMusic(){if(musicTimer){clearInterval(musicTimer);musicTimer=null}if(!settings.music||!settings.volume||document.hidden)return;const a=ctx();if(!a)return;a.resume?.().catch(()=>{});musicNote();musicTimer=setInterval(musicNote,720)}
document.addEventListener('pointerdown',()=>{if(settings.music){const a=ctx();if(a&&a.state!=='running')a.resume().then(updateMusic).catch(()=>{});else if(!musicTimer)updateMusic()}},{passive:true});
updateMusic();
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
