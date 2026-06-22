-- Friend request foundation.
-- One row represents a pending request or accepted friendship between two users.

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  check (requester_id <> addressee_id)
);

create unique index if not exists friendships_pair_unique_idx
on public.friendships (
  least(requester_id, addressee_id),
  greatest(requester_id, addressee_id)
);

create index if not exists friendships_requester_status_idx on public.friendships (requester_id, status, created_at desc);
create index if not exists friendships_addressee_status_idx on public.friendships (addressee_id, status, created_at desc);

create or replace function public.set_friendships_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = now();

  if old.status = ''pending'' and new.status = ''accepted'' and new.accepted_at is null then
    new.accepted_at = now();
  end if;

  return new;
end;
';

drop trigger if exists set_friendships_updated_at on public.friendships;
create trigger set_friendships_updated_at
before update on public.friendships
for each row
execute function public.set_friendships_updated_at();

alter table public.friendships enable row level security;

drop policy if exists "Authenticated users can create own friend requests" on public.friendships;
create policy "Authenticated users can create own friend requests"
on public.friendships
for insert
to authenticated
with check (
  requester_id = auth.uid()
  and addressee_id <> auth.uid()
  and status = 'pending'
);

drop policy if exists "Authenticated users can read own friendships" on public.friendships;
create policy "Authenticated users can read own friendships"
on public.friendships
for select
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

drop policy if exists "Authenticated users can accept incoming requests" on public.friendships;
create policy "Authenticated users can accept incoming requests"
on public.friendships
for update
to authenticated
using (
  addressee_id = auth.uid()
  and status = 'pending'
)
with check (
  addressee_id = auth.uid()
  and status = 'accepted'
);

drop policy if exists "Authenticated users can delete own friendships" on public.friendships;
create policy "Authenticated users can delete own friendships"
on public.friendships
for delete
to authenticated
using (requester_id = auth.uid() or addressee_id = auth.uid());

grant select, insert, delete on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

create or replace function public.send_friend_request_by_handle(target_handle text)
returns public.friendships
language plpgsql
security definer
set search_path = public
as '
declare
  clean_handle text;
  target_user_id uuid;
  friendship_row public.friendships;
begin
  if auth.uid() is null then
    raise exception ''You must be logged in to send friend requests.'';
  end if;

  clean_handle := lower(trim(target_handle));

  select profiles.user_id
  into target_user_id
  from public.profiles
  where profiles.handle = clean_handle;

  if target_user_id is null then
    raise exception ''Profile not found.'';
  end if;

  if target_user_id = auth.uid() then
    raise exception ''You cannot add your own profile as a friend.'';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (auth.uid(), target_user_id, ''pending'')
  on conflict do nothing;

  select friendships.*
  into friendship_row
  from public.friendships
  where (
    friendships.requester_id = auth.uid()
    and friendships.addressee_id = target_user_id
  )
  or (
    friendships.requester_id = target_user_id
    and friendships.addressee_id = auth.uid()
  )
  limit 1;

  return friendship_row;
end;
';

create or replace function public.list_friendships(request_status text, request_direction text default 'any')
returns table (
  id uuid,
  user_id uuid,
  handle text,
  status text,
  direction text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as '
  select
    friendships.id,
    case
      when friendships.requester_id = auth.uid() then friendships.addressee_id
      else friendships.requester_id
    end as user_id,
    profiles.handle,
    friendships.status,
    case
      when friendships.status = ''accepted'' then ''accepted''
      when friendships.requester_id = auth.uid() then ''outgoing''
      else ''incoming''
    end as direction,
    friendships.created_at,
    friendships.updated_at
  from public.friendships
  join public.profiles
    on profiles.user_id = case
      when friendships.requester_id = auth.uid() then friendships.addressee_id
      else friendships.requester_id
    end
  where auth.uid() is not null
    and (friendships.requester_id = auth.uid() or friendships.addressee_id = auth.uid())
    and friendships.status = request_status
    and (
      request_direction = ''any''
      or (request_direction = ''incoming'' and friendships.addressee_id = auth.uid())
      or (request_direction = ''outgoing'' and friendships.requester_id = auth.uid())
    )
  order by friendships.updated_at desc;
';

create or replace function public.get_friendship_with_handle(target_handle text)
returns table (
  id uuid,
  user_id uuid,
  handle text,
  status text,
  direction text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as '
  select
    friendships.id,
    profiles.user_id,
    profiles.handle,
    friendships.status,
    case
      when friendships.status = ''accepted'' then ''accepted''
      when friendships.requester_id = auth.uid() then ''outgoing''
      else ''incoming''
    end as direction,
    friendships.created_at,
    friendships.updated_at
  from public.profiles
  join public.friendships
    on (
      friendships.requester_id = auth.uid()
      and friendships.addressee_id = profiles.user_id
    )
    or (
      friendships.addressee_id = auth.uid()
      and friendships.requester_id = profiles.user_id
    )
  where auth.uid() is not null
    and profiles.handle = lower(trim(target_handle))
  limit 1;
';

revoke execute on function public.send_friend_request_by_handle(text) from public, anon;
revoke execute on function public.list_friendships(text, text) from public, anon;
revoke execute on function public.get_friendship_with_handle(text) from public, anon;

grant execute on function public.send_friend_request_by_handle(text) to authenticated;
grant execute on function public.list_friendships(text, text) to authenticated;
grant execute on function public.get_friendship_with_handle(text) to authenticated;
