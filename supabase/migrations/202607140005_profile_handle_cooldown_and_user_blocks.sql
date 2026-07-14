-- Allow deliberate handle changes at most once every 30 days and add
-- interaction-level user blocking. Both rules are enforced in Postgres so
-- modified clients cannot bypass them.

alter table public.profiles
add column if not exists handle_changed_at timestamptz;

create or replace function public.enforce_profile_handle_cooldown()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.handle is not null then
      new.handle_changed_at := now();
    else
      new.handle_changed_at := null;
    end if;
    return new;
  end if;

  if old.handle is distinct from new.handle then
    if old.handle is not null
      and old.handle_changed_at is not null
      and old.handle_changed_at > now() - interval '30 days' then
      raise exception 'Your handle can only be changed once every 30 days.' using errcode = 'P0001';
    end if;
    new.handle_changed_at := now();
  else
    new.handle_changed_at := old.handle_changed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists initialize_profile_handle_changed_at on public.profiles;
create trigger initialize_profile_handle_changed_at
before insert on public.profiles
for each row
execute function public.enforce_profile_handle_cooldown();

drop trigger if exists enforce_profile_handle_change_cooldown on public.profiles;
create trigger enforce_profile_handle_change_cooldown
before update of handle, handle_changed_at on public.profiles
for each row
execute function public.enforce_profile_handle_cooldown();

create or replace function public.change_own_handle(new_handle text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_handle text;
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to change your handle.' using errcode = 'P0001';
  end if;

  clean_handle := lower(trim(new_handle));
  if clean_handle !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Handle must be 3-20 characters using letters, numbers, and underscores only.' using errcode = 'P0001';
  end if;

  update public.profiles
  set handle = clean_handle
  where user_id = auth.uid()
  returning * into updated_profile;

  if updated_profile.user_id is null then
    raise exception 'Profile not found.' using errcode = 'P0001';
  end if;

  return updated_profile;
end;
$$;

revoke execute on function public.change_own_handle(text) from public, anon;
grant execute on function public.change_own_handle(text) to authenticated;

create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocked_id_idx
on public.user_blocks (blocked_id, created_at desc);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can read own blocks" on public.user_blocks;
create policy "Users can read own blocks"
on public.user_blocks
for select
to authenticated
using (blocker_id = auth.uid());

drop policy if exists "Users can create own blocks" on public.user_blocks;
create policy "Users can create own blocks"
on public.user_blocks
for insert
to authenticated
with check (blocker_id = auth.uid() and blocked_id <> auth.uid());

drop policy if exists "Users can remove own blocks" on public.user_blocks;
create policy "Users can remove own blocks"
on public.user_blocks
for delete
to authenticated
using (blocker_id = auth.uid());

revoke all on public.user_blocks from anon, authenticated;

create or replace function public.prevent_blocked_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(new.requester_id::text, new.addressee_id::text) || ':' || greatest(new.requester_id::text, new.addressee_id::text),
      0
    )
  );

  if exists (
    select 1
    from public.user_blocks
    where (blocker_id = new.requester_id and blocked_id = new.addressee_id)
       or (blocker_id = new.addressee_id and blocked_id = new.requester_id)
  ) then
    raise exception 'This profile is unavailable for friend requests.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_blocked_friendship_write on public.friendships;
create trigger prevent_blocked_friendship_write
before insert or update on public.friendships
for each row
execute function public.prevent_blocked_friendship();

create or replace function public.block_user_by_handle(target_handle text)
returns table (handle text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  clean_handle text;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to block a profile.' using errcode = 'P0001';
  end if;

  clean_handle := lower(trim(target_handle));
  select profiles.user_id into target_user_id
  from public.profiles
  where profiles.handle = clean_handle;

  if target_user_id is null then
    raise exception 'Profile not found.' using errcode = 'P0001';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot block your own profile.' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(auth.uid()::text, target_user_id::text) || ':' || greatest(auth.uid()::text, target_user_id::text),
      0
    )
  );

  insert into public.user_blocks (blocker_id, blocked_id)
  values (auth.uid(), target_user_id)
  on conflict (blocker_id, blocked_id) do nothing;

  delete from public.friendships
  where (requester_id = auth.uid() and addressee_id = target_user_id)
     or (requester_id = target_user_id and addressee_id = auth.uid());

  return query
  select profiles.handle, user_blocks.created_at
  from public.user_blocks
  join public.profiles on profiles.user_id = user_blocks.blocked_id
  where user_blocks.blocker_id = auth.uid()
    and user_blocks.blocked_id = target_user_id;
end;
$$;

create or replace function public.unblock_user_by_handle(target_handle text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
  removed_count integer;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to unblock a profile.' using errcode = 'P0001';
  end if;

  select profiles.user_id into target_user_id
  from public.profiles
  where profiles.handle = lower(trim(target_handle));

  if target_user_id is null then
    return false;
  end if;

  delete from public.user_blocks
  where blocker_id = auth.uid()
    and blocked_id = target_user_id;
  get diagnostics removed_count = row_count;
  return removed_count > 0;
end;
$$;

create or replace function public.is_user_blocked_by_handle(target_handle text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_blocks
    join public.profiles on profiles.user_id = user_blocks.blocked_id
    where user_blocks.blocker_id = auth.uid()
      and profiles.handle = lower(trim(target_handle))
  );
$$;

create or replace function public.list_blocked_users()
returns table (handle text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.handle, user_blocks.created_at
  from public.user_blocks
  join public.profiles on profiles.user_id = user_blocks.blocked_id
  where user_blocks.blocker_id = auth.uid()
  order by user_blocks.created_at desc;
$$;

create or replace function public.send_friend_request_by_handle(target_handle text)
returns public.friendships
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_handle text;
  target_user_id uuid;
  friendship_row public.friendships;
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to send friend requests.';
  end if;

  clean_handle := lower(trim(target_handle));
  select profiles.user_id into target_user_id
  from public.profiles
  where profiles.handle = clean_handle;

  if target_user_id is null then
    raise exception 'Profile not found.';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'You cannot add your own profile as a friend.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      least(auth.uid()::text, target_user_id::text) || ':' || greatest(auth.uid()::text, target_user_id::text),
      0
    )
  );

  if exists (
    select 1
    from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = target_user_id)
       or (blocker_id = target_user_id and blocked_id = auth.uid())
  ) then
    raise exception 'This profile is unavailable for friend requests.' using errcode = 'P0001';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), target_user_id, 'pending')
  on conflict do nothing;

  select friendships.* into friendship_row
  from public.friendships
  where (friendships.requester_id = auth.uid() and friendships.addressee_id = target_user_id)
     or (friendships.requester_id = target_user_id and friendships.addressee_id = auth.uid())
  limit 1;

  return friendship_row;
end;
$$;

revoke execute on function public.block_user_by_handle(text) from public, anon;
revoke execute on function public.unblock_user_by_handle(text) from public, anon;
revoke execute on function public.is_user_blocked_by_handle(text) from public, anon;
revoke execute on function public.list_blocked_users() from public, anon;
revoke execute on function public.send_friend_request_by_handle(text) from public, anon;

-- Friend creation must use the guarded RPC above. Existing accept/remove flows
-- retain their narrower update/delete grants and are still checked by RLS.
revoke insert on public.friendships from authenticated;

grant execute on function public.block_user_by_handle(text) to authenticated;
grant execute on function public.unblock_user_by_handle(text) to authenticated;
grant execute on function public.is_user_blocked_by_handle(text) to authenticated;
grant execute on function public.list_blocked_users() to authenticated;
grant execute on function public.send_friend_request_by_handle(text) to authenticated;
