begin;

create or replace function public.is_taskflow_board_lead()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.profiles
        where id = auth.uid()
          and role in ('admin', 'tl')
          and status = 'active'
    );
$$;

revoke all on function public.is_taskflow_board_lead() from public;
grant execute on function public.is_taskflow_board_lead() to authenticated;

do $$
declare
    task_policy record;
begin
    for task_policy in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = 'tasks'
          and cmd in ('SELECT', 'ALL')
          and permissive = 'PERMISSIVE'
    loop
        execute format('drop policy %I on public.tasks', task_policy.policyname);
    end loop;
end;
$$;

create policy "TaskFlow users read visible tasks" on public.tasks for select to authenticated
    using (
        public.is_taskflow_active_user()
        and (
            public.is_taskflow_board_lead()
            or creator_id = auth.uid()
            or assignee_id = auth.uid()
        )
    );

commit;
