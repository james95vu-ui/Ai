-- Authenticated read-only view of the current player's city and personal contribution.
begin;
create or replace function public.city_my_progress()
returns table(city_id text,city_name text,city_level integer,
 total_contribution bigint,previous_threshold bigint,next_threshold bigint,
 personal_contribution bigint)
language sql stable security definer set search_path = ''
as $$
 select c.id,c.display_name,
 (select max(l.level) from public.city_levels l where l.required_contribution<=c.total_contribution),
 c.total_contribution,
 (select max(l.required_contribution) from public.city_levels l where l.required_contribution<=c.total_contribution),
 (select min(l.required_contribution) from public.city_levels l where l.required_contribution>c.total_contribution),
 coalesce((select sum(cc.earned) from public.city_contributions cc where cc.player=(select auth.uid()) and cc.city_id=c.id),0)
 from public.city_members m
 join public.cities c on c.display_name=m.city
 where m.user_id=(select auth.uid());
$$;
revoke all on function public.city_my_progress() from public,anon;
grant execute on function public.city_my_progress() to authenticated;
commit;
