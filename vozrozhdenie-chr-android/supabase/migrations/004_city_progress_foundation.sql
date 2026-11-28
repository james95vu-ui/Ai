-- City progression foundation. Apply only after review/testing.
begin;
create table if not exists public.city_levels (
  level integer primary key check (level between 1 and 20),
  required_contribution bigint not null unique check (required_contribution >= 0)
);
insert into public.city_levels(level,required_contribution) values
 (1,0),(2,100000),(3,300000),(4,700000),(5,1500000),
 (6,3000000),(7,6000000),(8,12000000),(9,25000000),(10,50000000),
 (11,100000000),(12,200000000),(13,400000000),(14,800000000),
 (15,1500000000),(16,3000000000),(17,6000000000),(18,12000000000),
 (19,25000000000),(20,50000000000)
on conflict (level) do nothing;

create table if not exists public.cities (
 id text primary key,
 display_name text not null unique,
 total_contribution bigint not null default 0 check(total_contribution >= 0),
 created_at timestamptz not null default now()
);
insert into public.cities(id,display_name) values
 ('grozny','Грозный'),('urus_martan','Урус-Мартан'),
 ('argun','Аргун'),('gudermes','Гудермес'),
 ('shali','Шали'),('kurchaloy','Курчалой'),
 ('achkhoy_martan','Ачхой-Мартан'),('oyskhara','Ойсхара'),
 ('sernovodskoye','Серноводское'),('shatoy','Шатой')
on conflict (id) do nothing;

alter table public.cities enable row level security;
alter table public.city_levels enable row level security;
revoke all on public.cities,public.city_levels from anon,authenticated;
grant select on public.cities,public.city_levels to authenticated;

drop policy if exists "city catalog authenticated read" on public.cities;
create policy "city catalog authenticated read" on public.cities
 for select to authenticated using (true);
drop policy if exists "city levels authenticated read" on public.city_levels;
create policy "city levels authenticated read" on public.city_levels
 for select to authenticated using (true);

-- Progress is computed from cumulative, server-owned totals, never client-supplied values.
create or replace function public.city_progress()
returns table(city_id text,city_name text,city_level integer,
 total_contribution bigint,next_level_contribution bigint)
language sql stable security definer set search_path = ''
as $$
 select c.id,c.display_name,
   (select max(l.level) from public.city_levels l where l.required_contribution<=c.total_contribution),
   c.total_contribution,
   (select min(l.required_contribution) from public.city_levels l where l.required_contribution>c.total_contribution)
 from public.cities c
 order by c.total_contribution desc,c.id;
$$;
revoke all on function public.city_progress() from public,anon;
grant execute on function public.city_progress() to authenticated;
commit;
