-- Appeals: residents can contest an exile; no automatic reinstatement.
begin;
create table if not exists public.city_exile_appeals (
 id bigint generated always as identity primary key,
 history_id bigint not null references public.city_exile_history(id),
 appellant uuid not null references auth.users(id),
 statement text not null check(char_length(statement) between 20 and 2000),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 created_at timestamptz not null default now(),
 resolved_at timestamptz,
 unique(history_id,appellant)
);
alter table public.city_exile_appeals enable row level security;
revoke all on public.city_exile_appeals from public,anon,authenticated;
grant select on public.city_exile_appeals to authenticated;
drop policy if exists "read own appeals" on public.city_exile_appeals;
create policy "read own appeals" on public.city_exile_appeals
 for select to authenticated using(appellant=(select auth.uid()));

create or replace function public.city_file_exile_appeal(p_history_id bigint,p_statement text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); appeal_id bigint;
begin
 if actor is null then raise exception 'Требуется вход'; end if;
 if p_statement is null or char_length(btrim(p_statement))<20 or char_length(p_statement)>2000
 then raise exception 'Опиши причину обжалования (20–2000 символов)'; end if;
 if not exists(select 1 from public.city_exile_history
 where id=p_history_id and accused=actor and action='exile') then
  raise exception 'Изгнание не найдено или принадлежит другому игроку';
 end if;
 insert into public.city_exile_appeals(history_id,appellant,statement)
 values(p_history_id,actor,btrim(p_statement))
 returning id into appeal_id;
 return appeal_id;
exception when unique_violation then
 raise exception 'Апелляция на это изгнание уже подана';
end;
$$;
revoke all on function public.city_file_exile_appeal(bigint,text) from public,anon;
grant execute on function public.city_file_exile_appeal(bigint,text) to authenticated;

create or replace function public.city_my_exiles()
returns table(history_id bigint,city_name text,decided_at timestamptz,
 mayor_note text,banned_until timestamptz,appeal_status text)
language sql stable security definer set search_path=''
as $$
 select h.id,c.display_name,h.decided_at,h.note,b.banned_until,a.status
 from public.city_exile_history h
 join public.cities c on c.id=h.city_id
 left join public.city_exile_bans b on b.history_id=h.id and b.player=h.accused
 left join public.city_exile_appeals a on a.history_id=h.id and a.appellant=h.accused
 where h.accused=(select auth.uid()) and h.action='exile'
 order by h.decided_at desc;
$$;
revoke all on function public.city_my_exiles() from public,anon;
grant execute on function public.city_my_exiles() to authenticated;
commit;
