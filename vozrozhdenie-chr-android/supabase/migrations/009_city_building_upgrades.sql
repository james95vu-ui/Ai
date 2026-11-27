-- City-owned building upgrades, funded only with unallocated verified tap points.
begin;
alter table public.city_building_upgrades
 add column if not exists upgrade_progress bigint not null default 0
 check (upgrade_progress>=0);

create table if not exists public.city_building_upgrade_contributions (
 project_id bigint not null references public.city_projects(id),
 player uuid not null references auth.users(id) on delete cascade,
 points bigint not null default 0 check(points>=0),
 updated_at timestamptz not null default now(),
 primary key(project_id,player)
);
create index if not exists city_building_upgrade_contributions_player_idx
 on public.city_building_upgrade_contributions(player);
alter table public.city_building_upgrade_contributions enable row level security;
revoke all on public.city_building_upgrade_contributions from public,anon,authenticated;
grant select on public.city_building_upgrade_contributions to authenticated;
drop policy if exists "read own building upgrade contributions"
 on public.city_building_upgrade_contributions;
create policy "read own building upgrade contributions"
 on public.city_building_upgrade_contributions for select to authenticated
 using(player=(select auth.uid()));

-- Upgrade 1->2 costs 2000, 2->3 4000, 3->4 6000, 4->5 8000 points.
create or replace function public.city_upgrade_building(p_project_id bigint,p_points bigint)
returns table(building_id bigint,upgrade_level integer,upgrade_progress bigint,
 next_upgrade_cost bigint,remaining_allocatable bigint)
language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := (select auth.uid());
 member_city text;
 building public.city_projects%rowtype;
 upgrade public.city_building_upgrades%rowtype;
 earned_total bigint;
 allocated_projects bigint;
 allocated_upgrades bigint;
 available bigint;
 cost bigint;
 new_progress bigint;
 new_level integer;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 if p_points is null or p_points<1 or p_points>100000 then
  raise exception 'Недопустимый размер вклада';
 end if;
 -- Shared serialization lock with city_project_contribute.
 select earned into earned_total from tycoon.tap_scores
 where player=actor for update;
 if not found then raise exception 'Сначала заработай очки тапами'; end if;
 select city into member_city from public.city_members where user_id=actor;
 select * into building from public.city_projects
 where id=p_project_id for update;
 if not found then raise exception 'Здание не найдено'; end if;
 if member_city is distinct from
 (select display_name from public.cities where id=building.city_id) then
  raise exception 'Это не твой город';
 end if;
 if building.contributed_points<>building.required_points then
  raise exception 'Сначала заверши строительство';
 end if;
 select * into upgrade from public.city_building_upgrades
 where project_id=p_project_id for update;
 if not found then raise exception 'Здание ещё не зарегистрировано'; end if;
 if upgrade.upgrade_level>=5 then raise exception 'Максимальный уровень здания'; end if;

 select coalesce(sum(points),0) into allocated_projects
 from public.city_project_contributions where player=actor;
 select coalesce(sum(points),0) into allocated_upgrades
 from public.city_building_upgrade_contributions where player=actor;
 available:=earned_total-allocated_projects-allocated_upgrades;
 if available<p_points then raise exception 'Недостаточно нераспределённых очков'; end if;

 cost:=upgrade.upgrade_level::bigint*2000;
 if upgrade.upgrade_progress+p_points>cost then
  raise exception 'Для следующего улучшения требуется меньше очков';
 end if;
 new_progress:=upgrade.upgrade_progress+p_points;
 new_level:=upgrade.upgrade_level;
 if new_progress=cost then
  new_level:=new_level+1;
  new_progress:=0;
 end if;

 insert into public.city_building_upgrade_contributions(project_id,player,points)
 values(p_project_id,actor,p_points)
 on conflict(project_id,player) do update
 set points=public.city_building_upgrade_contributions.points+excluded.points,
 updated_at=now();
 update public.city_building_upgrades
 set upgrade_level=new_level,upgrade_progress=new_progress,upgraded_at=now()
 where project_id=p_project_id;
 building_id:=p_project_id;
 upgrade_level:=new_level;
 upgrade_progress:=new_progress;
 next_upgrade_cost:=case when new_level=5 then null else new_level::bigint*2000 end;
 remaining_allocatable:=available-p_points;
 return next;
end;
$$;
revoke all on function public.city_upgrade_building(bigint,bigint) from public,anon;
grant execute on function public.city_upgrade_building(bigint,bigint) to authenticated;

-- Patch project contribution accounting to include upgrade allocations too.
create or replace function public.city_project_contribute(p_project_id bigint,p_points bigint)
returns table(project_id bigint,contributed_points bigint,required_points bigint,
 remaining_allocatable bigint)
language plpgsql security definer set search_path=''
as $$
declare
 actor uuid := (select auth.uid());
 member_city text;
 project_record public.city_projects%rowtype;
 earned_total bigint;
 allocated_total bigint;
 allocated_upgrades bigint;
 available bigint;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 if p_points is null or p_points<1 or p_points>100000 then
  raise exception 'Недопустимый размер вклада';
 end if;
 select earned into earned_total from tycoon.tap_scores
 where player=actor for update;
 if not found then raise exception 'Сначала заработай очки тапами'; end if;
 select city into member_city from public.city_members where user_id=actor;
 select * into project_record from public.city_projects
 where id=p_project_id for update;
 if not found then raise exception 'Стройка не найдена'; end if;
 if member_city is distinct from
 (select display_name from public.cities where id=project_record.city_id)
 then raise exception 'Это не твой город'; end if;
 select coalesce(sum(points),0) into allocated_total
 from public.city_project_contributions where player=actor;
 select coalesce(sum(points),0) into allocated_upgrades
 from public.city_building_upgrade_contributions where player=actor;
 available:=earned_total-allocated_total-allocated_upgrades;
 if available<p_points then raise exception 'Недостаточно нераспределённых очков'; end if;
 if project_record.contributed_points+p_points>project_record.required_points then
  raise exception 'Стройке нужно меньше очков';
 end if;
 insert into public.city_project_contributions(project_id,player,points)
 values(p_project_id,actor,p_points)
 on conflict(project_id,player) do update
 set points=public.city_project_contributions.points+excluded.points,
 updated_at=now();
 update public.city_projects p
 set contributed_points=p.contributed_points+p_points
 where p.id=p_project_id
 returning p.id,p.contributed_points,p.required_points
 into project_id,contributed_points,required_points;
 remaining_allocatable:=available-p_points;
 return next;
end;
$$;
revoke all on function public.city_project_contribute(bigint,bigint) from public,anon;
grant execute on function public.city_project_contribute(bigint,bigint) to authenticated;

create or replace function public.city_completed_buildings(p_city_id text)
returns table(building_id bigint,slot integer,title text,project_created_at timestamptz,
 total_points bigint,workers bigint,upgrade_level integer,
 upgrade_progress bigint,next_upgrade_cost bigint)
language sql stable security definer set search_path=''
as $$
 select p.id,p.slot,p.title,p.created_at,p.contributed_points,
 (select count(*) from public.city_project_contributions x
  where x.project_id=p.id and x.points>0),
 u.upgrade_level,u.upgrade_progress,
 case when u.upgrade_level>=5 then null else u.upgrade_level::bigint*2000 end
 from public.city_projects p
 join public.city_building_upgrades u on u.project_id=p.id
 where p.city_id=p_city_id and p.contributed_points=p.required_points
 order by p.slot;
$$;
revoke all on function public.city_completed_buildings(text) from public,anon;
grant execute on function public.city_completed_buildings(text) to authenticated;
commit;
