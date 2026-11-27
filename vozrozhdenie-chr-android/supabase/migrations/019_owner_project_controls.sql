begin;
create or replace function public.game_owner_projects(p_city_id text)
returns table(project_id bigint,slot integer,title text,required_points bigint,contributed_points bigint,upgrade_level integer)
language sql stable security definer set search_path=''
as $$
 select p.id,p.slot,p.title,p.required_points,p.contributed_points,coalesce(u.upgrade_level,0)
 from public.city_projects p left join public.city_building_upgrades u on u.project_id=p.id
 where public.game_is_owner() and (p_city_id is null or p.city_id=p_city_id)
 order by p.city_id,p.slot limit 1000;
$$;
revoke all on function public.game_owner_projects(text) from public,anon;
grant execute on function public.game_owner_projects(text) to authenticated;

create or replace function public.game_owner_project_action(
 p_project_id bigint,p_action text,p_value text,p_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare project public.city_projects%rowtype; new_value bigint; new_title text;
 result jsonb;
begin
 if not public.game_is_owner() then raise exception 'Недостаточно прав'; end if;
 if length(trim(coalesce(p_reason,'')))<10 or length(p_reason)>1000
 then raise exception 'Причина 10–1000 символов'; end if;
 select * into project from public.city_projects where id=p_project_id for update;
 if not found then raise exception 'Проект не найден'; end if;
 if p_action='rename' then
  new_title:=trim(p_value);
  if length(new_title)<3 or length(new_title)>100 then raise exception 'Название 3–100 символов'; end if;
  update public.city_projects set title=new_title where id=p_project_id;
  result:=jsonb_build_object('before',project.title,'after',new_title);
 elsif p_action='set_cost' then
  begin new_value:=p_value::bigint;exception when others then raise exception 'Неверное число';end;
  if new_value<greatest(project.contributed_points,1) or new_value>1000000000000
  then raise exception 'Стоимость должна быть не ниже внесённых очков и не выше 1 трлн';end if;
  update public.city_projects set required_points=new_value where id=p_project_id;
  result:=jsonb_build_object('before',project.required_points,'after',new_value);
 elsif p_action='complete' then
  update public.city_projects set contributed_points=required_points where id=p_project_id;
  result:=jsonb_build_object('before',project.contributed_points,'after',project.required_points);
 elsif p_action='set_upgrade' then
  if project.contributed_points<project.required_points then raise exception 'Стройка ещё не завершена';end if;
  begin new_value:=p_value::bigint;exception when others then raise exception 'Неверный уровень';end;
  if new_value<1 or new_value>5 then raise exception 'Уровень должен быть 1–5';end if;
  insert into public.city_building_upgrades(project_id,upgrade_level,upgrade_progress,upgraded_at)
  values(p_project_id,new_value::integer,0,now())
  on conflict(project_id) do update set upgrade_level=excluded.upgrade_level,upgrade_progress=0,upgraded_at=now();
  result:=jsonb_build_object('upgrade_level',new_value);
 else raise exception 'Неизвестное действие';end if;
 insert into public.game_admin_audit(actor,action,subject_id,note)
 values((select auth.uid()),'project_'||p_action,p_project_id,
 'reason='||trim(p_reason)||'; result='||result::text);
 return result;
end;$$;
revoke all on function public.game_owner_project_action(bigint,text,text,text) from public,anon;
grant execute on function public.game_owner_project_action(bigint,text,text,text) to authenticated;
commit;