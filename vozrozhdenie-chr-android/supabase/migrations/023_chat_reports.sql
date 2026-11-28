begin;
create unique index if not exists game_room_report_once on public.game_public_room_reports(message_id,reporter);
alter table public.game_public_room_reports add column if not exists status text not null default 'pending';
alter table public.game_public_room_reports add constraint game_public_room_reports_status_check check(status in ('pending','reviewed','rejected'));
create or replace function public.game_report_public_message(p_message_id bigint,p_reason text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare actor uuid:=(select auth.uid()); message public.game_public_messages%rowtype;room public.game_public_rooms%rowtype;report_id bigint;
begin
 if actor is null then raise exception 'Требуется вход';end if;
 if length(trim(coalesce(p_reason,'')))<15 or length(p_reason)>1000 then raise exception 'Причина 15–1000 символов';end if;
 select * into message from public.game_public_messages where id=p_message_id;
 if not found or message.hidden then raise exception 'Сообщение недоступно';end if;
 if message.author=actor then raise exception 'Нельзя пожаловаться на своё сообщение';end if;
 select * into room from public.game_public_rooms where id=message.room_id and kind='text';
 if not found then raise exception 'Комната не найдена';end if;
 if not exists(select 1 from public.city_members m join public.cities c on c.display_name=m.city
 where m.user_id=actor and c.id=room.city_id) then raise exception 'Жалоба доступна жителям города';end if;
 insert into public.game_public_room_reports(message_id,reporter,reason)
 values(p_message_id,actor,trim(p_reason))
 on conflict(message_id,reporter) do nothing returning id into report_id;
 if report_id is null then raise exception 'Жалоба на это сообщение уже отправлена';end if;
 return report_id;
end;$$;
revoke all on function public.game_report_public_message(bigint,text) from public,anon;
grant execute on function public.game_report_public_message(bigint,text) to authenticated;

create or replace function public.game_owner_chat_reports()
returns table(report_id bigint,message_id bigint,room_id bigint,reporter uuid,author uuid,body text,reason text,created_at timestamptz)
language sql stable security definer set search_path=''
as $$
 select rep.id,m.id,m.room_id,rep.reporter,m.author,m.body,rep.reason,rep.created_at
 from public.game_public_room_reports rep join public.game_public_messages m on m.id=rep.message_id
 where public.game_is_owner() and rep.status='pending'
 order by rep.created_at asc limit 100;
$$;
revoke all on function public.game_owner_chat_reports() from public,anon;
grant execute on function public.game_owner_chat_reports() to authenticated;

create or replace function public.game_owner_review_chat_report(p_report_id bigint,p_hide boolean,p_reason text)
returns boolean language plpgsql security definer set search_path=''
as $$
declare report public.game_public_room_reports%rowtype;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав';end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000 then raise exception 'Причина 10–1000 символов';end if;
 select * into report from public.game_public_room_reports where id=p_report_id for update;
 if not found or report.status<>'pending' then raise exception 'Жалоба уже рассмотрена или не найдена';end if;
 if p_hide then update public.game_public_messages set hidden=true where id=report.message_id;end if;
 update public.game_public_room_reports set status=case when p_hide then 'reviewed' else 'rejected' end where id=p_report_id;
 insert into public.game_admin_audit(actor,action,subject_id,note)
 values((select auth.uid()),case when p_hide then 'chat_report_hidden' else 'chat_report_rejected' end,p_report_id,trim(p_reason));
 return true;
end;$$;
revoke all on function public.game_owner_review_chat_report(bigint,boolean,text) from public,anon;
grant execute on function public.game_owner_review_chat_report(bigint,boolean,text) to authenticated;
commit;