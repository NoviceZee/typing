-- Trusted application roles.
-- Roles live outside profiles so users can continue editing their own profile
-- without ever receiving permission to promote themselves.

do $$
begin
  create type public.app_role as enum ('user', 'admin');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_roles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_roles_updated_at on public.user_roles;
create trigger set_user_roles_updated_at
before update on public.user_roles
for each row
execute function public.set_user_roles_updated_at();

alter table public.user_roles enable row level security;

drop policy if exists "Users can read own role" on public.user_roles;
create policy "Users can read own role"
on public.user_roles
for select
to authenticated
using (user_id = auth.uid());

-- No client insert/update/delete policy is intentional. Role changes must pass
-- through the guarded RPC below (or be bootstrapped from the SQL editor).
revoke insert, update, delete on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = auth.uid()
      and user_roles.role = 'admin'::public.app_role
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_user_role(target_user_id uuid, new_role public.app_role)
returns public.user_roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed_role public.user_roles;
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  insert into public.user_roles (user_id, role)
  values (target_user_id, new_role)
  on conflict (user_id) do update
  set role = excluded.role,
      updated_at = now()
  returning * into changed_role;

  return changed_role;
end;
$$;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;

-- Replace the old owner-based passage management policies with true admin
-- policies. Public users retain read access to active, public passages.
drop policy if exists "Authenticated users can read own passages" on public.passages;
drop policy if exists "Authenticated users can insert own passages" on public.passages;
drop policy if exists "Authenticated users can update own passages" on public.passages;
drop policy if exists "Authenticated users can delete own passages" on public.passages;

drop policy if exists "Admins can read all passages" on public.passages;
create policy "Admins can read all passages"
on public.passages
for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can insert passages" on public.passages;
create policy "Admins can insert passages"
on public.passages
for insert
to authenticated
with check (
  public.is_admin()
  and created_by = auth.uid()
);

drop policy if exists "Admins can update passages" on public.passages;
create policy "Admins can update passages"
on public.passages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete passages" on public.passages;
create policy "Admins can delete passages"
on public.passages
for delete
to authenticated
using (public.is_admin());

-- Bootstrap the first admin after applying this migration:
-- insert into public.user_roles (user_id, role)
-- values ('YOUR_AUTH_USER_UUID', 'admin')
-- on conflict (user_id) do update set role = excluded.role;
