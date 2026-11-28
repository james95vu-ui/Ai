begin;
create or replace function public.game_owner_find_player(p_query text)
returns table(player_id uuid,email text,city text,coins integer,materials integer,taps bigint)
language sql stable security definer set search_path=''
as $$
 select u.id,u.email::text,m.city,w.coins,w.materials,t.taps
 from auth.users u
 left join public.city_members m on m.user_id=u.id
 left join tycoon.wallets w on w.player=u.id
 left join tycoon.tap_scores t on t.player=u.id
 where public.game_is_owner() and length(trim(p_query))>=3
 and (u.id::text=p_query or u.email ilike '%'||replace(replace(replace(p_query,'!','!!'),'%','!%'),'_','!_')||'%' escape '!')
 order by u.created_at desc limit 20;
$$;
commit;