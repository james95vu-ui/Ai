-- Owner moderation foundation. Assign owner UUID manually using privileged SQL only.
begin;
create table if not exists public.game_owner_roles(
 user_id uuid primary key references auth.users(id),
 assigned_at timestamptz not null default now()
);
create table if not exists public.game_admin_audit(
 id bigint generated always as identity primary key,
 actor uuid not null references auth.users(id),
 action text not null,
 subject_id bigint,
 note text,
 created_at timestamptz not null default now()
);
alter table public.game_owner_roles enable row level security;
alter table public.game_admin_audit enable row level security;
revoke all on public.game_owner_roles,public.game_admin_audit from public,anon,authenticated;
-- No direct table permissions for clients: RPC only.

create or replace function public.game_is_owner()
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and exists(
 select 1 from public.game_owner_roles where user_id=(select auth.uid()));
$$;
revoke all on function public.game_is_owner() from public,anon;
grant execute on function public.game_is_owner() to authenticated;

create or replace function public.game_owner_review_complaint(
 p_complaint_id bigint,p_approve boolean,p_note text)
returns text language plpgsql security definer set search_path=''
as $$
declare complaint public.city_resident_complaints%rowtype;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 if p_approve is null or p_note is null or char_length(btrim(p_note))<10
 or char_length(p_note)>1000 then raise exception 'Нужно обоснование 10–1000 символов'; end if;
 select * into complaint from public.city_resident_complaints
 where id=p_complaint_id for update;
 if not found or complaint.status<>'pending' then
 raise exception 'Жалоба отсутствует или уже рассмотрена'; end if;
 update public.city_resident_complaints
 set status=case when p_approve then 'validated' else 'rejected' end
 where id=p_complaint_id;
 insert into public.game_admin_audit(actor,action,subject_id,note)
 values((select auth.uid()),case when p_approve then 'complaint_validated' else 'complaint_rejected' end,
 p_complaint_id,btrim(p_note));
 return case when p_approve then 'validated' else 'rejected' end;
end;
$$;
revoke all on function public.game_owner_review_complaint(bigint,boolean,text) from public,anon;
grant execute on function public.game_owner_review_complaint(bigint,boolean,text) to authenticated;

create or replace function public.game_owner_review_appeal(
 p_appeal_id bigint,p_accept boolean,p_note text)
returns text language plpgsql security definer set search_path=''
as $$
declare appeal public.city_exile_appeals%rowtype;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 if p_accept is null or p_note is null or char_length(btrim(p_note))<10
 or char_length(p_note)>1000 then raise exception 'Нужно обоснование 10–1000 символов'; end if;
 select * into appeal from public.city_exile_appeals
 where id=p_appeal_id for update;
 if not found or appeal.status<>'pending' then
 raise exception 'Апелляция отсутствует или уже рассмотрена'; end if;
 update public.city_exile_appeals
 set status=case when p_accept then 'accepted' else 'rejected' end,
 resolved_at=now() where id=p_appeal_id;
 if p_accept then
 -- Remove ban only. Do not silently evict a new-city membership.
 delete from public.city_exile_bans b
 using public.city_exile_history h
 where h.id=appeal.history_id and b.history_id=h.id and b.player=appeal.appellant;
 end if;
 insert into public.game_admin_audit(actor,action,subject_id,note)
 values((select auth.uid()),case when p_accept then 'appeal_accepted' else 'appeal_rejected' end,
 p_appeal_id,btrim(p_note));
 return case when p_accept then 'accepted' else 'rejected' end;
end;
$$;
revoke all on function public.game_owner_review_appeal(bigint,boolean,text) from public,anon;
grant execute on function public.game_owner_review_appeal(bigint,boolean,text) to authenticated;

create or replace function public.game_owner_queue()
returns table(kind text,item_id bigint,city_name text,subject_id uuid,description text,submitted_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select 'complaint'::text,r.id,c.display_name,r.accused,r.reason,r.created_at
 from public.city_resident_complaints r join public.cities c on c.id=r.city_id
 where r.status='pending' and public.game_is_owner()
 union all
 select 'appeal'::text,a.id,c.display_name,h.accused,a.statement,a.created_at
 from public.city_exile_appeals a join public.city_exile_history h on h.id=a.history_id
 join public.cities c on c.id=h.city_id
 where a.status='pending' and public.game_is_owner()
 order by 6 desc limit 100;
$$;
revoke all on function public.game_owner_queue() from public,anon;
grant execute on function public.game_owner_queue() to authenticated;
commit;
