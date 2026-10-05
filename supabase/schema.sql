-- ====================================================================
-- 📌 TaskFlow — Database Schema & Initial Setup for Supabase
-- ====================================================================
-- วิธีใช้งาน:
-- 1. ล็อกอินเข้า Supabase Dashboard (https://supabase.com)
-- 2. ไปที่โปรเจกต์ของคุณ -> เมนูด้านซ้ายเลือก "SQL Editor"
-- 3. คลิก "New query" วางโค้ดทั้งหมดนี้ลงไป แล้วกดปุ่ม "Run" (สีเขียว)
-- ====================================================================

-- 1. ส่วนขยาย (Extensions)
create extension if not exists "uuid-ossp";

-- ====================================================================
-- 2. สร้างตาราง (Tables)
-- ====================================================================

-- 2.1 ตารางทีม / แผนก (Teams)
create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    parent_team_id uuid references public.teams(id) on delete set null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.2 ตารางข้อมูลผู้ใช้ (Profiles) เชื่อมกับ auth.users
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    full_name text not null,
    email text not null,
    role text not null check (role in ('member', 'tl', 'gl', 'mg', 'admin')) default 'member',
    team_id uuid references public.teams(id) on delete set null,
    status text not null check (status in ('pending', 'active', 'inactive')) default 'pending',
    avatar_url text,
    locale text not null check (locale in ('th', 'en')) default 'th',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.3 ตารางหมวดหมู่งาน (Categories)
create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    color text not null default '#3B82F6',
    icon text not null default '📋',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.4 ตารางงาน (Tasks)
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    assignee_id uuid references public.profiles(id) on delete set null,
    creator_id uuid references public.profiles(id) on delete set null,
    category_id uuid references public.categories(id) on delete set null,
    priority text not null check (priority in ('low', 'medium', 'high')) default 'medium',
    status text not null check (status in ('todo', 'in_progress', 'done', 'overdue')) default 'todo',
    due_date date,
    completed_date date,
    notes text,
    is_deleted boolean not null default false,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.5 ตารางคอมเมนต์ในงาน (Comments)
create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.6 ตารางไฟล์แนบ (Attachments)
create table if not exists public.attachments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    file_name text not null,
    file_url text not null,
    file_size integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2.7 ตารางการแจ้งเตือน (Notifications)
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    task_id uuid references public.tasks(id) on delete cascade,
    type text not null check (type in ('task_assigned', 'task_comment', 'task_status_changed', 'task_overdue', 'system')) default 'task_assigned',
    title text not null,
    message text not null,
    is_read boolean not null default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ====================================================================
-- 3. Indexes เพื่อเพิ่มความเร็วในการ Query
-- ====================================================================
create index if not exists idx_tasks_assignee on public.tasks(assignee_id);
create index if not exists idx_tasks_creator on public.tasks(creator_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_is_deleted on public.tasks(is_deleted);
create index if not exists idx_profiles_team on public.profiles(team_id);
create index if not exists idx_teams_parent on public.teams(parent_team_id);
create unique index if not exists idx_profiles_single_admin_role
    on public.profiles(role) where role = 'admin';
create index if not exists idx_comments_task on public.comments(task_id);
create index if not exists idx_attachments_task on public.attachments(task_id);
create index if not exists idx_notifications_user on public.notifications(user_id, is_read);

-- ====================================================================
-- 4. Triggers & Functions (ระบบอัตโนมัติ)
-- ====================================================================

-- 4.1 ฟังก์ชันอัปเดต updated_at อัตโนมัติ
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger trigger_tasks_updated_at
    before update on public.tasks
    for each row
    execute function public.handle_updated_at();

create trigger trigger_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.handle_updated_at();

-- 4.2 ฟังก์ชันสร้าง Profile อัตโนมัติเมื่อมีคนสมัครผ่าน Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
declare
    user_count integer;
    assigned_role text;
    assigned_status text;
begin
    -- นับจำนวนผู้ใช้ที่มีอยู่แล้ว
    select count(*) into user_count from public.profiles;

    -- หากเป็นผู้ใช้คนแรกของระบบ ให้เป็น Admin และอนุมัติทันที (active)
    -- ถ้าเป็นคนถัดไป ให้เป็น member และรอ Admin อนุมัติ (pending)
    if user_count = 0 then
        assigned_role := 'admin';
        assigned_status := 'active';
    else
        assigned_role := 'member';
        assigned_status := 'pending';
    end if;

    insert into public.profiles (id, full_name, email, role, status, locale)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        new.email,
        assigned_role,
        assigned_status,
        'th'
    );
    return new;
end;
$$ language plpgsql security definer;

-- ผูก Trigger กับตาราง auth.users ของ Supabase
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- ตรวจสถานะผู้ใช้และบทบาทโดยไม่เปิดเผยข้อมูล profile ผ่าน policy
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

drop trigger if exists trigger_taskflow_prevent_non_admin_task_reassignment on public.tasks;
drop trigger if exists trigger_taskflow_validate_role_task_update on public.tasks;
create trigger trigger_taskflow_validate_role_task_update
    before update on public.tasks
    for each row
    execute function public.taskflow_validate_role_task_update();

revoke all on function public.is_taskflow_active_user() from public;
revoke all on function public.is_taskflow_admin() from public;
revoke all on function public.taskflow_profile_in_scope(uuid) from public;
revoke all on function public.taskflow_can_manage_task(uuid, uuid) from public;
revoke all on function public.taskflow_can_assign_task(uuid) from public;
revoke all on function public.taskflow_can_trash_task(uuid, uuid) from public;
revoke all on function public.taskflow_can_update_task_assignment(uuid, uuid) from public;
grant execute on function public.is_taskflow_active_user() to authenticated;
grant execute on function public.is_taskflow_admin() to authenticated;
grant execute on function public.taskflow_profile_in_scope(uuid) to authenticated;
grant execute on function public.taskflow_can_manage_task(uuid, uuid) to authenticated;
grant execute on function public.taskflow_can_assign_task(uuid) to authenticated;
grant execute on function public.taskflow_can_trash_task(uuid, uuid) to authenticated;
grant execute on function public.taskflow_can_update_task_assignment(uuid, uuid) to authenticated;

-- Keep the existing administrator active and prevent promoting another account.
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

-- ====================================================================
-- 5. Row Level Security (RLS) ระบบความปลอดภัยของข้อมูล
-- ====================================================================
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.notifications enable row level security;

-- Role values are constrained here to keep the database role enum in sync with the application.
-- Policies scope task access to personal, team, department, or organization permissions.
create policy "Allow authenticated read teams" on public.teams for select to authenticated using (true);
create policy "Allow admin write teams" on public.teams for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

create policy "Allow authenticated read profiles" on public.profiles for select to authenticated using (true);
create policy "TaskFlow admins update profiles" on public.profiles for update to authenticated
    using (public.is_taskflow_admin())
    with check (public.is_taskflow_admin());

create policy "Allow authenticated read categories" on public.categories for select to authenticated using (true);
create policy "Allow admin manage categories" on public.categories for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

drop policy if exists "TaskFlow active users read tasks" on public.tasks;
drop policy if exists "TaskFlow users read tasks in role scope" on public.tasks;
create policy "TaskFlow active users read tasks" on public.tasks for select to authenticated
    using (
        public.is_taskflow_active_user()
        and (
            public.taskflow_profile_in_scope(creator_id)
            or public.taskflow_profile_in_scope(assignee_id)
        )
    );
drop policy if exists "TaskFlow users create own tasks" on public.tasks;
drop policy if exists "TaskFlow users create tasks in role scope" on public.tasks;
create policy "TaskFlow users create own tasks" on public.tasks for insert to authenticated
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
drop policy if exists "TaskFlow admins update tasks" on public.tasks;
drop policy if exists "TaskFlow users manage permitted tasks" on public.tasks;
drop policy if exists "TaskFlow users update permitted tasks" on public.tasks;
drop policy if exists "TaskFlow users update permitted tasks" on public.tasks;
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
drop policy if exists "TaskFlow users delete permitted tasks" on public.tasks;
create policy "TaskFlow users delete permitted tasks" on public.tasks for delete to authenticated
    using (
        public.is_taskflow_active_user()
        and public.taskflow_can_trash_task(creator_id, assignee_id)
    );

drop policy if exists "Allow authenticated read comments" on public.comments;
drop policy if exists "TaskFlow users read visible task comments" on public.comments;
drop policy if exists "Allow authenticated insert comments" on public.comments;
drop policy if exists "TaskFlow users comment on visible tasks" on public.comments;
create policy "TaskFlow users read visible task comments" on public.comments for select to authenticated
    using (exists (select 1 from public.tasks where tasks.id = comments.task_id));
create policy "TaskFlow users comment on visible tasks" on public.comments for insert to authenticated
    with check (user_id = auth.uid() and exists (select 1 from public.tasks where tasks.id = comments.task_id));

drop policy if exists "Allow authenticated read attachments" on public.attachments;
drop policy if exists "TaskFlow users read visible task attachments" on public.attachments;
drop policy if exists "Allow authenticated insert attachments" on public.attachments;
drop policy if exists "TaskFlow users attach files to visible tasks" on public.attachments;
create policy "TaskFlow users read visible task attachments" on public.attachments for select to authenticated
    using (exists (select 1 from public.tasks where tasks.id = attachments.task_id));
create policy "TaskFlow users attach files to visible tasks" on public.attachments for insert to authenticated
    with check (user_id = auth.uid() and exists (select 1 from public.tasks where tasks.id = attachments.task_id));

drop policy if exists "Allow user read own notifications" on public.notifications;
drop policy if exists "Allow user update own notifications" on public.notifications;
drop policy if exists "TaskFlow active users read own notifications" on public.notifications;
create policy "TaskFlow active users read own notifications" on public.notifications for select to authenticated
    using (user_id = auth.uid() and public.is_taskflow_active_user());

drop policy if exists "TaskFlow active users update own notifications" on public.notifications;
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

-- ====================================================================
-- 6. ข้อมูลเริ่มต้น (Default Seed Data)
-- ====================================================================
insert into public.categories (name, color, icon) values
    ('งานประจำวัน', '#3B82F6', '📋'),
    ('แก้ปัญหา / บั๊ก', '#EF4444', '🐛'),
    ('เอกสาร / รายงาน', '#10B981', '📄'),
    ('ประสานงาน', '#F59E0B', '🤝'),
    ('งานด่วน / พิเศษ', '#8B5CF6', '⚡')
on conflict do nothing;

insert into public.teams (name) values
    ('ทีมหลัก / ส่วนกลาง')
on conflict do nothing;
