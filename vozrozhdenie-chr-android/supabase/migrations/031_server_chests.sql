begin;
create table if not exists public.game_player_chests(
 player uuid primary key references auth.users(id) on delete cascade,
 next_open_at timestamptz not null default '-infinity'::timestamptz,
 total_opened integer not null default 0
);
alter table public.game_player_chests enable row level security;
revoke all on public.game_player_chests from public,anon,authenticated;
create or replace function public.game_chest_status()
returns table(remaining_seconds integer,total_opened integer,wallet_coins integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=tycoon.actor();
begin
 return query select greatest(0,ceil(extract(epoch from c.next_open_at-clock_timestamp())))::integer,
 c.total_opened,coalesce(w.coins,0)
 from (select actor as player) a
 left join public.game_player_chests c on c.player=a.player
 left join tycoon.wallets w on w.player=a.player;
end $$;
create or replace function public.game_open_chest()
returns table(reward_coins integer,remaining_seconds integer,wallet_coins integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=tycoon.actor();now_at timestamptz:=clock_timestamp();next_at timestamptz;prize integer;balance integer;
begin
 perform public.game_assert_gameplay_allowed();
 insert into public.game_player_chests(player) values(actor) on conflict do nothing;
 select c.next_open_at into next_at from public.game_player_chests c where c.player=actor for update;
 if next_at>now_at then raise exception 'Сундук ещё закрыт';end if;
 prize:=case when random()<0.65 then 250 when random()<0.85 then 400 else 800 end;
 insert into tycoon.wallets(player) values(actor) on conflict do nothing;
 select w.coins into balance from tycoon.wallets w where w.player=actor for update;
 if balance::bigint+prize>2147483647 then raise exception 'Лимит кошелька';end if;
 update tycoon.wallets w set coins=w.coins+prize where w.player=actor;
 update public.game_player_chests c set next_open_at=now_at+interval '4 hours',total_opened=c.total_opened+1 where c.player=actor;
 reward_coins:=prize;remaining_seconds:=14400;wallet_coins:=balance+prize;return next;
end $$;
revoke all on function public.game_chest_status(),public.game_open_chest() from public,anon;
grant execute on function public.game_chest_status(),public.game_open_chest() to authenticated;
commit;