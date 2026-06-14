-- Add passage category to the public leaderboard projection.
-- The view stays limited to display names, passage labels, category, timing,
-- and typing metrics. It does not expose auth user ids, emails, or profile rows.

drop view if exists public.typing_results_leaderboard;

create view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce(profiles.display_name, 'Anonymous typist') as display_name,
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
