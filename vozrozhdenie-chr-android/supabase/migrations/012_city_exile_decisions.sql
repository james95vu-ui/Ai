-- Mayor decision after ten independently validated complaints.
-- Validation is deliberately NOT available to mayors or ordinary players.
begin;
create table if not exists public.city_exile_history (
 id bigint generated always as identity primary key,
 city_id text not null references public.cities(id),
 accused uuid not null references auth.users(id),
 mayor uuid not null references auth.users(id),
 action text not null check(action in ('exile','retain')),
 validated_reports integer not null check(validated_reports>=10),
 decided_at timestamptz not null default now(),
 note text not null check(char_length(note) between 10 and 1000)
);
create table if not exists public.city_exile_bans (
 player uuid not null references auth.users(id),
 city_id text not null references public.cities(id),
 banned_until timestamptz not null,
 history_id bigint not null references public.city_exile_history(id),
 primary key(player,city_id)
);
create index if not exists city_exile_history_accused_idx on public.city_exile_history(accused,decided_at desc);
alter table public.city_exile_history enable row level security;
alter table public.city_exile_bans enable row level security;
revoke all on public.city_exile_history,public.city_exile_bans from public,anon,authenticated;
grant select on public.city_exile_history,public.city_exile_bans to authenticated;
drop policy if exists "exile history for involved residents" on public.city_exile_history;
create policy "exile history for involved residents" on public.city_exile_history
 for select to authenticated using(accused=(select auth.uid()) or mayor=(select auth.uid()));
drop policy if exists "read own exile bans" on public.city_exile_bans;
create policy "read own exile bans" on public.city_exile_bans
 for select to authenticated using(player=(select auth.uid()));

create or replace function public.city_mayor_resolve_complaints(
 p_accused uuid,p_exile boolean,p_note text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare
 actor uuid:=(select auth.uid());
 monday date:=(date_trunc('week',now() at time zone 'utc'))::date;
 city_key text;
 city_name text;
 accused_city text;
 reports integer;
 history_key bigint;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 if p_accused is null or p_accused=actor or p_exile is null
 then raise exception 'Неверное решение'; end if;
 if p_note is null or char_length(btrim(p_note))<10 or char_length(p_note)>1000
 then raise exception 'Укажи обоснование от 10 до 1000 символов'; end if;
 select m.city,c.id into city_name,city_key
 from public.city_members m join public.cities c on c.display_name=m.city
 where m.user_id=actor;
 if city_key is null then raise exception 'Город не найден'; end if;
 perform 1 from public.city_mayor_terms
 where city_id=city_key and week_start=monday and mayor=actor for update;
 if not found then raise exception 'Решение может принять только действующий мэр'; end if;
 -- Lock target membership to prevent simultaneous moves and decisions.
 select city into accused_city from public.city_members
 where user_id=p_accused for update;
 if accused_city is distinct from city_name then
  raise exception 'Житель уже покинул этот город'; end if;
 select count(distinct reporter)::integer into reports
 from public.city_resident_complaints
 where city_id=city_key and accused=p_accused and status='validated';
 if reports<10 then raise exception 'Нужно 10 подтверждённых жалоб от разных жителей'; end if;
 insert into public.city_exile_history(city_id,accused,mayor,action,validated_reports,note)
 values(city_key,p_accused,actor,case when p_exile then 'exile' else 'retain' end,reports,btrim(p_note))
 returning id into history_key;
 -- Consume reviewed complaints whether mayor exiles or retains.
 update public.city_resident_complaints set status='rejected'
 where city_id=city_key and accused=p_accused and status='validated';
 if p_exile then
  insert into public.city_exile_bans(player,city_id,banned_until,history_id)
  values(p_accused,city_key,now()+interval '30 days',history_key)
  on conflict(player,city_id) do update
  set banned_until=greatest(public.city_exile_bans.banned_until,excluded.banned_until),
      history_id=excluded.history_id;
  -- Remove only membership. Wallets and community buildings are untouched.
  delete from public.city_members where user_id=p_accused and city=city_name;
 end if;
 return history_key;
end;
$$;
revoke all on function public.city_mayor_resolve_complaints(uuid,boolean,text) from public,anon;
grant execute on function public.city_mayor_resolve_complaints(uuid,boolean,text) to authenticated;
commit;
