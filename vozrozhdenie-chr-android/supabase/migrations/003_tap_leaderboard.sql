-- Server-authoritative tap ranking. This is a separate competitive score,
-- not a copy of the editable local game balance.
begin;
create table tycoon.tap_scores (
 player uuid primary key references auth.users(id) on delete cascade,
 taps bigint not null default 0 check(taps >= 0),
 earned bigint not null default 0 check(earned >= 0),
 last_tap timestamptz,
 day date not null default current_date,
 day_taps integer not null default 0 check(day_taps >= 0)
);
create function public.tycoon_record_tap()
returns table(taps bigint, earned bigint)
language plpgsql security definer set search_path = ''
as $$
declare actor uuid := tycoon.actor(); now_at timestamptz := clock_timestamp();
begin
 insert into tycoon.tap_scores(player) values(actor) on conflict do nothing;
 update tycoon.tap_scores t set
   taps=t.taps+1,
   earned=t.earned+1,
   last_tap=now_at,
   day=(now_at at time zone 'utc')::date,
   day_taps=case when t.day=(now_at at time zone 'utc')::date then t.day_taps+1 else 1 end
 where t.player=actor
   and (t.last_tap is null or t.last_tap <= now_at-interval '200 milliseconds')
   and (case when t.day=(now_at at time zone 'utc')::date then t.day_taps else 0 end) < 10000
 returning t.taps,t.earned into taps,earned;
 if not found then raise exception 'Слишком частые нажатия или дневной лимит'; end if;
 return next;
end;
$$;
create function public.tycoon_tap_ranking(p_limit integer default 50)
returns table(rank bigint,nickname text,taps bigint,earned bigint)
language sql stable security definer set search_path = ''
as $$
 select row_number() over(order by s.earned desc,s.taps desc,s.player) rank,
 left(coalesce(nullif(trim(u.raw_user_meta_data->>'display_name'),''),'Игрок '||left(s.player::text,8)),32) nickname,
 s.taps,s.earned
 from (select player,taps,earned from tycoon.tap_scores order by earned desc,taps desc,player limit least(greatest(coalesce(p_limit,50),1),100)) s
 join auth.users u on u.id=s.player
 where u.email_confirmed_at is not null and not coalesce(u.is_anonymous,true)
 order by s.earned desc,s.taps desc,s.player;
$$;
revoke all on function public.tycoon_record_tap(),public.tycoon_tap_ranking(integer) from public,anon;
grant execute on function public.tycoon_record_tap(),public.tycoon_tap_ranking(integer) to authenticated;
commit;
