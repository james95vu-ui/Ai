begin;
create or replace function public.city_join(p_city_id text)
returns text language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid());city_name text;existing_city text;
begin
 perform public.game_assert_gameplay_allowed();
 select display_name into city_name from public.cities where id=p_city_id;
 if city_name is null then raise exception 'Неизвестный город';end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,741));
 select city into existing_city from public.city_members where user_id=actor;
 if existing_city is not null then
  if existing_city=city_name then return existing_city;end if;
  raise exception 'Город уже выбран. Сменить его можно только после изгнания';
 end if;
 if exists(select 1 from public.city_exile_bans b where b.player=actor and b.city_id=p_city_id and b.banned_until>now())
 then raise exception 'Возвращение в этот город временно запрещено';end if;
 insert into public.city_members(user_id,city) values(actor,city_name);
 return city_name;
end;$$;
revoke all on function public.city_join(text) from public,anon;
grant execute on function public.city_join(text) to authenticated;

-- Enforce sanctions at membership and governance write boundaries.
create or replace function public.game_guard_member_changes()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 perform public.game_assert_gameplay_allowed();
 return new;
end;$$;
drop trigger if exists game_guard_member_changes on public.city_members;
create trigger game_guard_member_changes before insert or update
on public.city_members for each row execute function public.game_guard_member_changes();

create or replace function public.game_guard_governance_changes()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 perform public.game_assert_gameplay_allowed();
 return new;
end;$$;
drop trigger if exists game_guard_complaints on public.city_resident_complaints;
create trigger game_guard_complaints before insert on public.city_resident_complaints
for each row execute function public.game_guard_governance_changes();
drop trigger if exists game_guard_deputies on public.city_mayor_deputies;
create trigger game_guard_deputies before insert on public.city_mayor_deputies
for each row execute function public.game_guard_governance_changes();
commit;