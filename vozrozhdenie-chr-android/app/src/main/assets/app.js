(() => {
  const $ = (id) => document.getElementById(id);
  const tg = window.Telegram?.WebApp;
  if (tg) { tg.ready(); tg.expand(); try { tg.setHeaderColor('#0e211e'); tg.setBackgroundColor('#0e211e'); } catch (_) {} }

  // The original storage key is deliberately unchanged: previous city and purchases survive.
  const KEY = 'vozrozhdenie_demo_v1';
  const freshState = () => ({ city: null, coins: 1250, income: 60, level: 1, contribution: 120, built: [], tapLevel: 0, lastCollectedAt: Date.now() });
  let state;
  try { state = { ...freshState(), ...(JSON.parse(localStorage.getItem(KEY) || '{}')) }; } catch (_) { state = freshState(); }
  if (!Array.isArray(state.built)) state.built = [];
  for (const field of ['coins', 'income', 'level', 'contribution', 'tapLevel']) {
    state[field] = Number.isFinite(Number(state[field])) ? Number(state[field]) : freshState()[field];
  }
  state.tapLevel = Math.max(0, Math.floor(state.tapLevel));
  const comboTarget = 10;
  const comboTimeout = 1800;
  let combo = 0;
  let lastTapAt = 0;
  let offlineReward = 0;

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} }
  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function format(amount) { return Math.floor(amount).toLocaleString('ru-RU'); }
  function tapPower() { return 10 + state.tapLevel * 5; }
  function upgradeCost() { return Math.floor(200 * Math.pow(1.7, state.tapLevel)); }

  // Award elapsed passive income; at most 24 h at a time to limit wall-clock abuse.
  function collectIncome() {
    const now = Date.now();
    const previous = Number(state.lastCollectedAt);
    if (!Number.isFinite(previous) || previous <= 0) { state.lastCollectedAt = now; save(); return 0; }
    const elapsed = Math.max(0, Math.min(now - previous, 24 * 60 * 60 * 1000));
    const reward = state.income * elapsed / 3600000;
    state.coins += reward;
    state.lastCollectedAt = now;
    save();
    return reward;
  }
  // Old saves had no timestamp. They begin collecting now, without guessing past time.
  if (!Number.isFinite(Number(state.lastCollectedAt)) || Number(state.lastCollectedAt) <= 0) {
    state.lastCollectedAt = Date.now(); save();
  } else {
    offlineReward = collectIncome();
  }
  function showCity() {
    $('welcomeScreen').classList.add('hidden');
    $('cityScreen').classList.remove('hidden');
    $('bottomNav').classList.remove('hidden');
    $('cityName').textContent = state.city || 'Грозный';
    renderStats(); renderBuilds(); renderEarnings();
  }
  function renderStats() {
    $('coinBalance').textContent = format(state.coins);
    $('incomeRate').textContent = '+' + format(state.income);
    $('cityLevel').textContent = state.level;
    $('contribution').textContent = format(state.contribution);
  }
  function renderBuilds() {
    document.querySelectorAll('.build-button').forEach(btn => {
      const completed = state.built.includes(btn.dataset.name);
      btn.textContent = completed ? 'ГОТОВО ✓' : format(Number(btn.dataset.cost)) + ' ◉';
      btn.disabled = completed;
      btn.style.opacity = completed ? '.65' : '1';
    });
  }
  function renderEarnings() {
    const power = tapPower();
    const cost = upgradeCost();
    $('tapPower').textContent = '+' + format(power) + ' за нажатие';
    $('tapButtonAmount').textContent = '+' + format(power * (combo >= comboTarget ? 2 : 1)) + ' монет';
    $('comboLabel').textContent = combo >= comboTarget ? 'Комбо активно! ×2' : 'Комбо: ' + combo + ' / ' + comboTarget;
    $('comboBonus').textContent = combo >= comboTarget ? 'Нажимай быстро' : '×2 после 10 нажатий';
    $('comboProgress').style.width = Math.min(100, combo / comboTarget * 100) + '%';
    $('upgradeDescription').textContent = 'Уровень ' + state.tapLevel + ' → ' + (state.tapLevel + 1) + ': +' + format(power + 5) + ' за нажатие';
    $('upgradeBtn').textContent = format(cost) + ' ◉';
    $('upgradeBtn').disabled = state.coins < cost;
  }
  $('tapBtn').addEventListener('click', () => {
    const now = Date.now();
    combo = now - lastTapAt <= comboTimeout ? Math.min(comboTarget, combo + 1) : 1;
    lastTapAt = now;
    const earned = tapPower() * (combo >= comboTarget ? 2 : 1);
    state.coins += earned;
    state.contribution += earned;
    save(); renderStats(); renderEarnings();
  });
  $('upgradeBtn').addEventListener('click', () => {
    const cost = upgradeCost();
    if (state.coins < cost) { toast('Пока не хватает монет'); return; }
    state.coins -= cost; state.tapLevel += 1;
    save(); renderStats(); renderEarnings();
    toast('Сила нажатия увеличена!');
  });
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
    collectIncome(); // Credit the old income rate before the building changes it.
    if (state.coins < cost) { toast('Пока не хватает монет'); renderStats(); return; }
    state.coins -= cost; state.income += income; state.contribution += Math.round(cost / 2);
    state.built.push(name); state.level = 1 + state.built.length;
    save(); renderStats(); renderBuilds(); renderEarnings();
    toast(name + ' построен! Доход увеличен.');
  }));
  $('tasksNav').addEventListener('click', () => toast('Задания появятся на следующем этапе'));
  $('teamNav').addEventListener('click', () => toast('Командные проекты добавим на следующем этапе'));
  $('ratingNav').addEventListener('click', () => document.querySelector('.ranking-heading').scrollIntoView({behavior:'smooth'}));
  $('soundBtn').addEventListener('click', () => toast('Звуки пока отключены'));

  function onResume() {
    const gained = collectIncome();
    if (state.city && gained >= 1) $('offlineInfo').textContent = 'Начислено за время отсутствия: +' + format(gained) + ' ◉';
    if (Date.now() - lastTapAt > comboTimeout) combo = 0;
    if (state.city) { renderStats(); renderEarnings(); }
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) onResume(); });
  window.addEventListener('pageshow', () => onResume());
  setInterval(() => {
    if (document.hidden) return;
    collectIncome();
    if (combo && Date.now() - lastTapAt > comboTimeout) combo = 0;
    if (state.city) { renderStats(); renderEarnings(); }
  }, 10000);
  if (state.city) {
    showCity();
    if (offlineReward >= 1) $('offlineInfo').textContent = 'Пока тебя не было, начислено: +' + format(offlineReward) + ' ◉';
  }
})();
