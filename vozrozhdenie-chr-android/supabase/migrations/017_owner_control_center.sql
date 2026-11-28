begin;
create table if not exists public.game_settings(
 key text primary key, value jsonb not null, updated_at timestamptz not null default now()
);
create table if not exists public.game_announcements(
 id bigint generated always as identity primary key,
 title text not null check(length(title) between 3 and 120),
 body text not null check(length(body) between 3 and 2000),
 city_id text references public.cities(id),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.game_settings enable row level security;
alter table public.game_announcements enable row level security;
revoke all on public.game_settings,public.game_announcements from public,anon,authenticated;
grant select on public.game_announcements to authenticated;
create policy "read active announcements" on public.game_announcements
 for select to authenticated using(active);

create or replace function public.game_owner_dashboard()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 return jsonb_build_object(
 'users',(select count(*) from auth.users),
 'members',(select count(*) from public.city_members),
 'cities',(select jsonb_agg(jsonb_build_object('id',id,'name',display_name,'points',total_contribution) order by display_name) from public.cities),
 'pending_complaints',(select count(*) from public.city_resident_complaints where status='pending'),
 'validated_complaints',(select count(*) from public.city_resident_complaints where status='validated'),
 'pending_appeals',(select count(*) from public.city_exile_appeals where status='pending'),
 'active_bans',(select count(*) from public.city_exile_bans where banned_until>now()),
 'announcements',(select count(*) from public.game_announcements where active),
 'mayors',(select count(*) from public.city_mayor_terms where week_start=(date_trunc('week',now() at time zone 'utc'))::date)
 );
end;$$;
revoke all on function public.game_owner_dashboard() from public,anon;
grant execute on function public.game_owner_dashboard() to authenticated;

create or replace function public.game_owner_find_player(p_query text)
returns table(player_id uuid,email text,city text,coins integer,materials integer,taps bigint)
language sql stable security definer set search_path=''
as $$
 select u.id,u.email,m.city,w.coins,w.materials,t.taps
 from auth.users u
 left join public.city_members m on m.user_id=u.id
 left join tycoon.wallets w on w.player=u.id
 left join tycoon.tap_scores t on t.player=u.id
 where public.game_is_owner() and length(trim(p_query))>=3
 and (u.id::text=p_query or u.email ilike '%'||replace(replace(p_query,'%','\\%'),'_','\\_')||'%' escape '\\')
 order by u.created_at desc limit 20;
$$;
revoke all on function public.game_owner_find_player(text) from public,anon;
grant execute on function public.game_owner_find_player(text) to authenticated;

create or replace function public.game_owner_action(
 p_action text,p_target text,p_value text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); target_user uuid; city_key text;
 amount bigint; old_amount bigint; new_amount bigint; result jsonb;
 monday date:=(date_trunc('week',now() at time zone 'utc'))::date;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 if p_reason is null or length(trim(p_reason))<10 or length(p_reason)>1000
 then raise exception 'Укажи причину действия (10–1000 символов)'; end if;
 if p_action in ('set_coins','add_coins','set_materials','add_materials','appoint_mayor') then
  begin target_user:=p_target::uuid;
  exception when invalid_text_representation then raise exception 'Неверный ID игрока'; end;
  if not exists(select 1 from auth.users where id=target_user) then raise exception 'Игрок не найден'; end if;
 end if;
 if p_action in ('set_coins','add_coins','set_materials','add_materials') then
  begin amount:=p_value::bigint;
  exception when invalid_text_representation or numeric_value_out_of_range then raise exception 'Неверное количество'; end;
  insert into tycoon.wallets(player,coins,materials) values(target_user,0,0) on conflict(player) do nothing;
  perform 1 from tycoon.wallets where player=target_user for update;
  if p_action like '%coins' then
   select coins into old_amount from tycoon.wallets where player=target_user;
  else
   select materials into old_amount from tycoon.wallets where player=target_user;
  end if;
  new_amount:=case when p_action like 'add_%' then old_amount+amount else amount end;
  if new_amount<0 or new_amount>2147483647 then raise exception 'Значение вне допустимого диапазона'; end if;
  if p_action like '%coins' then
   update tycoon.wallets set coins=new_amount::integer where player=target_user;
  else
   update tycoon.wallets set materials=new_amount::integer where player=target_user;
  end if;
  result:=jsonb_build_object('player',target_user,'before',old_amount,'after',new_amount);
 elsif p_action='appoint_mayor' then
  select c.id into city_key from public.city_members m
  join public.cities c on c.display_name=m.city where m.user_id=target_user;
  if city_key is null then raise exception 'Игрок не состоит в городе'; end if;
  insert into public.city_mayor_terms(city_id,week_start,mayor)
  values(city_key,monday,target_user)
  on conflict(city_id,week_start) do update set mayor=excluded.mayor,elected_at=now();
  delete from public.city_mayor_deputies where city_id=city_key and week_start=monday;
  result:=jsonb_build_object('city',city_key,'mayor',target_user);
 elsif p_action='announce' then
  if length(p_target)<3 or length(p_target)>120 or length(p_value)<3 or length(p_value)>2000
  then raise exception 'Заголовок 3–120 символов, текст 3–2000'; end if;
  insert into public.game_announcements(title,body)
  values(p_target,p_value) returning jsonb_build_object('announcement_id',id) into result;
 elsif p_action='close_announcement' then
  begin amount:=p_target::bigint;
  exception when others then raise exception 'Неверный ID объявления'; end;
  update public.game_announcements set active=false where id=amount;
  if not found then raise exception 'Объявление не найдено'; end if;
  result:=jsonb_build_object('closed',amount);
 else raise exception 'Неизвестное действие'; end if;
 insert into public.game_admin_audit(actor,action,note)
 values(actor,p_action,concat('target=',left(coalesce(p_target,''),150),'; value=',left(coalesce(p_value,''),200),'; reason=',trim(p_reason),'; result=',result::text));
 return result;
end;$$;
revoke all on function public.game_owner_action(text,text,text,text) from public,anon;
grant execute on function public.game_owner_action(text,text,text,text) to authenticated;

create or replace function public.game_owner_audit(p_limit integer default 50)
returns table(id bigint,action text,subject_id bigint,note text,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select a.id,a.action,a.subject_id,a.note,a.created_at
 from public.game_admin_audit a where public.game_is_owner()
 order by a.id desc limit least(greatest(coalesce(p_limit,50),1),100);
$$;
revoke all on function public.game_owner_audit(integer) from public,anon;
grant execute on function public.game_owner_audit(integer) to authenticated;
commit;