-- Keep duration_seconds readable as a compatibility bucket while making the
-- configured mode duration and actual attempt time explicit for new writes.

alter table public.typing_results
add column if not exists mode_duration_seconds integer;

update public.typing_results
set mode_duration_seconds = duration_seconds
where mode_duration_seconds is null;

alter table public.typing_results
drop constraint if exists typing_results_mode_duration_seconds_bounds;
alter table public.typing_results
add constraint typing_results_mode_duration_seconds_bounds
check (mode_duration_seconds is null or mode_duration_seconds between 1 and 86400) not valid;

create index if not exists typing_results_mode_duration_leaderboard_idx
on public.typing_results (mode_duration_seconds, wpm desc, accuracy desc)
where is_rankable = true;

alter table public.typing_attempt_details
add column if not exists mode_duration_seconds integer,
add column if not exists elapsed_seconds integer;

update public.typing_attempt_details
set
  mode_duration_seconds = coalesce(mode_duration_seconds, duration_seconds),
  elapsed_seconds = coalesce(elapsed_seconds, duration_seconds)
where mode_duration_seconds is null or elapsed_seconds is null;

alter table public.typing_attempt_details
alter column elapsed_seconds set not null;

alter table public.typing_attempt_details
drop constraint if exists typing_attempt_details_mode_duration_seconds_bounds;
alter table public.typing_attempt_details
add constraint typing_attempt_details_mode_duration_seconds_bounds
check (mode_duration_seconds is null or mode_duration_seconds between 1 and 86400) not valid;

alter table public.typing_attempt_details
drop constraint if exists typing_attempt_details_elapsed_seconds_bounds;
alter table public.typing_attempt_details
add constraint typing_attempt_details_elapsed_seconds_bounds
check (elapsed_seconds between 1 and 86400) not valid;

create or replace view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce('@' || profiles.handle, 'Anonymous typist') as display_name,
  typing_results.passage_title,
  passages.category as passage_category,
  typing_results.metric_domain,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.created_at,
  typing_results.mode_duration_seconds,
  typing_results.elapsed_seconds
from public.typing_results
left join public.profiles on profiles.user_id = typing_results.user_id
left join public.passages on passages.id = typing_results.passage_id
where typing_results.is_rankable = true;

create or replace view public.public_profile_typing_results as
select
  profiles.handle,
  typing_results.id,
  typing_results.passage_title,
  passages.category as passage_category,
  typing_results.metric_domain,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.correct_chars,
  typing_results.created_at,
  typing_results.mode_duration_seconds,
  typing_results.elapsed_seconds
from public.typing_results
join public.profiles on profiles.user_id = typing_results.user_id
left join public.passages on passages.id = typing_results.passage_id
where profiles.handle is not null
  and profiles.public_profile_enabled = true
  and typing_results.is_rankable = true;

grant select on public.typing_results_leaderboard to anon, authenticated;
grant select on public.public_profile_typing_results to anon, authenticated;
