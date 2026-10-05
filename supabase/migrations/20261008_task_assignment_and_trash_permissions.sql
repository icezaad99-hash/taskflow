begin;

create or replace function public.taskflow_can_assign_task(target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    actor_role text;
    actor_team_id uuid;
    target_role text;
    target_team_id uuid;
begin
    select role, team_id into actor_role, actor_team_id
    from public.profiles
    where id = auth.uid() and status = 'active';

    if not found or target_profile_id is null then
        return false;
    end if;

    select role, team_id into target_role, target_team_id
    from public.profiles
    where id = target_profile_id and status = 'active';

    if not found then
        return false;
    end if;

    if actor_role = 'admin' then
        return true;
    end if;

    if actor_role = 'tl' then
        return target_role = 'member'
            and actor_team_id is not null
            and actor_team_id = target_team_id;
    end if;

    if actor_role = 'gl' then
        return target_role in ('tl', 'member')
            and public.taskflow_profile_in_scope(target_profile_id);
    end if;

    return false;
end;
$$;

create or replace function public.taskflow_can_trash_task(task_creator_id uuid, task_assignee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid()
          and status = 'active'
          and (
              role = 'admin'
              or (
                  role = 'member'
                  and (task_creator_id = auth.uid() or task_assignee_id = auth.uid())
              )
              or (
                  role in ('tl', 'gl', 'mg')
                  and task_assignee_id = auth.uid()
              )
          )
    );
$$;

create or replace function public.taskflow_can_update_task_assignment(task_creator_id uuid, task_assignee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid()
          and status = 'active'
          and role in ('tl', 'gl')
          and (
              public.taskflow_profile_in_scope(task_creator_id)
              or public.taskflow_profile_in_scope(task_assignee_id)
          )
    );
$$;

create or replace function public.taskflow_validate_role_task_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_role text;
begin
    if auth.uid() is null or public.is_taskflow_admin() then
        return new;
    end if;

    select role into actor_role
    from public.profiles
    where id = auth.uid() and status = 'active';

    if new.creator_id is distinct from old.creator_id then
        raise exception 'Only an Admin can change task ownership or assignment.'
            using errcode = '42501';
    end if;

    if new.assignee_id is distinct from old.assignee_id then
        if actor_role in ('tl', 'gl')
            and public.taskflow_can_update_task_assignment(old.creator_id, old.assignee_id)
            and (new.assignee_id is null or public.taskflow_can_assign_task(new.assignee_id))
            and (to_jsonb(new) - array['assignee_id', 'updated_at']::text[])
                is not distinct from
               (to_jsonb(old) - array['assignee_id', 'updated_at']::text[]) then
            return new;
        end if;

        raise exception 'Task assignment is outside the current role permissions.'
            using errcode = '42501';
    end if;

    if actor_role in ('tl', 'gl', 'mg') then
        if old.assignee_id is distinct from auth.uid()
            or not public.taskflow_can_trash_task(old.creator_id, old.assignee_id)
            or (to_jsonb(new) - array['is_deleted', 'deleted_at', 'updated_at']::text[])
                is distinct from
               (to_jsonb(old) - array['is_deleted', 'deleted_at', 'updated_at']::text[]) then
            raise exception 'Leaders may only move their personally assigned tasks to or from trash.'
                using errcode = '42501';
        end if;
    end if;

    return new;
end;
$$;

revoke all on function public.taskflow_can_assign_task(uuid) from public;
revoke all on function public.taskflow_can_trash_task(uuid, uuid) from public;
revoke all on function public.taskflow_can_update_task_assignment(uuid, uuid) from public;
revoke all on function public.taskflow_validate_role_task_update() from public;
grant execute on function public.taskflow_can_assign_task(uuid) to authenticated;
grant execute on function public.taskflow_can_trash_task(uuid, uuid) to authenticated;
grant execute on function public.taskflow_can_update_task_assignment(uuid, uuid) to authenticated;

drop trigger if exists trigger_taskflow_prevent_non_admin_task_reassignment on public.tasks;
drop trigger if exists trigger_taskflow_validate_role_task_update on public.tasks;
create trigger trigger_taskflow_validate_role_task_update
    before update on public.tasks
    for each row
    execute function public.taskflow_validate_role_task_update();

do $$
declare
    task_policy record;
begin
    for task_policy in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'tasks'
          and cmd in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
          and permissive = 'PERMISSIVE'
    loop
        execute format('drop policy %I on public.tasks', task_policy.policyname);
    end loop;
end;
$$;

create policy "TaskFlow users read tasks in role scope" on public.tasks for select to authenticated
    using (
        public.is_taskflow_active_user()
        and (
            public.taskflow_profile_in_scope(creator_id)
            or public.taskflow_profile_in_scope(assignee_id)
        )
    );

create policy "TaskFlow users create tasks in role scope" on public.tasks for insert to authenticated
    with check (
        public.is_taskflow_active_user()
        and creator_id = auth.uid()
        and status = 'todo'
        and (assignee_id is null or exists (
            select 1 from public.profiles assignee
            where assignee.id = assignee_id and assignee.status = 'active'
        ))
        and (
            public.is_taskflow_admin()
            or (
                exists (
                    select 1 from public.profiles actor
                    where actor.id = auth.uid()
                      and actor.status = 'active'
                      and actor.role = 'member'
                )
                and (assignee_id is null or assignee_id = auth.uid())
            )
            or (assignee_id is null and exists (
                select 1 from public.profiles actor
                where actor.id = auth.uid()
                  and actor.status = 'active'
                  and actor.role in ('tl', 'gl')
            ))
            or public.taskflow_can_assign_task(assignee_id)
        )
    );

create policy "TaskFlow users update permitted tasks" on public.tasks for update to authenticated
    using (
        public.is_taskflow_active_user()
        and (
            public.taskflow_can_manage_task(creator_id, assignee_id)
            or public.taskflow_can_trash_task(creator_id, assignee_id)
            or public.taskflow_can_update_task_assignment(creator_id, assignee_id)
        )
    )
    with check (
        public.is_taskflow_active_user()
        and (
            public.taskflow_can_manage_task(creator_id, assignee_id)
            or public.taskflow_can_trash_task(creator_id, assignee_id)
            or (
                public.taskflow_can_update_task_assignment(creator_id, assignee_id)
                and (assignee_id is null or public.taskflow_can_assign_task(assignee_id))
            )
        )
    );

create policy "TaskFlow users delete permitted tasks" on public.tasks for delete to authenticated
    using (
        public.is_taskflow_active_user()
        and public.taskflow_can_trash_task(creator_id, assignee_id)
    );

commit;
