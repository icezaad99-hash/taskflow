begin;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
    add constraint profiles_role_check
    check (role in ('member', 'tl', 'gl', 'mg', 'admin'));

create index if not exists idx_profiles_team on public.profiles(team_id);
create index if not exists idx_teams_parent on public.teams(parent_team_id);

create or replace function public.taskflow_profile_in_scope(target_profile_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    viewer_role text;
    viewer_team_id uuid;
    target_team_id uuid;
begin
    select role, team_id into viewer_role, viewer_team_id
    from public.profiles
    where id = auth.uid() and status = 'active';

    if not found then
        return false;
    end if;

    if viewer_role = 'admin' then
        return true;
    end if;

    if target_profile_id = auth.uid() then
        return true;
    end if;

    if target_profile_id is null then
        return false;
    end if;

    select team_id into target_team_id
    from public.profiles
    where id = target_profile_id;

    if target_team_id is null or viewer_team_id is null then
        return false;
    end if;

    if viewer_role = 'tl' then
        return viewer_team_id = target_team_id;
    end if;

    if viewer_role in ('gl', 'mg') then
        return exists (
            with recursive department_teams(id) as (
                select viewer_team_id
                union
                select child.id
                from public.teams child
                join department_teams parent on child.parent_team_id = parent.id
            )
            select 1 from department_teams where id = target_team_id
        );
    end if;

    return false;
end;
$$;

create or replace function public.taskflow_can_manage_task(task_creator_id uuid, task_assignee_id uuid)
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
          )
    );
$$;

create or replace function public.taskflow_prevent_non_admin_task_reassignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is not null
        and not public.is_taskflow_admin()
        and (
            new.creator_id is distinct from old.creator_id
            or new.assignee_id is distinct from old.assignee_id
        ) then
        raise exception 'Only an Admin can change task ownership or assignment.'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

revoke all on function public.taskflow_profile_in_scope(uuid) from public;
revoke all on function public.taskflow_can_manage_task(uuid, uuid) from public;
revoke all on function public.taskflow_prevent_non_admin_task_reassignment() from public;
grant execute on function public.taskflow_profile_in_scope(uuid) to authenticated;
grant execute on function public.taskflow_can_manage_task(uuid, uuid) to authenticated;

drop trigger if exists trigger_taskflow_prevent_non_admin_task_reassignment on public.tasks;
create trigger trigger_taskflow_prevent_non_admin_task_reassignment
    before update of creator_id, assignee_id on public.tasks
    for each row
    execute function public.taskflow_prevent_non_admin_task_reassignment();

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
        and (assignee_id is null or exists (
            select 1 from public.profiles assignee
            where assignee.id = assignee_id and assignee.status = 'active'
        ))
        and (assignee_id is null or public.taskflow_profile_in_scope(assignee_id))
        and (
            public.is_taskflow_admin()
            or status = 'todo'
        )
    );

create policy "TaskFlow users manage permitted tasks" on public.tasks for update to authenticated
    using (
        public.is_taskflow_active_user()
        and public.taskflow_can_manage_task(creator_id, assignee_id)
    )
    with check (
        public.is_taskflow_active_user()
        and public.taskflow_can_manage_task(creator_id, assignee_id)
    );

do $$
declare
    related_policy record;
begin
    for related_policy in
        select policyname, tablename
        from pg_policies
        where schemaname = 'public'
          and tablename in ('comments', 'attachments')
          and cmd in ('SELECT', 'INSERT', 'ALL')
          and permissive = 'PERMISSIVE'
    loop
        execute format('drop policy %I on public.%I', related_policy.policyname, related_policy.tablename);
    end loop;
end;
$$;

create policy "TaskFlow users read visible task comments" on public.comments for select to authenticated
    using (exists (select 1 from public.tasks where tasks.id = comments.task_id));
create policy "TaskFlow users comment on visible tasks" on public.comments for insert to authenticated
    with check (
        user_id = auth.uid()
        and exists (select 1 from public.tasks where tasks.id = comments.task_id)
    );

create policy "TaskFlow users read visible task attachments" on public.attachments for select to authenticated
    using (exists (select 1 from public.tasks where tasks.id = attachments.task_id));
create policy "TaskFlow users attach files to visible tasks" on public.attachments for insert to authenticated
    with check (
        user_id = auth.uid()
        and exists (select 1 from public.tasks where tasks.id = attachments.task_id)
    );

commit;
