-- Adds a concurrency-safe database constraint for the single-Admin rule.
-- This migration is safe to rerun and does not modify profile/task rows.

begin;

do $$
declare
    admin_count integer;
    active_admin_count integer;
begin
    select count(*), count(*) filter (where status = 'active')
      into admin_count, active_admin_count
      from public.profiles
     where role = 'admin';

    if admin_count <> 1 or active_admin_count <> 1 then
        raise exception 'Migration stopped: expected exactly one existing active Admin.';
    end if;
end;
$$;

create unique index if not exists idx_profiles_single_admin_role
    on public.profiles(role) where role = 'admin';

commit;