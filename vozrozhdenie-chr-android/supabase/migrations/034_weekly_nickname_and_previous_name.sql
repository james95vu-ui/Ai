begin;
alter table public.game_player_profiles
 add column if not exists previous_nickname text,
 add column if not exists previous_name_expires_at timestamptz,
 add column if not exists next_name_change_at timestamptz;
create or replace function public.game_set_nickname(p_nickname text)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=(select auth.uid()); name text:=btrim(p_nickname); old_name text; allowed_at timestamptz; current_time timestamptz:=clock_timestamp();
begin
 if actor is null then raise exception 'Требуется вход';end if;
 if name is null or char_length(name) not between 2 and 30 or name ~ '[[:cntrl:]<>]' then raise exception 'Имя: 2–30 символов, без управляющих символов';end if;
 insert into public.game_player_profiles(player,nickname,updated_at)
 values(actor,name,current_time) on conflict(player) do nothing;
 select p.nickname,p.next_name_change_at into old_name,allowed_at from public.game_player_profiles p where p.player=actor for update;
 if old_name=name then return name;end if;
 if allowed_at is not null and allowed_at>current_time then raise exception 'Изменить имя можно после %',to_char(allowed_at at time zone 'UTC','YYYY-MM-DD HH24:MI UTC');end if;
 update public.game_player_profiles p
 set nickname=name,previous_nickname=old_name,previous_name_expires_at=current_time+interval '3 days',
 next_name_change_at=current_time+interval '7 days',updated_at=current_time
 where p.player=actor;
 return name;
end $$;
create or replace function public.game_my_nickname()
returns table(nickname text,old_nickname text,old_name_expires_at timestamptz,next_change_at timestamptz,can_change boolean)
language sql stable security definer set search_path='' as $$
 select p.nickname,
 case when p.previous_name_expires_at>now() then p.previous_nickname else null end,
 case when p.previous_name_expires_at>now() then p.previous_name_expires_at else null end,
 p.next_name_change_at,coalesce(p.next_name_change_at<=now(),true)
 from public.game_player_profiles p where p.player=auth.uid()
$$;
revoke all on function public.game_my_nickname() from public,anon;
grant execute on function public.game_my_nickname() to authenticated;
commit;