begin;
create table if not exists public.game_player_sanctions(
 id bigint generated always as identity primary key,
 player uuid not null references auth.users(id),
 scope text not null check(scope in ('public_chat','gameplay')),
 starts_at timestamptz not null default now(),
 ends_at timestamptz not null,
 revoked_at timestamptz,
 reason text not null,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check(ends_at>starts_at)
);
create index if not exists game_player_sanctions_lookup on public.game_player_sanctions(player,scope,ends_at) where revoked_at is null;
alter table public.game_player_sanctions enable row level security;
revoke all on public.game_player_sanctions from public,anon,authenticated;

create or replace function public.game_my_sanctions()
returns table(id bigint,scope text,ends_at timestamptz,reason text)
language sql stable security definer set search_path=''
as $$
 select s.id,s.scope,s.ends_at,s.reason from public.game_player_sanctions s
 where s.player=(select auth.uid()) and s.revoked_at is null and s.ends_at>now()
 order by s.ends_at;
$$;
revoke all on function public.game_my_sanctions() from public,anon;
grant execute on function public.game_my_sanctions() to authenticated;

create or replace function public.game_owner_sanction(
 p_player uuid,p_scope text,p_hours integer,p_reason text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare sid bigint;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 if p_player is null or not exists(select 1 from auth.users where id=p_player) then raise exception 'Игрок не найден';end if;
 if exists(select 1 from public.game_owner_roles where user_id=p_player) then raise exception 'Нельзя блокировать владельца';end if;
 if p_scope not in ('public_chat','gameplay') then raise exception 'Неверная область блокировки';end if;
 if p_hours is null or p_hours<1 or p_hours>8760 then raise exception 'Срок 1–8760 часов';end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000 then raise exception 'Причина 10–1000 символов';end if;
 insert into public.game_player_sanctions(player,scope,ends_at,reason,created_by)
 values(p_player,p_scope,now()+make_interval(hours=>p_hours),trim(p_reason),(select auth.uid()))
 returning id into sid;
 insert into public.game_admin_audit(actor,action,subject_id,note)
 values((select auth.uid()),'sanction_created',sid,'player='||p_player||'; scope='||p_scope||'; hours='||p_hours||'; reason='||trim(p_reason));
 return sid;
end;$$;
revoke all on function public.game_owner_sanction(uuid,text,integer,text) from public,anon;
grant execute on function public.game_owner_sanction(uuid,text,integer,text) to authenticated;

create or replace function public.game_owner_revoke_sanction(p_id bigint,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав';end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000 then raise exception 'Причина 10–1000 символов';end if;
 update public.game_player_sanctions set revoked_at=now() where id=p_id and revoked_at is null;
 if not found then raise exception 'Активная санкция не найдена';end if;
 insert into public.game_admin_audit(actor,action,subject_id,note)
 values((select auth.uid()),'sanction_revoked',p_id,trim(p_reason));
 return true;
end;$$;
revoke all on function public.game_owner_revoke_sanction(bigint,text) from public,anon;
grant execute on function public.game_owner_revoke_sanction(bigint,text) to authenticated;

create or replace function public.game_owner_sanctions(p_player uuid default null)
returns table(id bigint,player uuid,scope text,starts_at timestamptz,ends_at timestamptz,revoked_at timestamptz,reason text)
language sql stable security definer set search_path=''
as $$
 select s.id,s.player,s.scope,s.starts_at,s.ends_at,s.revoked_at,s.reason
 from public.game_player_sanctions s
 where public.game_is_owner() and (p_player is null or s.player=p_player)
 order by s.id desc limit 100;
$$;
revoke all on function public.game_owner_sanctions(uuid) from public,anon;
grant execute on function public.game_owner_sanctions(uuid) to authenticated;

create or replace function public.game_public_send_message(p_room_id bigint,p_body text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); room public.game_public_rooms%rowtype; mid bigint;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 select * into room from public.game_public_rooms where id=p_room_id and enabled and kind='text';
 if not found then raise exception 'Текстовая комната недоступна'; end if;
 if not exists(select 1 from public.city_members m join public.cities c on c.display_name=m.city
 where m.user_id=actor and c.id=room.city_id) then raise exception 'Это чат другого города'; end if;
 if exists(select 1 from public.game_player_sanctions s where s.player=actor and s.scope in ('public_chat','gameplay') and s.revoked_at is null and s.ends_at>now())
 then raise exception 'Отправка сообщений временно ограничена';end if;
 if exists(select 1 from public.game_public_room_mutes where room_id=p_room_id and player=actor and until_at>now())
 then raise exception 'Отправка сообщений временно ограничена'; end if;
 if p_body is null or length(trim(p_body))<1 or length(p_body)>1000 then raise exception 'Длина сообщения 1–1000'; end if;
 insert into public.game_public_messages(room_id,author,body) values(p_room_id,actor,trim(p_body)) returning id into mid;
 return mid;
end;$$;

create or replace function public.game_owner_set_setting(p_key text,p_value jsonb,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare previous jsonb;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав';end if;
 if p_key not in ('maintenance_notice','welcome_message','chat_slow_mode_seconds','events_enabled')
 then raise exception 'Настройка не разрешена';end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000 then raise exception 'Причина 10–1000 символов';end if;
 if p_key in ('maintenance_notice','welcome_message') and
 (jsonb_typeof(p_value)<>'string' or length(p_value#>>'{}')>500)
 then raise exception 'Ожидается текст до 500 символов';end if;
 if p_key='chat_slow_mode_seconds' and
 (jsonb_typeof(p_value)<>'number' or (p_value#>>'{}')::numeric not between 0 and 300)
 then raise exception 'Ожидается число 0–300';end if;
 if p_key='events_enabled' and jsonb_typeof(p_value)<>'boolean'
 then raise exception 'Ожидается true или false';end if;
 select value into previous from public.game_settings where key=p_key for update;
 insert into public.game_settings(key,value) values(p_key,p_value)
 on conflict(key) do update set value=excluded.value,updated_at=now();
 insert into public.game_admin_audit(actor,action,note)
 values((select auth.uid()),'setting_changed','key='||p_key||'; old='||coalesce(previous::text,'null')||'; new='||p_value::text||'; reason='||trim(p_reason));
 return jsonb_build_object('key',p_key,'value',p_value);
end;$$;
revoke all on function public.game_owner_set_setting(text,jsonb,text) from public,anon;
grant execute on function public.game_owner_set_setting(text,jsonb,text) to authenticated;

create or replace function public.game_public_settings()
returns jsonb language sql stable security definer set search_path=''
as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) from public.game_settings
 where key in ('maintenance_notice','welcome_message','chat_slow_mode_seconds','events_enabled');
$$;
revoke all on function public.game_public_settings() from public,anon;
grant execute on function public.game_public_settings() to authenticated;
commit;