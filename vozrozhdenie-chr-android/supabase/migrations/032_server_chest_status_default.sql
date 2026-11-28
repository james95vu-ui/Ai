create or replace function public.game_chest_status()
returns table(remaining_seconds integer,total_opened integer,wallet_coins integer)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=tycoon.actor();
begin
 return query select coalesce(greatest(0,ceil(extract(epoch from c.next_open_at-clock_timestamp())))::integer,0),
 coalesce(c.total_opened,0),coalesce(w.coins,0)
 from (select actor as player) a
 left join public.game_player_chests c on c.player=a.player
 left join tycoon.wallets w on w.player=a.player;
end $$;