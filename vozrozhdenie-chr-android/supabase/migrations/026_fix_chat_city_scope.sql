begin;
create or replace function public.game_chat_messages(p_room_id bigint,p_limit integer default 50)
returns table(message_id bigint,author uuid,author_name text,body text,created_at timestamptz)
language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); target_city_id text;
begin
 if actor is null then raise exception 'Требуется вход';end if;
 select r.city_id into target_city_id from public.game_public_rooms r where r.id=p_room_id and r.enabled and r.kind='text';
 if target_city_id is null then raise exception 'Комната недоступна';end if;
 if not exists(select 1 from public.city_members m join public.cities c on c.display_name=m.city
 where m.user_id=actor and c.id=target_city_id) and not public.game_is_owner()
 then raise exception 'Доступ к чату другого города запрещён';end if;
 return query select msg.id,msg.author,
 coalesce(profile.nickname,'Игрок '||left(msg.author::text,8)),msg.body,msg.created_at
 from public.game_public_messages msg
 left join public.game_player_profiles profile on profile.player=msg.author
 where msg.room_id=p_room_id and not msg.hidden
 order by msg.created_at desc limit least(greatest(coalesce(p_limit,50),1),100);
end;$$;
commit;