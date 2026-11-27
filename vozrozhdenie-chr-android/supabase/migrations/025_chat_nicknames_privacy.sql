begin;
create table if not exists public.game_player_profiles(
 player uuid primary key references auth.users(id) on delete cascade,
 nickname text not null,
 updated_at timestamptz not null default now(),
 constraint game_nickname_length check(char_length(nickname) between 2 and 30)
);
alter table public.game_player_profiles enable row level security;
revoke all on public.game_player_profiles from public,anon,authenticated;
create or replace function public.game_set_nickname(p_nickname text)
returns text language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); name text:=btrim(p_nickname);
begin
 if actor is null then raise exception 'Требуется вход';end if;
 if name is null or char_length(name) not between 2 and 30
 or name ~ '[[:cntrl:]<>]' then raise exception 'Имя: 2–30 символов, без управляющих символов';end if;
 insert into public.game_player_profiles(player,nickname)
 values(actor,name) on conflict(player) do update set nickname=excluded.nickname,updated_at=now();
 return name;
end;$$;
revoke all on function public.game_set_nickname(text) from public,anon;
grant execute on function public.game_set_nickname(text) to authenticated;

create or replace function public.game_chat_messages(p_room_id bigint,p_limit integer default 50)
returns table(message_id bigint,author uuid,author_name text,body text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); city text;
begin
 if actor is null then raise exception 'Требуется вход';end if;
 select r.city_id into city from public.game_public_rooms r where r.id=p_room_id and r.enabled and r.kind='text';
 if city is null then raise exception 'Комната недоступна';end if;
 if not exists(select 1 from public.city_members m join public.cities c on c.display_name=m.city
 where m.user_id=actor and c.id=city) and not public.game_is_owner()
 then raise exception 'Доступ к чату другого города запрещён';end if;
 return query select msg.id,msg.author,
 coalesce(profile.nickname,'Игрок '||left(msg.author::text,8)),msg.body,msg.created_at
 from public.game_public_messages msg
 left join public.game_player_profiles profile on profile.player=msg.author
 where msg.room_id=p_room_id and not msg.hidden
 order by msg.created_at desc limit least(greatest(coalesce(p_limit,50),1),100);
end;$$;
revoke all on function public.game_chat_messages(bigint,integer) from public,anon;
grant execute on function public.game_chat_messages(bigint,integer) to authenticated;

-- Remove unrestricted direct reads; chat access is now checked in the RPC.
revoke select on public.game_public_messages from authenticated;
commit;