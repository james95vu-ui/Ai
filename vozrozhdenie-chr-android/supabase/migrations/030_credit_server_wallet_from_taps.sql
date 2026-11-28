begin;
-- Accepted online taps mint exactly one server coin; rejected taps mint none.
create or replace function public.tycoon_record_tap()
returns table(taps bigint,earned bigint)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=tycoon.actor();now_at timestamptz:=clock_timestamp();new_taps bigint;new_earned bigint;
begin
 perform public.game_assert_gameplay_allowed();
 insert into tycoon.tap_scores(player) values(actor) on conflict do nothing;
 update tycoon.tap_scores t set
 taps=t.taps+1,earned=t.earned+1,last_tap=now_at,
 day=(now_at at time zone 'utc')::date,
 day_taps=case when t.day=(now_at at time zone 'utc')::date then t.day_taps+1 else 1 end
 where t.player=actor
 and (t.last_tap is null or t.last_tap<=now_at-interval '200 milliseconds')
 and (case when t.day=(now_at at time zone 'utc')::date then t.day_taps else 0 end)<10000
 returning t.taps,t.earned into new_taps,new_earned;
 if not found then raise exception 'Слишком частые нажатия или дневной лимит';end if;
 insert into tycoon.wallets(player,coins,materials) values(actor,1,0)
 on conflict(player) do update set coins=tycoon.wallets.coins+1
 where tycoon.wallets.coins<2147483647;
 if not found then raise exception 'Достигнут лимит серверного кошелька';end if;
 taps:=new_taps;earned:=new_earned;return next;
end $$;
revoke all on function public.tycoon_record_tap() from public,anon;
grant execute on function public.tycoon_record_tap() to authenticated;
commit;