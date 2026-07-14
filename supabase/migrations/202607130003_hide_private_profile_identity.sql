-- Private profiles expose only the handle and visibility state required for
-- an intentional private-profile page. Avatar identity remains private.

drop view if exists public.public_profile_typing_results;
drop view if exists public.public_profiles;

create view public.public_profiles as
select
  profiles.handle,
  case when profiles.public_profile_enabled then profiles.bio else null end as bio,
  case when profiles.public_profile_enabled then profiles.avatar_style else null end as avatar_style,
  case when profiles.public_profile_enabled then profiles.avatar_path else null end as avatar_path,
  profiles.public_profile_enabled,
  case when profiles.public_profile_enabled then profiles.created_at else null end as created_at
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
where profiles.handle is not null
  and profiles.public_profile_enabled = true
  and typing_results.is_rankable = true;

grant select on public.public_profiles to anon, authenticated;
grant select on public.public_profile_typing_results to anon, authenticated;
