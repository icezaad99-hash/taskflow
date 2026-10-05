-- Adds assignment/status notifications and enables realtime updates.
-- Safe to rerun; this migration does not write task or profile data.

begin;

alter table public.notifications enable row level security;

drop policy if exists "Allow user read own notifications" on public.notifications;
drop policy if exists "Allow user update own notifications" on public.notifications;
drop policy if exists "TaskFlow active users read own notifications" on public.notifications;
drop policy if exists "TaskFlow active users update own notifications" on public.notifications;

create policy "TaskFlow active users read own notifications" on public.notifications for select to authenticated
    using (user_id = auth.uid() and public.is_taskflow_active_user());

create policy "TaskFlow active users update own notifications" on public.notifications for update to authenticated
    using (user_id = auth.uid() and public.is_taskflow_active_user())
    with check (user_id = auth.uid() and public.is_taskflow_active_user());

create or replace function public.notify_task_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_id uuid;
    recipient_id uuid;
    status_label text;
begin
    actor_id := coalesce(auth.uid(), new.creator_id);

    if tg_op = 'INSERT' then
        if new.assignee_id is not null and new.assignee_id <> actor_id then
            insert into public.notifications (user_id, task_id, type, title, message)
            values (
                new.assignee_id,
                new.id,
                'task_assigned',
                'มีงานใหม่ที่ได้รับมอบหมาย',
                format('คุณได้รับมอบหมายงาน "%s"', new.title)
            );
        end if;
        return new;
    end if;

    if new.assignee_id is distinct from old.assignee_id
        and new.assignee_id is not null
        and new.assignee_id <> actor_id then
        insert into public.notifications (user_id, task_id, type, title, message)
        values (
            new.assignee_id,
            new.id,
            'task_assigned',
            'มีงานใหม่ที่ได้รับมอบหมาย',
            format('คุณได้รับมอบหมายงาน "%s"', new.title)
        );
    end if;

    if new.status is distinct from old.status then
        status_label := case new.status
            when 'todo' then 'รอทำ'
            when 'in_progress' then 'กำลังทำ'
            when 'done' then 'เสร็จแล้ว'
            when 'overdue' then 'งานค้าง'
            else new.status
        end;

        for recipient_id in
            select distinct recipients.user_id
            from (values (new.creator_id), (new.assignee_id)) as recipients(user_id)
            where recipients.user_id is not null
                and recipients.user_id <> actor_id
                and (new.assignee_id is not distinct from old.assignee_id or recipients.user_id <> new.assignee_id)
        loop
            insert into public.notifications (user_id, task_id, type, title, message)
            values (
                recipient_id,
                new.id,
                'task_status_changed',
                'สถานะงานมีการเปลี่ยนแปลง',
                format('งาน "%s" เปลี่ยนสถานะเป็น %s', new.title, status_label)
            );
        end loop;
    end if;

    return new;
end;
$$;

revoke all on function public.notify_task_activity() from public;

drop trigger if exists trigger_notify_task_activity on public.tasks;
create trigger trigger_notify_task_activity
    after insert or update of assignee_id, status on public.tasks
    for each row
    execute function public.notify_task_activity();

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1 from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'notifications'
       ) then
        execute 'alter publication supabase_realtime add table public.notifications';
    end if;
end;
$$;

commit;
