-- Review the result first. It must identify the intended account as the only Admin.
-- select id, email, status from public.profiles where role = 'admin';
-- This file is prepared for review and is not applied automatically.

begin;

do $$
declare
    admin_count integer;
    active_admin_count integer;
    unexpected_policies text;
begin
    select count(*), count(*) filter (where status = 'active')
      into admin_count, active_admin_count
      from public.profiles
     where role = 'admin';

    if admin_count <> 1 or active_admin_count <> 1 then
        raise exception 'Migration stopped: expected exactly one existing active Admin. Review profiles before applying.';
    end if;

    select string_agg(format('%s.%s (%s)', tablename, policyname, cmd), ', ')
      into unexpected_policies
      from pg_policies
     where schemaname = 'public'
       and (
            (tablename = 'profiles'
             and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
             and policyname not in (
                 'Allow users update own profile',
                 'Allow admin manage profiles',
                 'TaskFlow admins update profiles'
             ))
         or (tablename = 'tasks'
             and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
             and policyname not in (
                 'Allow authenticated create tasks',
                 'Allow authenticated update tasks',
                 'Allow authenticated delete tasks',
                 'TaskFlow users create own tasks',
                 'TaskFlow admins update tasks'
             ))
       );

    if unexpected_policies is not null then
        raise exception 'Migration stopped: review additional write policies before continuing: %', unexpected_policies;
    end if;
end;
$$;

create unique index if not exists idx_profiles_single_admin_role
    on public.profiles(role) where role = 'admin';

create or replace function public.is_taskflow_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and status = 'active'
    );
$$;

create or replace function public.is_taskflow_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin' and status = 'active'
    );
$$;

revoke all on function public.is_taskflow_active_user() from public;
revoke all on function public.is_taskflow_admin() from public;
grant execute on function public.is_taskflow_active_user() to authenticated;
grant execute on function public.is_taskflow_admin() to authenticated;

create or replace function public.prevent_additional_taskflow_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if old.role = 'admin' and (new.role <> 'admin' or new.status <> 'active') then
        raise exception 'The sole TaskFlow admin must remain active and retain the admin role.'
            using errcode = '42501';
    end if;

    if old.role <> 'admin' and new.role = 'admin' then
        raise exception 'TaskFlow does not allow creating an additional admin.'
            using errcode = '42501';
    end if;

    return new;
end;
$$;

drop trigger if exists trigger_prevent_additional_taskflow_admin on public.profiles;
create trigger trigger_prevent_additional_taskflow_admin
    before update of role, status on public.profiles
    for each row
    execute function public.prevent_additional_taskflow_admin();

drop policy if exists "Allow users update own profile" on public.profiles;
drop policy if exists "Allow admin manage profiles" on public.profiles;
drop policy if exists "TaskFlow admins update profiles" on public.profiles;
create policy "TaskFlow admins update profiles" on public.profiles for update to authenticated
    using (public.is_taskflow_admin())
    with check (public.is_taskflow_admin());

drop policy if exists "Allow authenticated read tasks" on public.tasks;
drop policy if exists "Allow authenticated create tasks" on public.tasks;
drop policy if exists "Allow authenticated update tasks" on public.tasks;
drop policy if exists "Allow authenticated delete tasks" on public.tasks;
drop policy if exists "TaskFlow active users read tasks" on public.tasks;
drop policy if exists "TaskFlow users create own tasks" on public.tasks;
drop policy if exists "TaskFlow admins update tasks" on public.tasks;

create policy "TaskFlow active users read tasks" on public.tasks for select to authenticated
    using (public.is_taskflow_active_user());
create policy "TaskFlow users create own tasks" on public.tasks for insert to authenticated
    with check (
        public.is_taskflow_active_user()
        and creator_id = auth.uid()
        and (assignee_id is null or exists (
            select 1 from public.profiles assignee
            where assignee.id = assignee_id and assignee.status = 'active'
        ))
        and (
            public.is_taskflow_admin()
            or (
                status = 'todo'
                and (
                    assignee_id is null
                    or assignee_id = auth.uid()
                    or exists (
                        select 1 from public.profiles creator
                        where creator.id = auth.uid()
                          and creator.role in ('mg', 'gl', 'tl')
                          and creator.status = 'active'
                    )
                )
            )
        )
    );
create policy "TaskFlow admins update tasks" on public.tasks for update to authenticated
    using (public.is_taskflow_admin())
    with check (public.is_taskflow_admin());

commit;