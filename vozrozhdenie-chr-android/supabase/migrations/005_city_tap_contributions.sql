-- City contributions from server-validated tap earnings.
-- Requires 004_city_progress_foundation.sql.
begin;

create table if not exists public.city_contributions (
  player uuid not null references auth.users(id) on delete cascade,
  city_id text not null references public.cities(id),
  earned bigint not null default 0 check (earned >= 0),
  updated_at timestamptz not null default now(),
  primary key (player,city_id)
);
create index if not exists city_contributions_city_earned_idx
  on public.city_contributions(city_id,earned desc);

alter table public.city_contributions enable row level security;
revoke all on public.city_contributions from anon,authenticated;
grant select on public.city_contributions to authenticated;
drop policy if exists "read own city contributions" on public.city_contributions;
create policy "read own city contributions" on public.city_contributions
 for select to authenticated using (player = (select auth.uid()));

-- Trigger fires only on increases in authoritative tycoon.tap_scores.earned.
-- No client-provided coin amount or city identifier is accepted.
create or replace function public.credit_city_from_tap()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  delta bigint;
  target_city text;
begin
  delta := new.earned - case when tg_op = 'INSERT' then 0 else old.earned end;
  if delta <= 0 then return new; end if;

  select c.id into target_city
  from public.city_members m
  join public.cities c on c.display_name = m.city
  where m.user_id = new.player;

  -- Unaffiliated players can tap, but do not earn city points until they choose a city.
  if target_city is null then return new; end if;

  insert into public.city_contributions(player,city_id,earned)
  values(new.player,target_city,delta)
  on conflict (player,city_id) do update
    set earned=public.city_contributions.earned+excluded.earned,
        updated_at=now();

  update public.cities set total_contribution=total_contribution+delta
  where id=target_city;
  return new;
end;
$$;

revoke all on function public.credit_city_from_tap() from public,anon,authenticated;
drop trigger if exists credit_city_from_tap on tycoon.tap_scores;
create trigger credit_city_from_tap
after insert or update of earned on tycoon.tap_scores
for each row execute function public.credit_city_from_tap();

-- Read-only public leaderboard; individual contributions remain private.
create or replace function public.city_leaderboard()
returns table(city_id text,city_name text,city_level integer,
 total_contribution bigint,member_count bigint)
language sql stable security definer set search_path = ''
as $$
 select c.id,c.display_name,
 (select max(l.level) from public.city_levels l
  where l.required_contribution<=c.total_contribution),
 c.total_contribution,
 (select count(*) from public.city_members m where m.city=c.display_name)
 from public.cities c
 order by c.total_contribution desc,c.id;
$$;
revoke all on function public.city_leaderboard() from public,anon;
grant execute on function public.city_leaderboard() to authenticated;
commit;
