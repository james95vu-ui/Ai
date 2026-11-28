-- Player leaderboard based only on server-owned wallet balances.
-- Local tap counters are intentionally excluded: clients can edit localStorage.
begin;
create or replace function public.tycoon_player_ranking(p_limit integer default 50)
returns table(rank bigint, nickname text, coins integer, materials integer)
language sql stable security definer set search_path = ''
as $$
  select row_number() over (order by w.coins desc, w.materials desc, w.player) as rank,
         left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'), ''), 'Игрок ' || left(w.player::text, 8)), 32) as nickname,
         w.coins, w.materials
  from (select player, coins, materials from tycoon.wallets order by coins desc, materials desc, player limit least(greatest(coalesce(p_limit,50),1),100)) w
  join auth.users u on u.id = w.player
  where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,true)
  order by w.coins desc, w.materials desc, w.player;
$$;
revoke all on function public.tycoon_player_ranking(integer) from public, anon;
grant execute on function public.tycoon_player_ranking(integer) to authenticated;
commit;
