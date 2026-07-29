-- Account-scoped settings and durable announcement read state.
-- This migration intentionally does not mark existing announcements as read:
-- existing accounts retain a null last_seen value until the client migrates
-- their browser read state or they open the notification panel.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings_version integer not null default 1 check (settings_version > 0),
  settings jsonb not null check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
before update on public.user_settings
for each row
execute function public.set_user_settings_updated_at();

alter table public.user_settings enable row level security;

drop policy if exists "Authenticated users can read own settings" on public.user_settings;
create policy "Authenticated users can read own settings"
on public.user_settings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can insert own settings" on public.user_settings;
create policy "Authenticated users can insert own settings"
on public.user_settings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Authenticated users can update own settings" on public.user_settings;
create policy "Authenticated users can update own settings"
on public.user_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Authenticated users can delete own settings" on public.user_settings;
create policy "Authenticated users can delete own settings"
on public.user_settings
for delete
to authenticated
using (user_id = auth.uid());

revoke all on public.user_settings from public, anon;
grant select, insert, update, delete on public.user_settings to authenticated;

alter table public.profiles
add column if not exists last_seen_announcement_at timestamptz;

create or replace function public.mark_announcements_seen(
  announcement_published_at timestamptz
)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  persisted_timestamp timestamptz;
begin
  update public.profiles
  set last_seen_announcement_at = greatest(
    coalesce(last_seen_announcement_at, '-infinity'::timestamptz),
    announcement_published_at
  )
  where user_id = auth.uid()
  returning last_seen_announcement_at into persisted_timestamp;

  if persisted_timestamp is null then
    raise exception 'Profile row not found for announcement read state'
      using errcode = 'P0002';
  end if;

  return persisted_timestamp;
end;
$$;

revoke all on function public.mark_announcements_seen(timestamptz) from public, anon;
grant execute on function public.mark_announcements_seen(timestamptz) to authenticated;
