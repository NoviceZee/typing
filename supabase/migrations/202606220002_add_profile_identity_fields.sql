-- Public profile identity fields.
-- Existing profile RLS policies already restrict updates to the owning user.

alter table public.profiles
add column if not exists bio text;

alter table public.profiles
add column if not exists avatar_style text;

alter table public.profiles
add column if not exists public_profile_enabled boolean not null default true;

alter table public.profiles
drop constraint if exists profiles_bio_length_check;

alter table public.profiles
add constraint profiles_bio_length_check
check (bio is null or char_length(trim(bio)) <= 180);

alter table public.profiles
drop constraint if exists profiles_avatar_style_format_check;

alter table public.profiles
add constraint profiles_avatar_style_format_check
check (avatar_style is null or avatar_style ~ '^[a-z0-9_-]{2,24}$');

drop view if exists public.public_profile_typing_results;
drop view if exists public.public_profiles;

create view public.public_profiles as
select
  profiles.handle,
  profiles.bio,
  profiles.avatar_style,
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
