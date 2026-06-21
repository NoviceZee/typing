-- Public profile projections.
-- Exposes handles and public-safe typing result fields only.

drop view if exists public.public_profile_typing_results;
drop view if exists public.public_profiles;

create view public.public_profiles as
select
  profiles.handle
from public.profiles
where profiles.handle is not null;

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
where profiles.handle is not null;

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_profile_typing_results to anon, authenticated;
