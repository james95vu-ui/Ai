-- Community construction: 100 projects in each of 10 cities.
-- Contribution allocates already verified tap points; it never creates coins
-- or increases the city total a second time.
begin;
create table if not exists public.city_projects (
 id bigint generated always as identity primary key,
 city_id text not null references public.cities(id),
 slot integer not null check(slot between 1 and 100),
 title text not null,
 required_points bigint not null check(required_points>0),
 contributed_points bigint not null default 0 check(contributed_points>=0),
 created_at timestamptz not null default now(),
 unique(city_id,slot),
 check(contributed_points<=required_points)
);
create table if not exists public.city_project_contributions (
 project_id bigint not null references public.city_projects(id),
 player uuid not null references auth.users(id) on delete cascade,
 points bigint not null default 0 check(points>=0),
 updated_at timestamptz not null default now(),
 primary key(project_id,player)
);
create index if not exists city_projects_city_idx on public.city_projects(city_id,slot);
create index if not exists city_project_contributions_player_idx on public.city_project_contributions(player);

insert into public.city_projects(city_id,slot,title,required_points)
select c.id,n,
 (array['Жилой дом','Школа','Больница','Парк','Спортивный комплекс',
 'Библиотека','Мост','Культурный центр','Мастерская','Научный центр'])
 [((n-1)%10)+1]||' №'||n,
 (1000::bigint + ((n-1)/10)*2000::bigint)
from public.cities c cross join generate_series(1,100) as n
on conflict(city_id,slot) do nothing;

alter table public.city_projects enable row level security;
alter table public.city_project_contributions enable row level security;
revoke all on public.city_projects,public.city_project_contributions from anon,authenticated;
grant select on public.city_projects,public.city_project_contributions to authenticated;
drop policy if exists "read city projects" on public.city_projects;
create policy "read city projects" on public.city_projects
 for select to authenticated using(true);
drop policy if exists "read own project contributions" on public.city_project_contributions;
create policy "read own project contributions" on public.city_project_contributions
 for select to authenticated using(player=(select auth.uid()));

create or replace function public.city_project_list(p_city_id text)
returns table(project_id bigint,slot integer,title text,required_points bigint,
 contributed_points bigint,completed boolean,workers bigint)
language sql stable security definer set search_path=''
as $$
 select p.id,p.slot,p.title,p.required_points,p.contributed_points,
 p.contributed_points=p.required_points,
 (select count(*) from public.city_project_contributions x
  where x.project_id=p.id and x.points>0)
 from public.city_projects p
 where p.city_id=p_city_id
 order by p.slot;
$$;
revoke all on function public.city_project_list(text) from public,anon;
grant execute on function public.city_project_list(text) to authenticated;

-- One unit of contribution = one previously verified server tap point.
-- The player can freely allocate their unspent contribution points across projects.
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
 available bigint;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 if p_points is null or p_points<1 or p_points>100000 then
  raise exception 'Недопустимый размер вклада';
 end if;
 -- Lock player's authoritative tap row to serialize allocations.
 select earned into earned_total from tycoon.tap_scores
 where player=actor for update;
 if not found then raise exception 'Сначала заработай очки тапами'; end if;
 select city into member_city from public.city_members where user_id=actor;
 select * into project_record from public.city_projects where id=p_project_id for update;
 if not found then raise exception 'Стройка не найдена'; end if;
 if member_city is distinct from
   (select display_name from public.cities where id=project_record.city_id)
 then raise exception 'Это не твой город'; end if;
 select coalesce(sum(x.points),0) into allocated_total
 from public.city_project_contributions x where x.player=actor;
 available:=earned_total-allocated_total;
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
commit;
