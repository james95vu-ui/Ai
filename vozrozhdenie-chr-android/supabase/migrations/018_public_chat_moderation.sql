begin;
create table if not exists public.game_public_rooms(
 id bigint generated always as identity primary key,
 city_id text references public.cities(id),
 project_id bigint references public.city_projects(id),
 title text not null check(length(title) between 3 and 100),
 kind text not null check(kind in ('text','voice')),
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 unique(project_id,kind)
);
create table if not exists public.game_public_messages(
 id bigint generated always as identity primary key,
 room_id bigint not null references public.game_public_rooms(id),
 author uuid not null references auth.users(id),
 body text not null check(length(body) between 1 and 1000),
 hidden boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.game_public_room_reports(
 id bigint generated always as identity primary key,
 message_id bigint not null references public.game_public_messages(id),
 reporter uuid not null references auth.users(id),
 reason text not null check(length(reason) between 10 and 1000),
 created_at timestamptz not null default now(),
 unique(message_id,reporter)
);
create table if not exists public.game_public_room_mutes(
 room_id bigint not null references public.game_public_rooms(id),
 player uuid not null references auth.users(id),
 until_at timestamptz not null,
 primary key(room_id,player)
);
alter table public.game_public_rooms enable row level security;
alter table public.game_public_messages enable row level security;
alter table public.game_public_room_reports enable row level security;
alter table public.game_public_room_mutes enable row level security;
revoke all on public.game_public_rooms,public.game_public_messages,public.game_public_room_reports,public.game_public_room_mutes from public,anon,authenticated;
grant select on public.game_public_rooms,public.game_public_messages to authenticated;
create policy "read enabled rooms" on public.game_public_rooms for select to authenticated using(enabled);
create policy "read visible messages" on public.game_public_messages for select to authenticated using(not hidden and exists(select 1 from public.game_public_rooms r where r.id=room_id and r.enabled));
insert into public.game_public_rooms(city_id,title,kind)
select id,display_name||' · Общий чат','text' from public.cities c
where not exists(select 1 from public.game_public_rooms r where r.city_id=c.id and r.project_id is null and r.kind='text');
insert into public.game_public_rooms(city_id,title,kind)
select id,display_name||' · Голосовая комната','voice' from public.cities c
where not exists(select 1 from public.game_public_rooms r where r.city_id=c.id and r.project_id is null and r.kind='voice');

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
 if exists(select 1 from public.game_public_room_mutes where room_id=p_room_id and player=actor and until_at>now())
 then raise exception 'Отправка сообщений временно ограничена'; end if;
 if p_body is null or length(trim(p_body))<1 or length(p_body)>1000 then raise exception 'Длина сообщения 1–1000'; end if;
 insert into public.game_public_messages(room_id,author,body) values(p_room_id,actor,trim(p_body)) returning id into mid;
 return mid;
end;$$;
revoke all on function public.game_public_send_message(bigint,text) from public,anon;
grant execute on function public.game_public_send_message(bigint,text) to authenticated;

create or replace function public.game_owner_room_action(p_action text,p_room_id bigint,p_subject text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); player_id uuid; duration_hours int; result jsonb;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000 then raise exception 'Причина 10–1000 символов'; end if;
 if not exists(select 1 from public.game_public_rooms where id=p_room_id) then raise exception 'Комната не найдена'; end if;
 if p_action='disable_room' then
  update public.game_public_rooms set enabled=false where id=p_room_id;
  result:=jsonb_build_object('enabled',false);
 elsif p_action='enable_room' then
  update public.game_public_rooms set enabled=true where id=p_room_id;
  result:=jsonb_build_object('enabled',true);
 elsif p_action='mute_player' then
  begin player_id:=split_part(p_subject,':',1)::uuid;duration_hours:=split_part(p_subject,':',2)::integer;
  exception when others then raise exception 'Формат: UUID:часы'; end;
  if duration_hours<1 or duration_hours>720 then raise exception 'Срок 1–720 часов'; end if;
  insert into public.game_public_room_mutes(room_id,player,until_at)
  values(p_room_id,player_id,now()+make_interval(hours=>duration_hours))
  on conflict(room_id,player) do update set until_at=excluded.until_at;
  result:=jsonb_build_object('muted',player_id,'hours',duration_hours);
 elsif p_action='unmute_player' then
  begin player_id:=p_subject::uuid;exception when others then raise exception 'Неверный UUID'; end;
  delete from public.game_public_room_mutes where room_id=p_room_id and player=player_id;
  result:=jsonb_build_object('unmuted',player_id);
 elsif p_action='hide_message' then
  update public.game_public_messages set hidden=true
  where id=p_subject::bigint and room_id=p_room_id;
  if not found then raise exception 'Сообщение не найдено'; end if;
  result:=jsonb_build_object('hidden',p_subject);
 else raise exception 'Неизвестное действие'; end if;
 insert into public.game_admin_audit(actor,action,note)
 values(actor,'room_'||p_action,'room='||p_room_id||'; subject='||left(coalesce(p_subject,''),120)||'; reason='||trim(p_reason));
 return result;
end;$$;
revoke all on function public.game_owner_room_action(text,bigint,text,text) from public,anon;
grant execute on function public.game_owner_room_action(text,bigint,text,text) to authenticated;

create or replace function public.game_owner_rooms()
returns table(room_id bigint,city_name text,title text,kind text,enabled boolean,message_count bigint)
language sql stable security definer set search_path=''
as $$
 select r.id,c.display_name,r.title,r.kind,r.enabled,
 (select count(*) from public.game_public_messages m where m.room_id=r.id)
 from public.game_public_rooms r left join public.cities c on c.id=r.city_id
 where public.game_is_owner() order by c.display_name,r.kind,r.id;
$$;
revoke all on function public.game_owner_rooms() from public,anon;
grant execute on function public.game_owner_rooms() to authenticated;

create or replace function public.game_owner_room_messages(p_room_id bigint,p_limit integer default 50)
returns table(message_id bigint,author uuid,body text,hidden boolean,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select m.id,m.author,m.body,m.hidden,m.created_at
 from public.game_public_messages m
 join public.game_public_rooms r on r.id=m.room_id
 where public.game_is_owner() and m.room_id=p_room_id and r.kind='text'
 order by m.created_at desc limit least(greatest(coalesce(p_limit,50),1),100);
$$;
revoke all on function public.game_owner_room_messages(bigint,integer) from public,anon;
grant execute on function public.game_owner_room_messages(bigint,integer) to authenticated;
commit;