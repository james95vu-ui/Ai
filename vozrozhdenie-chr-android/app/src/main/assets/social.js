(() => {
  'use strict';

  const get = id => document.getElementById(id);
  const config = window.GAME_CONFIG || {};
  const key = 'vozrozhdenie_social_session_v1';
  const pendingKey = key + '_pending';
  const loginKey = key + '_login';
  const redirect = 'com.vozrozhdenie.chr://auth/callback';
  const nativeLogin = typeof window.CityAuth?.createChallenge === 'function';
  const sections = ['trade', 'clans', 'chat'];
  const status = get('social-status');
  let session, email, active = 'trade', busy = false;
  let player, community, waitingLogin, queuedReturn;

  try { session = JSON.parse(localStorage.getItem(key)); } catch (_) { session = null; }
  try {
    waitingLogin = JSON.parse(localStorage.getItem(loginKey));
    email = waitingLogin?.email;
  } catch (_) { waitingLogin = null; }

  function saveLogin(login) {
    waitingLogin = login;
    email = login?.email;
    if (login) localStorage.setItem(loginKey, JSON.stringify(login));
    else localStorage.removeItem(loginKey);
  }

  function store(value) {
    session = value;
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
    window.dispatchEvent(new Event('game:auth-changed'));
  }

  function requestId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  }

  function verification(credential) {
    const input = credential.trim();
    if (/^[0-9]{6,10}$/.test(input)) return {email, token: input, type: 'email'};

    let link;
    try { link = new URL(input); }
    catch (_) { throw Error('Вставь код или скопируй адрес кнопки из письма'); }
    const tokens = link.searchParams.getAll('token');
    const type = link.searchParams.get('type');
    if (link.origin !== new URL(config.url).origin || link.pathname !== '/auth/v1/verify' ||
        link.username || link.password || tokens.length !== 1 || !/^[a-zA-Z0-9_-]{16,256}$/.test(tokens[0]) ||
        !['email', 'signup', 'magiclink'].includes(type)) {
      throw Error('Нужна ссылка подтверждения из письма этой игры');
    }
    return {token_hash: tokens[0], type: 'email'};
  }

  async function request(path, data, token = config.key) {
    const response = await fetch(config.url.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', apikey: config.key, Authorization: 'Bearer ' + token},
      body: JSON.stringify(data)
    });
    const value = await response.json().catch(() => null);
    if (!response.ok) throw Error(value?.message || value?.msg || value?.error_description || 'Ошибка сервера ' + response.status);
    return value;
  }

  async function rpc(name, data = {}) {
    if (!session) throw Error('Войди по электронной почте');
    if (session.expires_at && session.expires_at < Date.now() / 1000 + 45) {
      store(await request('/auth/v1/token?grant_type=refresh_token', {refresh_token: session.refresh_token}));
    }
    return request('/rest/v1/rpc/tycoon_' + name, data, session.access_token);
  }

  async function mutation(name, data) {
    const signature = JSON.stringify([session.user?.id || player?.player || 'current', name, data]);
    const pending = JSON.parse(localStorage.getItem(pendingKey) || '{}');
    const id = pending[signature] || requestId();
    pending[signature] = id;
    localStorage.setItem(pendingKey, JSON.stringify(pending));
    const payload = {...data, p_request: id};
    try {
      let result;
      try { result = await rpc(name, payload); }
      catch (error) {
        if (!(error instanceof TypeError)) throw error;
        result = await rpc(name, payload);
      }
      delete pending[signature];
      localStorage.setItem(pendingKey, JSON.stringify(pending));
      return result;
    } catch (error) {
      if (!(error instanceof TypeError)) {
        delete pending[signature];
        localStorage.setItem(pendingKey, JSON.stringify(pending));
      }
      throw error;
    }
  }

  function displaySession() {
    get('social-login').hidden = !!session;
    get('social-verify').hidden = !!session || !email;
    get('social-online').hidden = !session;
    get('social-return-hint').hidden = !!session || !waitingLogin?.verifier;
  }

  function run(operation) {
    if (busy) return;
    busy = true;
    status.textContent = 'Загрузка…';
    Promise.resolve().then(operation).then(message => {
      status.textContent = message || 'Данные обновлены';
    }).catch(error => {
      status.textContent = error.message;
    }).finally(() => {
      busy = false;
      if (queuedReturn !== undefined) {
        const code = queuedReturn;
        queuedReturn = undefined;
        completeRedirect(code);
      }
    });
  }

  function onSubmit(id, callback) {
    get(id).onsubmit = event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      run(() => callback(values));
    };
  }

  function row(container, label, actions) {
    const block = document.createElement('div');
    const text = document.createElement('p');
    block.className = 'social-row';
    text.textContent = label;
    block.append(text);
    for (const [title, action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = title;
      button.onclick = () => run(action);
      block.append(button);
    }
    container.append(block);
  }

  async function wallet() {
    player = await rpc('wallet');
    get('wallet-id').value = player.player;
    get('wallet-summary').textContent = player.active
      ? player.coins + ' кредитов · ' + player.materials + ' материалов · суточный остаток переводов ' + player.remaining
      : 'Онлайн-кредиты отделены от монет города. При активации доступно 500 кредитов из общего резерва.';
    get('wallet-activate').hidden = player.active;
    get('wallet-actions').hidden = !player.active;
    const list = get('trade-offers');
    list.replaceChildren();
    for (const offer of player.offers) {
      const incoming = offer.seller === player.player;
      const actions = [];
      if (incoming) actions.push(['Принять', async () => {
        await mutation('economy', {p_action: 'accept', p_data: {offer: offer.id}});
        await wallet();
        return 'Обмен выполнен';
      }]);
      actions.push([incoming ? 'Отклонить' : 'Отозвать', async () => {
        await mutation('economy', {p_action: 'cancel', p_data: {offer: offer.id}});
        await wallet();
      }]);
      row(list, (incoming ? 'Входящее' : 'Исходящее') + ' предложение · ' + offer.coins +
        ' кредитов до сбора за ' + offer.materials + ' материалов', actions);
    }
  }

  async function clans() {
    community = await rpc('community');
    get('clan-current').textContent = community.clan
      ? 'Твой клан: ' + (community.clans.find(clan => clan.id === community.clan)?.name || community.clan)
      : 'Ты ещё не в клане. Для вступления нужен активный онлайн-кошелёк.';
    get('clan-form').hidden = !!community.clan;
    get('clan-leave').hidden = !community.clan;
    const list = get('clan-list');
    list.replaceChildren();
    for (const clan of community.clans) {
      const actions = community.clan || clan.members >= 30 ? [] : [['Вступить', async () => {
        await clanMutation('join', null, clan.id);
      }]];
      row(list, clan.name + ' · ' + clan.members + '/30', actions);
    }
  }

  async function clanMutation(action, name = null, clan = null) {
    await mutation('clan', {p_action: action, p_name: name, p_clan: clan});
    await clans();
  }

  async function moderation() {
    const queue = get('moderation-queue');
    queue.hidden = !community.moderator;
    if (queue.hidden) return;
    const reports = await rpc('moderate');
    queue.replaceChildren();
    for (const item of reports) {
      const actions = [['Скрыть', 'hide'], ['Мут на 24 ч', 'mute'], ['Отклонить', 'dismiss']];
      row(queue, 'Жалоб: ' + item.reports + ' · ' + item.body, actions.map(([title, action]) =>
        [title, async () => {
          await rpc('moderate', {p_message: item.id, p_action: action});
          await chat();
        }]));
    }
  }

  async function chat(message = null) {
    community = await rpc('community');
    const channel = get('chat-channel');
    channel.options[1].disabled = !community.clan;
    if (!community.clan) channel.value = 'public';
    const posts = await rpc('chat', {p_clan: channel.value === 'clan', p_message: message});
    const list = get('chat-messages');
    list.replaceChildren();
    for (const post of posts) {
      row(list, post.player + ' · ' + post.body, [['Жалоба', async () => {
        await rpc('report', {p_message: post.id});
        return 'Жалоба отправлена';
      }]]);
    }
    await moderation();
  }

  function refresh() {
    return {trade: wallet, clans, chat}[active]();
  }

  if (!config.url || !config.key) {
    status.textContent = 'Онлайн-сервис пока не настроен';
    get('social-login').hidden = true;
    return;
  }
  displaySession();

  async function completeLogin(result) {
    if (!result?.access_token || result.user?.email?.toLowerCase() !== email?.trim().toLowerCase()) {
      throw Error('Запроси новое письмо для адреса, который указал в игре');
    }
    store(result);
    get('social-verify').reset();
    saveLogin(null);
    displaySession();
    await refresh();
    return 'Вход выполнен';
  }

  function completeRedirect(code) {
    if (session) return;
    document.querySelector('[data-go="team"]').click();
    get('social').scrollIntoView({block: 'nearest'});
    if (busy) {
      queuedReturn = code;
      return;
    }

    run(async () => {
      if (!code || !waitingLogin?.verifier) {
        throw Error('Запроси новое письмо и открой его на этом устройстве');
      }
      const result = await request('/auth/v1/token?grant_type=pkce', {
        auth_code: code,
        code_verifier: waitingLogin.verifier
      });
      return completeLogin(result);
    });
  }

  window.addEventListener('city-auth-return', event => completeRedirect(event.detail));
  onSubmit('social-login', async values => {
    const address = values.email.trim();
    const data = {email: address, create_user: true};
    const login = {email: address};
    let path = '/auth/v1/otp';
    if (nativeLogin) {
      const [verifier, challenge] = window.CityAuth.createChallenge().split('.');
      login.verifier = verifier;
      data.code_challenge = challenge;
      data.code_challenge_method = 's256';
      path += '?redirect_to=' + encodeURIComponent(redirect);
    }
    try {
      saveLogin(login);
      await request(path, data);
    } catch (error) {
      saveLogin(null);
      displaySession();
      throw error;
    }
    displaySession();
    return nativeLogin ? 'Письмо отправлено. Нажми кнопку в письме на этом устройстве'
      : 'Письмо отправлено. Введи код или вставь ссылку из письма';
  });
  onSubmit('social-verify', async values => {
    const result = await request('/auth/v1/verify', verification(values.credential));
    return completeLogin(result);
  });
  get('social-logout').onclick = () => run(async () => {
    try { await request('/auth/v1/logout?scope=local', {}, session?.access_token); }
    finally { store(null); displaySession(); }
    return 'Выход выполнен';
  });
  get('social-refresh').onclick = () => run(refresh);
  for (const button of document.querySelectorAll('[data-social-tab]')) {
    button.onclick = () => {
      if (busy) return;
      active = button.dataset.socialTab;
      for (const section of sections) {
        get('social-' + section).hidden = section !== active;
        document.querySelector('[data-social-tab="' + section + '"]').setAttribute('aria-pressed', String(section === active));
      }
      run(refresh);
    };
  }
  get('wallet-activate').onclick = () => run(async () => {
    await mutation('economy', {p_action: 'activate', p_data: {}});
    await wallet();
  });
  onSubmit('gift-form', async values => {
    const offering = Number(values.materials) > 0;
    const result = await mutation('economy', {p_action: offering ? 'offer' : 'gift', p_data: {
      player: values.player.trim(), coins: Number(values.coins), materials: Number(values.materials)
    }});
    await wallet();
    return offering ? 'Предложение отправлено' : 'Отправлено ' + result.net + ' кредитов после сбора ' + result.fee;
  });
  onSubmit('materials-form', async values => {
    await mutation('economy', {p_action: 'materials', p_data: {materials: Number(values.materials)}});
    await wallet();
  });
  onSubmit('clan-form', values => clanMutation('create', values.name));
  get('clan-leave').onclick = () => run(() => clanMutation('leave'));
  get('chat-channel').onchange = () => run(chat);
  onSubmit('chat-form', async values => {
    await chat(values.message);
    get('chat-form').reset();
  });
  if (session) run(refresh);
})();
