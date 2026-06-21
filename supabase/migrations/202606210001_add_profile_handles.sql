-- Unique public handles for leaderboards, friends, and profile URLs.
-- Handles are public; emails and auth ids stay out of public projections.

alter table public.profiles
add column if not exists handle text;

alter table public.profiles
drop constraint if exists profiles_handle_format_check;

alter table public.profiles
add constraint profiles_handle_format_check
check (
  handle is null
  or (
    handle = lower(handle)
    and char_length(handle) between 3 and 20
    and handle ~ '^[a-z0-9_]+$'
  )
);

create unique index if not exists profiles_handle_lower_unique_idx
on public.profiles (lower(handle))
where handle is not null;

drop view if exists public.typing_results_leaderboard;

create view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce('@' || profiles.handle, profiles.display_name, 'Anonymous typist') as display_name,
  typing_results.passage_title,
  passages.category as passage_category,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.created_at
from public.typing_results
left join public.profiles on profiles.user_id = typing_results.user_id
left join public.passages on passages.id = typing_results.passage_id;

grant select on public.typing_results_leaderboard to anon, authenticated;
