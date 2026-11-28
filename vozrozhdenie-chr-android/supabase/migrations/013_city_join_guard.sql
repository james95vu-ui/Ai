-- Authoritative city enrollment, enforcing exile bans and one-city membership.
begin;
create or replace function public.city_join(p_city_id text)
returns text language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); city_name text; existing_city text;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 select display_name into city_name from public.cities where id=p_city_id;
 if city_name is null then raise exception 'Неизвестный город'; end if;
 -- Serialize simultaneous enrollment requests for the same player.
 perform pg_advisory_xact_lock(hashtextextended(actor::text,741));
 select city into existing_city from public.city_members where user_id=actor;
 if existing_city is not null then
  if existing_city=city_name then return existing_city; end if;
  raise exception 'Город уже выбран. Сменить его можно только после изгнания';
 end if;
 if exists(select 1 from public.city_exile_bans b
 where b.player=actor and b.city_id=p_city_id and b.banned_until>now()) then
  raise exception 'Возвращение в этот город временно запрещено';
 end if;
 insert into public.city_members(user_id,city) values(actor,city_name);
 return city_name;
end;
$$;
revoke all on function public.city_join(text) from public,anon;
grant execute on function public.city_join(text) to authenticated;
-- Clients cannot bypass server validation with direct table writes.
revoke insert,update,delete on public.city_members from anon,authenticated;
commit;
