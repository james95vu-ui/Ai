(() => {
  const $ = (id) => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#0e211e'); tg.setBackgroundColor('#0e211e'); } catch (_) {} }

  const KEY = 'vozrozhdenie_demo_v1';
  const freshState = () => ({ city: null, coins: 1250, income: 60, level: 1, contribution: 120, built: [] });
  let state;
  try { state = { ...freshState(), ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch { state = freshState(); }

  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function showCity() {
    $('welcomeScreen').classList.add('hidden');
    $('cityScreen').classList.remove('hidden');
    $('bottomNav').classList.remove('hidden');
    $('cityName').textContent = state.city || 'Грозный';
    renderStats(); renderBuilds();
  }
  function renderStats() {
    $('coinBalance').textContent = Math.floor(state.coins).toLocaleString('ru-RU');
    $('incomeRate').textContent = '+' + state.income;
    $('cityLevel').textContent = state.level;
    $('contribution').textContent = state.contribution.toLocaleString('ru-RU');
  }
  function renderBuilds() {
    document.querySelectorAll('.build-button').forEach(btn => {
      const name = btn.dataset.name;
      if (state.built.includes(name)) { btn.textContent = 'ГОТОВО ✓'; btn.disabled = true; btn.style.opacity = '.65'; }
    });
  }
  $('joinBtn').addEventListener('click', () => {
    state.city = $('settlementSelect').value; save(); showCity();
    toast('Добро пожаловать в команду ' + state.city + '!');
  });
  $('changeCityBtn').addEventListener('click', () => {
    $('cityScreen').classList.add('hidden'); $('bottomNav').classList.add('hidden');
    $('welcomeScreen').classList.remove('hidden'); $('settlementSelect').value = state.city || 'Грозный';
  });
  document.querySelectorAll('.build-button').forEach(btn => btn.addEventListener('click', () => {
    const cost = Number(btn.dataset.cost), income = Number(btn.dataset.income), name = btn.dataset.name;
    if (state.built.includes(name)) return;
    if (state.coins < cost) { toast('Пока не хватает монет'); return; }
    state.coins -= cost; state.income += income; state.contribution += Math.round(cost / 2);
    state.built.push(name); state.level = 1 + state.built.length; save(); renderStats(); renderBuilds();
    toast(name + ' построен! Доход увеличен.');
  }));
  $('tasksNav').addEventListener('click', () => toast('Задания появятся на следующем этапе'));
  $('teamNav').addEventListener('click', () => toast('Командные проекты добавим на следующем этапе'));
  $('ratingNav').addEventListener('click', () => document.querySelector('.ranking-heading').scrollIntoView({behavior:'smooth'}));
  $('soundBtn').addEventListener('click', () => toast('Звуки пока отключены'));
  if (state.city) showCity();
})();
