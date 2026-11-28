create or replace function public.game_hire_manager()
returns integer language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();cnt integer;price bigint;earned bigint;wallet integer;
begin
 perform public.game_assert_gameplay_allowed();
 if actor is null then raise exception 'Требуется вход';end if;
 insert into public.game_player_managers(player) values(actor) on conflict do nothing;
 select m.manager_count into cnt from public.game_player_managers m where m.player=actor for update;
 if cnt>=10 then raise exception 'Достигнут предел менеджеров';end if;
 select coalesce((select t.earned from tycoon.tap_scores t where t.player=actor),0) into earned;
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