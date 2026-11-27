begin;
create or replace function public.game_assert_gameplay_allowed()
returns void language plpgsql stable security definer set search_path=''
as $$
begin
 if (select auth.uid()) is null then raise exception 'Требуется вход'; end if;
 if exists(select 1 from public.game_player_sanctions s
 where s.player=(select auth.uid()) and s.scope='gameplay'
 and s.revoked_at is null and s.ends_at>now())
 then raise exception 'Игровой доступ временно ограничен. Причину и срок смотри в разделе санкций.';end if;
end;$$;
revoke all on function public.game_assert_gameplay_allowed() from public,anon;
grant execute on function public.game_assert_gameplay_allowed() to authenticated;

create or replace function public.tycoon_record_tap()
returns table(taps bigint,earned bigint)
language plpgsql security definer set search_path=''
as $$
declare actor uuid:=tycoon.actor();now_at timestamptz:=clock_timestamp();
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
 returning t.taps,t.earned into taps,earned;
 if not found then raise exception 'Слишком частые нажатия или дневной лимит';end if;
 return next;
end;$$;
revoke all on function public.tycoon_record_tap() from public,anon;
grant execute on function public.tycoon_record_tap() to authenticated;

-- Trigger applies gameplay sanctions to all city project allocations, including
-- older client versions, without modifying accounting logic in existing RPCs.
create or replace function public.game_guard_project_contributions()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 perform public.game_assert_gameplay_allowed();
 return new;
end;$$;
drop trigger if exists game_guard_project_contributions on public.city_project_contributions;
create trigger game_guard_project_contributions before insert or update
on public.city_project_contributions for each row
execute function public.game_guard_project_contributions();
drop trigger if exists game_guard_upgrade_contributions on public.city_building_upgrade_contributions;
create trigger game_guard_upgrade_contributions before insert or update
on public.city_building_upgrade_contributions for each row
execute function public.game_guard_project_contributions();

-- Settings are now enforced server-side for public chat.
create or replace function public.game_public_send_message(p_room_id bigint,p_body text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); room public.game_public_rooms%rowtype;
 mid bigint; slow_seconds integer:=0; last_at timestamptz;
begin
 perform public.game_assert_gameplay_allowed();
 select * into room from public.game_public_rooms where id=p_room_id and enabled and kind='text';
 if not found then raise exception 'Текстовая комната недоступна';end if;
 if not exists(select 1 from public.city_members m join public.cities c on c.display_name=m.city
 where m.user_id=actor and c.id=room.city_id) then raise exception 'Это чат другого города';end if;
 if exists(select 1 from public.game_player_sanctions s where s.player=actor and s.scope='public_chat'
 and s.revoked_at is null and s.ends_at>now()) then raise exception 'Отправка сообщений временно ограничена';end if;
 if exists(select 1 from public.game_public_room_mutes where room_id=p_room_id and player=actor and until_at>now())
 then raise exception 'Отправка сообщений временно ограничена';end if;
 if p_body is null or length(trim(p_body))<1 or length(p_body)>1000 then raise exception 'Длина сообщения 1–1000';end if;
 select least(greatest((value#>>'{}')::integer,0),300) into slow_seconds
 from public.game_settings where key='chat_slow_mode_seconds';
 slow_seconds:=coalesce(slow_seconds,0);
 if slow_seconds>0 then
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_room_id::text,912));
 select max(created_at) into last_at from public.game_public_messages
 where room_id=p_room_id and author=actor;
 if last_at>clock_timestamp()-make_interval(secs=>slow_seconds) then
 raise exception 'Режим медленного чата: подожди перед следующим сообщением';end if;
 end if;
 insert into public.game_public_messages(room_id,author,body) values(p_room_id,actor,trim(p_body))
 returning id into mid;
 return mid;
end;$$;
commit;