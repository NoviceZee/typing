-- Profile avatar uploads.
-- Creates a public avatars bucket when Supabase Storage is available and
-- restricts writes so authenticated users can only manage files in their own folder.

alter table public.profiles
add column if not exists avatar_path text;

alter table public.profiles
drop constraint if exists profiles_avatar_path_owner_check;

alter table public.profiles
add constraint profiles_avatar_path_owner_check
check (avatar_path is null or avatar_path ~ '^[0-9a-fA-F-]{36}/[^/]+$');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read avatars" on storage.objects;
create policy "Public can read avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists "Users can upload own avatars" on storage.objects;
create policy "Users can upload own avatars"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can update own avatars" on storage.objects;
create policy "Users can update own avatars"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can delete own avatars" on storage.objects;
create policy "Users can delete own avatars"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop view if exists public.public_profile_typing_results;
drop view if exists public.public_profiles;

create view public.public_profiles as
select
  profiles.handle,
  profiles.bio,
  profiles.avatar_style,
  profiles.avatar_path,
  profiles.created_at
from public.profiles
where profiles.handle is not null
  and profiles.public_profile_enabled = true;

create view public.public_profile_typing_results as
select
  profiles.handle,
  typing_results.id,
  typing_results.passage_title,
  passages.category as passage_category,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.correct_chars,
  typing_results.created_at
from public.typing_results
join public.profiles on profiles.user_id = typing_results.user_id
left join public.passages on passages.id = typing_results.passage_id
where profiles.handle is not null
  and profiles.public_profile_enabled = true;

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_profile_typing_results to anon, authenticated;
