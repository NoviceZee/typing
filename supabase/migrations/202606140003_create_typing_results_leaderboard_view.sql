-- Public leaderboard projection.
-- This exposes only result metrics and passage labels; user ids and auth data
-- stay private on the base typing_results table.

create or replace view public.typing_results_leaderboard as
select
  id,
  passage_title,
  duration_seconds,
  wpm,
  accuracy,
  created_at
from public.typing_results;

grant select on public.typing_results_leaderboard to anon, authenticated;
