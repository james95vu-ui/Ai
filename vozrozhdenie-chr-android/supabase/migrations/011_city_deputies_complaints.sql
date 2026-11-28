-- Mayor deputies and resident complaints, server-authorized.
begin;
create table if not exists public.city_resident_complaints (
 id bigint generated always as identity primary key,
 city_id text not null references public.cities(id),
 reporter uuid not null references auth.users(id),
 accused uuid not null references auth.users(id),
 reason text not null check(char_length(reason) between 20 and 1000),
 status text not null default 'pending' check(status in ('pending','validated','rejected')),
 created_at timestamptz not null default now(),
 check(reporter<>accused)
);
create unique index if not exists city_complaints_unique_active
 on public.city_resident_complaints(city_id,reporter,accused)
 where status in ('pending','validated');
create index if not exists city_complaints_accused_idx
 on public.city_resident_complaints(city_id,accused,status);
alter table public.city_resident_complaints enable row level security;
revoke all on public.city_resident_complaints from public,anon,authenticated;
grant select on public.city_resident_complaints to authenticated;
drop policy if exists "reporter reads own complaint" on public.city_resident_complaints;
create policy "reporter reads own complaint" on public.city_resident_complaints
 for select to authenticated using(reporter=(select auth.uid()));

create or replace function public.city_file_complaint(p_accused uuid,p_reason text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); city_name text; city_key text; accused_city text; complaint_id bigint;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 if p_accused is null or p_accused=actor then raise exception 'Нельзя пожаловаться на себя'; end if;
 if p_reason is null or char_length(btrim(p_reason))<20 or char_length(p_reason)>1000
 then raise exception 'Опиши нарушение: от 20 до 1000 символов'; end if;
 select city into city_name from public.city_members where user_id=actor;
 select city into accused_city from public.city_members where user_id=p_accused;
 if city_name is null or city_name is distinct from accused_city
 then raise exception 'Жаловаться могут только жители одного города'; end if;
 select id into city_key from public.cities where display_name=city_name;
 if city_key is null then raise exception 'Город не найден'; end if;
 insert into public.city_resident_complaints(city_id,reporter,accused,reason)
 values(city_key,actor,p_accused,btrim(p_reason)) returning id into complaint_id;
 return complaint_id;
exception when unique_violation then
 raise exception 'Твоя жалоба на этого жителя уже рассматривается';
end;
$$;
revoke all on function public.city_file_complaint(uuid,text) from public,anon;
grant execute on function public.city_file_complaint(uuid,text) to authenticated;

create or replace function public.city_appoint_deputy(p_deputy uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); monday date; city_key text; city_name text; deputy_city text; n integer;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 monday:=(date_trunc('week',now() at time zone 'utc'))::date;
 select m.city,c.id into city_name,city_key from public.city_members m
 join public.cities c on c.display_name=m.city where m.user_id=actor;
 if city_key is null then raise exception 'Ты не состоишь в городе'; end if;
 -- Serialize appointment decisions for a given mayor term.
 perform 1 from public.city_mayor_terms
 where city_id=city_key and week_start=monday and mayor=actor for update;
 if not found then raise exception 'Назначать заместителей может только действующий мэр'; end if;
 if p_deputy is null or p_deputy=actor then raise exception 'Неверный заместитель'; end if;
 select city into deputy_city from public.city_members where user_id=p_deputy;
 if deputy_city is distinct from city_name then raise exception 'Заместитель должен жить в твоём городе'; end if;
 select count(*) into n from public.city_mayor_deputies
 where city_id=city_key and week_start=monday;
 if n>=2 then raise exception 'Уже назначены два заместителя'; end if;
 insert into public.city_mayor_deputies(city_id,week_start,deputy)
 values(city_key,monday,p_deputy)
 on conflict do nothing;
end;
$$;
revoke all on function public.city_appoint_deputy(uuid) from public,anon;
grant execute on function public.city_appoint_deputy(uuid) to authenticated;

create or replace function public.city_remove_deputy(p_deputy uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); monday date; city_key text; removed integer;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 monday:=(date_trunc('week',now() at time zone 'utc'))::date;
 select c.id into city_key from public.city_members m
 join public.cities c on c.display_name=m.city where m.user_id=actor;
 perform 1 from public.city_mayor_terms
 where city_id=city_key and week_start=monday and mayor=actor for update;
 if not found then raise exception 'Только действующий мэр может снять заместителя'; end if;
 delete from public.city_mayor_deputies
 where city_id=city_key and week_start=monday and deputy=p_deputy;
 get diagnostics removed=row_count;
 return removed>0;
end;
$$;
revoke all on function public.city_remove_deputy(uuid) from public,anon;
grant execute on function public.city_remove_deputy(uuid) to authenticated;

-- Only verified complaints count toward the threshold. No player or mayor
-- may mark complaints validated through this migration.
create or replace function public.city_complaint_summary(p_accused uuid)
returns table(validated_reports bigint,pending_reports bigint,eligible_for_review boolean)
language plpgsql stable security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); actor_city text; accused_city text; city_key text;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 select city into actor_city from public.city_members where user_id=actor;
 select city into accused_city from public.city_members where user_id=p_accused;
 if actor_city is null or actor_city is distinct from accused_city
 then raise exception 'Можно смотреть жалобы только своего города'; end if;
 select id into city_key from public.cities where display_name=actor_city;
 return query select
 count(distinct reporter) filter(where status='validated'),
 count(distinct reporter) filter(where status='pending'),
 count(distinct reporter) filter(where status='validated')>=10
 from public.city_resident_complaints
 where city_id=city_key and accused=p_accused;
end;
$$;
revoke all on function public.city_complaint_summary(uuid) from public,anon;
grant execute on function public.city_complaint_summary(uuid) to authenticated;
commit;
