begin;
-- Create one text room per construction project. The project remains in its city.
insert into public.game_public_rooms(city_id,project_id,title,kind,enabled)
select p.city_id,p.id,'Стройка №'||p.slot||' · '||p.title,'text',true
from public.city_projects p
where not exists(select 1 from public.game_public_rooms r where r.project_id=p.id and r.kind='text');
create unique index if not exists game_public_project_room_kind_unique
on public.game_public_rooms(project_id,kind) where project_id is not null;
create or replace function public.game_project_chat_room(p_project_id bigint)
returns table(room_id bigint,room_title text,project_title text)
language sql stable security definer set search_path=''
as $$
 select r.id,r.title,p.title from public.game_public_rooms r
 join public.city_projects p on p.id=r.project_id
 join public.city_members m on m.user_id=(select auth.uid())
 join public.cities c on c.id=p.city_id and c.display_name=m.city
 where p.id=p_project_id and r.kind='text' and r.enabled
 limit 1;
$$;
revoke all on function public.game_project_chat_room(bigint) from public,anon;
grant execute on function public.game_project_chat_room(bigint) to authenticated;
commit;