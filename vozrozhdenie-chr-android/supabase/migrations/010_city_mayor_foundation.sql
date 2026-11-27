-- Weekly mayor competition. New taps count from activation onwards.
begin;
create table if not exists public.city_weekly_contributions(
 city_id text not null references public.cities(id),
 week_start date not null,
 player uuid not null references auth.users(id) on delete cascade,
 points bigint not null default 0 check(points>=0),
 primary key(city_id,week_start,player)
);
create index if not exists city_weekly_top_idx on public.city_weekly_contributions(city_id,week_start,points desc);
create table if not exists public.city_mayor_terms(
 city_id text not null references public.cities(id),
 week_start date not null,
 mayor uuid not null references auth.users(id),
 elected_at timestamptz not null default now(),
 primary key(city_id,week_start)
);
create table if not exists public.city_mayor_deputies(
 city_id text not null,
 week_start date not null,
 deputy uuid not null references auth.users(id),
 appointed_at timestamptz not null default now(),
 primary key(city_id,week_start,deputy),
 foreign key(city_id,week_start) references public.city_mayor_terms(city_id,week_start)
);
create index if not exists city_mayor_deputies_count_idx on public.city_mayor_deputies(city_id,week_start);

alter table public.city_weekly_contributions enable row level security;
alter table public.city_mayor_terms enable row level security;
alter table public.city_mayor_deputies enable row level security;
revoke all on public.city_weekly_contributions,public.city_mayor_terms,public.city_mayor_deputies from anon,authenticated;
grant select on public.city_weekly_contributions,public.city_mayor_terms,public.city_mayor_deputies to authenticated;
drop policy if exists "read city weekly scores" on public.city_weekly_contributions;
create policy "read city weekly scores" on public.city_weekly_contributions for select to authenticated using(true);
drop policy if exists "read mayor history" on public.city_mayor_terms;
create policy "read mayor history" on public.city_mayor_terms for select to authenticated using(true);
drop policy if exists "read mayor deputies" on public.city_mayor_deputies;
create policy "read mayor deputies" on public.city_mayor_deputies for select to authenticated using(true);

create or replace function public.city_record_weekly_taps()
returns trigger language plpgsql security definer set search_path=''
as $$
declare delta bigint; target_city text; monday date;
begin
 delta:=new.earned-case when tg_op='INSERT' then 0 else old.earned end;
 if delta<=0 then return new; end if;
 select c.id into target_city from public.city_members m
 join public.cities c on c.display_name=m.city where m.user_id=new.player;
 if target_city is null then return new; end if;
 monday:=(date_trunc('week',now() at time zone 'utc'))::date;
 insert into public.city_weekly_contributions(city_id,week_start,player,points)
 values(target_city,monday,new.player,delta)
 on conflict(city_id,week_start,player) do update
 set points=public.city_weekly_contributions.points+excluded.points;
 return new;
end;
$$;
revoke all on function public.city_record_weekly_taps() from public,anon,authenticated;
drop trigger if exists city_record_weekly_taps on tycoon.tap_scores;
create trigger city_record_weekly_taps
after insert or update of earned on tycoon.tap_scores
for each row execute function public.city_record_weekly_taps();

-- A completed week determines the mayor for the following week.
-- Lazy election: safely insert once on first call in the new week.
create or replace function public.city_elect_mayors()
returns integer language plpgsql security definer set search_path=''
as $$
declare monday date; elected integer;
begin
 if (select auth.uid()) is null then raise exception 'Требуется вход'; end if;
 monday:=(date_trunc('week',now() at time zone 'utc'))::date;
 insert into public.city_mayor_terms(city_id,week_start,mayor)
 select distinct on (w.city_id) w.city_id,monday,w.player
 from public.city_weekly_contributions w
 join public.city_members m on m.user_id=w.player
 join public.cities c on c.id=w.city_id and c.display_name=m.city
 where w.week_start=monday-7 and w.points>0
 order by w.city_id,w.points desc,w.player
 on conflict(city_id,week_start) do nothing;
 get diagnostics elected=row_count;
 return elected;
end;
$$;
revoke all on function public.city_elect_mayors() from public,anon;
grant execute on function public.city_elect_mayors() to authenticated;

create or replace function public.city_mayor_overview(p_city_id text)
returns table(week_start date,mayor uuid,points_last_week bigint,
 deputies bigint,term_ends_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select t.week_start,t.mayor,
 coalesce((select w.points from public.city_weekly_contributions w
 where w.city_id=t.city_id and w.week_start=t.week_start-7 and w.player=t.mayor),0),
 (select count(*) from public.city_mayor_deputies d
 where d.city_id=t.city_id and d.week_start=t.week_start),
 ((t.week_start+7)::timestamp at time zone 'UTC')
 from public.city_mayor_terms t
 where t.city_id=p_city_id
 and t.week_start=(date_trunc('week',now() at time zone 'utc'))::date;
$$;
revoke all on function public.city_mayor_overview(text) from public,anon;
grant execute on function public.city_mayor_overview(text) to authenticated;
commit;
