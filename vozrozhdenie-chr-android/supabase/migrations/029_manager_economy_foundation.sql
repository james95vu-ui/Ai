begin;
create table if not exists public.game_player_managers(
 player uuid primary key references auth.users(id) on delete cascade,
 manager_count integer not null default 0 check(manager_count between 0 and 10),
 last_claim_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.game_player_managers enable row level security;
revoke all on public.game_player_managers from anon,authenticated;
create or replace function public.game_my_managers()
returns table(manager_count integer,hourly_coins bigint,next_cost bigint,can_claim_coins bigint,wallet_coins integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();cnt integer;last_at timestamptz;wallet integer;earned bigint;
begin
 if actor is null then raise exception 'Требуется вход';end if;
 select m.manager_count,m.last_claim_at into cnt,last_at from public.game_player_managers m where m.player=actor;
 cnt:=coalesce(cnt,0);last_at:=coalesce(last_at,clock_timestamp());
 select w.coins into wallet from tycoon.wallets w where w.player=actor;
 select coalesce(t.earned,0) into earned from tycoon.tap_scores t where t.player=actor;
 return query select cnt,(cnt*120)::bigint,
 case when cnt>=10 then null::bigint when cnt=0 then 0::bigint else (cnt*cnt*5000)::bigint end,
 (least(86400::numeric,greatest(0::numeric,extract(epoch from clock_timestamp()-last_at)))*cnt*120/3600)::bigint,
 coalesce(wallet,0);
end $$;
create or replace function public.game_hire_manager()
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();cnt integer;price bigint;earned bigint;wallet integer;
begin
 perform public.game_assert_gameplay_allowed();
 if actor is null then raise exception 'Требуется вход';end if;
 insert into public.game_player_managers(player) values(actor) on conflict do nothing;
 select m.manager_count into cnt from public.game_player_managers m where m.player=actor for update;
 if cnt>=10 then raise exception 'Достигнут предел менеджеров';end if;
 select coalesce(t.earned,0) into earned from tycoon.tap_scores t where t.player=actor;
 if earned<1000 then raise exception 'Первый менеджер доступен после 1000 онлайн-нажатий';end if;
 price:=case when cnt=0 then 0 else cnt*cnt*5000 end;
 if price>0 then
  insert into tycoon.wallets(player) values(actor) on conflict do nothing;
  select w.coins into wallet from tycoon.wallets w where w.player=actor for update;
  if wallet<price then raise exception 'Недостаточно серверных монет';end if;
  update tycoon.wallets w set coins=w.coins-price where w.player=actor;
 end if;
 update public.game_player_managers m set manager_count=cnt+1,updated_at=clock_timestamp(),last_claim_at=clock_timestamp() where m.player=actor;
 return cnt+1;
end $$;
create or replace function public.game_claim_manager_income()
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();cnt integer;last_at timestamptz;gain bigint;balance integer;
begin
 perform public.game_assert_gameplay_allowed();
 if actor is null then raise exception 'Требуется вход';end if;
 select m.manager_count,m.last_claim_at into cnt,last_at from public.game_player_managers m where m.player=actor for update;
 if not found or cnt=0 then raise exception 'Сначала найми менеджера';end if;
 gain:=floor(least(86400::numeric,greatest(0::numeric,extract(epoch from clock_timestamp()-last_at)))*cnt*120/3600);
 if gain<1 then return 0;end if;
 insert into tycoon.wallets(player) values(actor) on conflict do nothing;
 select w.coins into balance from tycoon.wallets w where w.player=actor for update;
 if balance::bigint+gain>2147483647 then raise exception 'Лимит кошелька';end if;
 update tycoon.wallets w set coins=w.coins+gain where w.player=actor;
 update public.game_player_managers m set last_claim_at=clock_timestamp(),updated_at=clock_timestamp() where m.player=actor;
 return gain::integer;
end $$;
revoke all on function public.game_my_managers(),public.game_hire_manager(),public.game_claim_manager_income() from public,anon;
grant execute on function public.game_my_managers(),public.game_hire_manager(),public.game_claim_manager_income() to authenticated;
commit;