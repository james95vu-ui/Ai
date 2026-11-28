-- Close legacy RPC bypass: previously join_city could overwrite any membership.
begin;
create or replace function public.join_city(p_city text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare target_id text;
begin
 if (select auth.uid()) is null then raise exception 'Требуется вход'; end if;
 select id into target_id from public.cities where display_name=p_city;
 if target_id is null then raise exception 'Город отсутствует в новом списке'; end if;
 perform public.city_join(target_id);
 return true;
end;
$$;
revoke all on function public.join_city(text) from public,anon;
grant execute on function public.join_city(text) to authenticated;
commit;
