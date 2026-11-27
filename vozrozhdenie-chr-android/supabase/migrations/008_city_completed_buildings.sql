-- Completed community projects are permanent city assets, not player property.
begin;
create or replace function public.city_completed_buildings(p_city_id text)
returns table(building_id bigint,slot integer,title text,completed_at timestamptz,
 total_points bigint,workers bigint)
language sql stable security definer set search_path=''
as $$
 select p.id,p.slot,p.title,
 p.created_at, -- project creation date; completion time added by later event migration
 p.contributed_points,
 (select count(*) from public.city_project_contributions x
  where x.project_id=p.id and x.points>0)
 from public.city_projects p
 where p.city_id=p_city_id and p.contributed_points=p.required_points
 order by p.slot;
$$;
revoke all on function public.city_completed_buildings(text) from public,anon;
grant execute on function public.city_completed_buildings(text) to authenticated;

-- Upgrade levels are city-owned and remain after any resident leaves.
create table if not exists public.city_building_upgrades (
 project_id bigint primary key references public.city_projects(id),
 upgrade_level integer not null default 1 check(upgrade_level between 1 and 5),
 upgraded_at timestamptz not null default now()
);
alter table public.city_building_upgrades enable row level security;
revoke all on public.city_building_upgrades from anon,authenticated;
grant select on public.city_building_upgrades to authenticated;
drop policy if exists "read city building upgrades" on public.city_building_upgrades;
create policy "read city building upgrades" on public.city_building_upgrades
 for select to authenticated using(true);

-- Keep a city-owned upgrade record whenever a project first completes.
create or replace function public.city_register_completed_building()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.contributed_points=new.required_points then
  insert into public.city_building_upgrades(project_id)
  values(new.id) on conflict(project_id) do nothing;
 end if;
 return new;
end;
$$;
revoke all on function public.city_register_completed_building() from public,anon,authenticated;
drop trigger if exists city_register_completed_building on public.city_projects;
create trigger city_register_completed_building
after update of contributed_points on public.city_projects
for each row when (new.contributed_points=new.required_points)
execute function public.city_register_completed_building();

insert into public.city_building_upgrades(project_id)
select id from public.city_projects where contributed_points=required_points
on conflict(project_id) do nothing;
commit;
