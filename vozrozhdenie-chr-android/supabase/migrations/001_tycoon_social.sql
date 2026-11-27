begin;

create schema tycoon;
revoke all on schema tycoon from public, anon, authenticated;

create table tycoon.wallets (
  player uuid primary key references auth.users(id),
  coins integer not null default 0 check (coins >= 0),
  materials integer not null default 0 check (materials >= 0)
);

-- The reserve is allocated once. Mandatory sinks permanently retire credits.
create table tycoon.reserve (
  singleton boolean primary key default true check (singleton),
  available integer not null check (available >= 0),
  burned bigint not null default 0 check (burned >= 0)
);
insert into tycoon.reserve (available) values (5000000);

create table tycoon.daily (
  player uuid references tycoon.wallets(player),
  day date,
  debited integer not null default 0 check (debited between 0 and 2000),
  received integer not null default 0 check (received between 0 and 3000),
  materials_sent integer not null default 0 check (materials_sent between 0 and 100),
  materials_received integer not null default 0 check (materials_received between 0 and 100),
  primary key (player, day)
);
create table tycoon.receipts (
  player uuid references tycoon.wallets(player),
  request uuid,
  payload jsonb not null,
  response jsonb not null,
  primary key (player, request)
);
create table tycoon.offers (
  id bigint generated always as identity primary key,
  buyer uuid not null references tycoon.wallets(player),
  seller uuid not null references tycoon.wallets(player),
  coins integer not null check (coins between 20 and 500),
  materials integer not null check (materials between 1 and 20),
  expires timestamptz not null default (now() + interval '24 hours'),
  state text not null default 'open' check (state in ('open', 'accepted', 'cancelled')),
  check (buyer <> seller)
);
create index offers_buyer on tycoon.offers(buyer, id desc);
create index offers_seller on tycoon.offers(seller, id desc);

create table tycoon.clans (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 3 and 30),
  created_at timestamptz not null default now()
);
create unique index clans_name on tycoon.clans(lower(name));
create table tycoon.members (
  player uuid primary key references auth.users(id),
  clan bigint not null references tycoon.clans(id),
  joined timestamptz not null default now(),
  leader boolean not null default false
);
create index members_clan on tycoon.members(clan);
create table tycoon.messages (
  id bigint generated always as identity primary key,
  clan bigint references tycoon.clans(id),
  author uuid not null references auth.users(id),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index messages_clan on tycoon.messages(clan, id desc);
create index messages_author on tycoon.messages(author, created_at desc);

create table tycoon.moderators (player uuid primary key references auth.users(id));
create table tycoon.mutes (
  player uuid primary key references auth.users(id),
  until_at timestamptz not null
);
create table tycoon.blocked_terms (term text primary key check (char_length(term) between 2 and 60));
create table tycoon.reports (
  message bigint references tycoon.messages(id),
  reporter uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  primary key (message, reporter)
);
create index reports_reporter on tycoon.reports(reporter, created_at desc);

create function tycoon.actor() returns uuid
language plpgsql stable set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (
    select 1 from auth.users u
    where u.id = actor and u.email_confirmed_at is not null and not coalesce(u.is_anonymous, true)
  ) then
    raise exception 'Подтверди вход по электронной почте';
  end if;
  return actor;
end;
$$;

create function tycoon.tax_basis(amount integer) returns integer
language sql immutable strict set search_path = ''
as $$
  select least(amount, 200) * 5
       + greatest(0, least(amount - 200, 500)) * 12
       + greatest(0, amount - 700) * 25
$$;

create function tycoon.transfer(sender uuid, recipient uuid, quantity integer, material_count integer)
returns jsonb language plpgsql set search_path = ''
as $$
declare
  utc_day date := (now() at time zone 'UTC')::date;
  sender_daily tycoon.daily;
  recipient_daily tycoon.daily;
  fee integer;
begin
  if sender = recipient or quantity not between 20 and 500 or material_count not between 0 and 20 then
    raise exception 'Неверная сумма';
  end if;
  insert into tycoon.daily (player, day) values (sender, utc_day), (recipient, utc_day) on conflict do nothing;
  select * into strict sender_daily from tycoon.daily where player = sender and day = utc_day;
  select * into strict recipient_daily from tycoon.daily where player = recipient and day = utc_day;
  if sender_daily.debited + quantity > 2000 or recipient_daily.received + quantity > 3000
    or sender_daily.materials_received + material_count > 100 or recipient_daily.materials_sent + material_count > 100 then
    raise exception 'Достигнут суточный лимит';
  end if;
  fee := (tycoon.tax_basis(sender_daily.debited + quantity) + 99) / 100
       - (tycoon.tax_basis(sender_daily.debited) + 99) / 100;

  update tycoon.wallets set coins = coins - quantity, materials = tycoon.wallets.materials + material_count
    where player = sender and coins >= quantity;
  if not found then raise exception 'Недостаточно кредитов'; end if;
  update tycoon.wallets set coins = coins + quantity - fee, materials = tycoon.wallets.materials - material_count
    where player = recipient and tycoon.wallets.materials >= material_count;
  if not found then raise exception 'Недостаточно материалов'; end if;
  update tycoon.daily set debited = debited + quantity, materials_received = materials_received + material_count
    where player = sender and day = utc_day;
  update tycoon.daily set received = tycoon.daily.received + quantity, materials_sent = materials_sent + material_count
    where player = recipient and day = utc_day;
  update tycoon.reserve set burned = burned + fee;
  return jsonb_build_object('fee', fee, 'net', quantity - fee);
end;
$$;

create function public.tycoon_economy(p_action text, p_data jsonb, p_request uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := tycoon.actor();
  other uuid;
  offer tycoon.offers;
  result jsonb;
  old_receipt tycoon.receipts;
  quantity integer;
  units integer;
  cost integer;
  payload jsonb := jsonb_build_object('action', p_action, 'data', p_data);
begin
  -- A common row lock serializes balance changes, caps and reserve accounting.
  perform 1 from tycoon.reserve for update;
  if p_request is null or p_data is null or p_action is null then raise exception 'Неверный запрос'; end if;
  select * into old_receipt from tycoon.receipts where player = actor and request = p_request;
  if found then
    if old_receipt.payload <> payload then raise exception 'Идентификатор запроса уже использован'; end if;
    return old_receipt.response;
  end if;

  if p_action = 'activate' then
    insert into tycoon.wallets(player) values (actor) on conflict do nothing;
    if found then
      update tycoon.reserve set available = available - 500 where available >= 500;
      if not found then raise exception 'Стартовый резерв исчерпан'; end if;
      update tycoon.wallets set coins = 500 where player = actor;
    end if;
    result := '{}'::jsonb;
  else
    if not exists (select 1 from tycoon.wallets where player = actor) then raise exception 'Активируй онлайн-кошелёк'; end if;
    case p_action
    when 'gift' then
      other := (p_data->>'player')::uuid;
      quantity := (p_data->>'coins')::integer;
      if quantity is null or other is null or not exists (select 1 from tycoon.wallets where player = other) then
        raise exception 'Проверь сумму и идентификатор игрока';
      end if;
      result := tycoon.transfer(actor, other, quantity, 0);
    when 'materials' then
      units := (p_data->>'materials')::integer;
      if units is null or units not between 1 and 20 then raise exception 'Можно купить от 1 до 20 материалов'; end if;
      cost := units * 12;
      update tycoon.wallets set coins = coins - cost, materials = materials + units
        where player = actor and coins >= cost;
      if not found then raise exception 'Недостаточно кредитов'; end if;
      update tycoon.reserve set burned = burned + cost;
      result := jsonb_build_object('spent', cost);
    when 'offer' then
      other := (p_data->>'player')::uuid;
      quantity := (p_data->>'coins')::integer;
      units := (p_data->>'materials')::integer;
      if other is null or other = actor or not exists (select 1 from tycoon.wallets where player = other)
        or quantity is null or quantity not between 20 and 500 or units is null or units not between 1 and 20 then
        raise exception 'Проверь игрока, кредиты и материалы';
      end if;
      if not exists (select 1 from tycoon.wallets where player = actor and coins >= quantity) then
        raise exception 'Недостаточно кредитов';
      end if;
      if (select count(*) from tycoon.offers where buyer = actor and state = 'open' and expires > now()) >= 5 then
        raise exception 'Не больше пяти открытых предложений';
      end if;
      insert into tycoon.offers(buyer, seller, coins, materials)
        values (actor, other, quantity, units) returning * into offer;
      result := jsonb_build_object('offer', offer.id);
    when 'accept', 'cancel' then
      select * into offer from tycoon.offers where id = (p_data->>'offer')::bigint;
      if not found or offer.state <> 'open' or offer.expires <= now() then raise exception 'Предложение закрыто'; end if;
      if p_action = 'accept' then
        if offer.seller <> actor then raise exception 'Это предложение для другого игрока'; end if;
        result := tycoon.transfer(offer.buyer, offer.seller, offer.coins, offer.materials);
        update tycoon.offers set state = 'accepted' where id = offer.id;
      else
        if offer.buyer <> actor and offer.seller <> actor then raise exception 'Это чужое предложение'; end if;
        update tycoon.offers set state = 'cancelled' where id = offer.id;
        result := '{}'::jsonb;
      end if;
    else
      raise exception 'Неизвестная операция';
    end case;
  end if;

  insert into tycoon.receipts values (actor, p_request, payload, result);
  return result;
end;
$$;

create function public.tycoon_wallet() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := tycoon.actor();
  wallet tycoon.wallets;
  gifts_used integer;
begin
  select * into wallet from tycoon.wallets where player = actor;
  select debited into gifts_used from tycoon.daily where player = actor and day = (now() at time zone 'UTC')::date;
  return jsonb_build_object('player', actor, 'active', wallet.player is not null, 'coins', wallet.coins,
    'materials', wallet.materials, 'remaining', 2000 - coalesce(gifts_used, 0), 'offers',
    (select coalesce(jsonb_agg(to_jsonb(o) order by o.id desc), '[]'::jsonb) from (
      select id, buyer, seller, coins, materials from tycoon.offers
      where (buyer = actor or seller = actor) and state = 'open' and expires > now()
      order by id desc limit 30
    ) o));
end;
$$;

create function public.tycoon_clan(p_action text, p_name text, p_clan bigint, p_request uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := tycoon.actor();
  current_clan tycoon.members;
  target bigint;
  payload jsonb := jsonb_build_object('clan', p_action, 'name', p_name, 'id', p_clan);
  receipt tycoon.receipts;
  result jsonb;
begin
  perform 1 from tycoon.reserve for update;
  if p_request is null then raise exception 'Неверный запрос'; end if;
  select * into receipt from tycoon.receipts where player = actor and request = p_request;
  if found then
    if receipt.payload <> payload then raise exception 'Идентификатор запроса уже использован'; end if;
    return receipt.response;
  end if;
  if not exists (select 1 from tycoon.wallets where player = actor) then raise exception 'Активируй онлайн-кошелёк'; end if;
  select * into current_clan from tycoon.members where player = actor;
  if p_action = 'leave' then
    delete from tycoon.members where player = actor;
    if current_clan.leader then
      update tycoon.members set leader = true where player = (
        select player from tycoon.members where clan = current_clan.clan order by joined, player limit 1
      );
    end if;
  elsif current_clan.clan is not null then
    raise exception 'Сначала выйди из своего клана';
  elsif p_action = 'create' then
    if p_name is null or btrim(p_name) !~ '^[[:alnum:]][[:alnum:] _-]{2,29}$'
      or exists (select 1 from tycoon.blocked_terms where strpos(lower(p_name), lower(term)) > 0) then
      raise exception 'Недопустимое название клана';
    end if;
    update tycoon.wallets set coins = coins - 150 where player = actor and coins >= 150;
    if not found then raise exception 'Для создания клана нужно 150 кредитов'; end if;
    update tycoon.reserve set burned = burned + 150;
    insert into tycoon.clans(name) values (btrim(p_name)) returning id into target;
    insert into tycoon.members(player, clan, leader) values (actor, target, true);
  elsif p_action = 'join' then
    if not exists (select 1 from tycoon.clans where id = p_clan)
       or (select count(*) from tycoon.members where clan = p_clan) >= 30 then
      raise exception 'Клан недоступен';
    end if;
    target := p_clan;
    insert into tycoon.members(player, clan, leader) values (actor, target,
      not exists (select 1 from tycoon.members where clan = target));
  else
    raise exception 'Неизвестная операция';
  end if;
  result := jsonb_build_object('clan', target);
  insert into tycoon.receipts values (actor, p_request, payload, result);
  return result;
end;
$$;

create function public.tycoon_community() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := tycoon.actor();
begin
  return jsonb_build_object('clan', (select clan from tycoon.members where player = actor),
    'moderator', exists(select 1 from tycoon.moderators where player = actor),
    'clans', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from (
      select k.id, k.name, count(m.player) as members
      from tycoon.clans k left join tycoon.members m on m.clan = k.id
      group by k.id having count(m.player) > 0 order by k.id desc limit 50
    ) c));
end;
$$;

create function public.tycoon_chat(p_clan boolean, p_message text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := tycoon.actor();
  clan_id bigint;
  clean text;
begin
  if p_clan then
    select clan into clan_id from tycoon.members where player = actor;
    if clan_id is null then raise exception 'Сначала вступи в клан'; end if;
  end if;
  if p_message is not null then
    perform pg_advisory_xact_lock(hashtextextended(actor::text, 31));
    if exists (select 1 from tycoon.mutes where player = actor and until_at > now()) then
      raise exception 'Отправка временно отключена модератором';
    end if;
    if (select count(*) from tycoon.messages where author = actor and created_at > now() - interval '1 minute') >= 5 then
      raise exception 'Слишком много сообщений';
    end if;
    clean := btrim(regexp_replace(p_message, '[[:cntrl:]]', ' ', 'g'));
    if char_length(p_message) > 300 or char_length(clean) < 1 or
      clean ~* '(https?://|www[.]|t[.]me/|discord[.]gg/|[[:alnum:]_.+-]+@[[:alnum:].-]+[.][[:alpha:]]{2,})'
      or exists (select 1 from tycoon.blocked_terms where strpos(lower(clean), lower(term)) > 0) then
      raise exception 'Сообщение не прошло фильтр';
    end if;
    insert into tycoon.messages(clan, author, body) values (clan_id, actor, clean);
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb) from (
      select id, left(author::text, 8) as player, body, created_at from tycoon.messages
      where clan is not distinct from clan_id and not hidden order by id desc limit 40
  ) m);
end;
$$;

create function public.tycoon_report(p_message bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := tycoon.actor();
begin
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 31));
  if (select count(*) from tycoon.reports where reporter = actor and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Слишком много жалоб';
  end if;
  if not exists (
    select 1 from tycoon.messages m where m.id = p_message and not m.hidden and m.author <> actor and
    (m.clan is null or exists (select 1 from tycoon.members where player = actor and clan = m.clan))
  ) then raise exception 'Сообщение недоступно'; end if;
  insert into tycoon.reports(message, reporter) values (p_message, actor) on conflict do nothing;
end;
$$;

create function public.tycoon_moderate(p_message bigint default null, p_action text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  actor uuid := tycoon.actor();
  target uuid;
begin
  if not exists (select 1 from tycoon.moderators where player = actor) then raise exception 'Требуется роль модератора'; end if;
  if p_action is not null then
    select author into target from tycoon.messages where id = p_message for update;
    if not exists (select 1 from tycoon.reports where message = p_message and not resolved) then
      raise exception 'Жалоба уже обработана';
    end if;
    if p_action in ('hide', 'mute') then
      update tycoon.messages set hidden = true where id = p_message;
    elsif p_action <> 'dismiss' then
      raise exception 'Неизвестное действие';
    end if;
    if p_action = 'mute' then
      insert into tycoon.mutes(player, until_at) values (target, now() + interval '24 hours')
      on conflict (player) do update set until_at = excluded.until_at;
    end if;
    update tycoon.reports set resolved = true where message = p_message;
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) from (
    select m.id, m.body, count(*) as reports from tycoon.reports q
    join tycoon.messages m on m.id = q.message where not q.resolved
    group by m.id order by m.id limit 30
  ) r);
end;
$$;

revoke all on function public.tycoon_economy(text,jsonb,uuid), public.tycoon_wallet(),
  public.tycoon_clan(text,text,bigint,uuid), public.tycoon_community(), public.tycoon_chat(boolean,text),
  public.tycoon_report(bigint), public.tycoon_moderate(bigint,text) from public, anon;
grant execute on function public.tycoon_economy(text,jsonb,uuid), public.tycoon_wallet(),
  public.tycoon_clan(text,text,bigint,uuid), public.tycoon_community(), public.tycoon_chat(boolean,text),
  public.tycoon_report(bigint), public.tycoon_moderate(bigint,text) to authenticated;

commit;
