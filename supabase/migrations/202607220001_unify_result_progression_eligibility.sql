-- Keep competitive and progression eligibility aligned for new and historical rows.
-- Manual results remain private display-only attempts and can never become rankable.

create or replace function public.typing_result_is_coherent(
  p_accuracy numeric,
  p_elapsed_seconds integer,
  p_wpm numeric,
  p_correct_chars integer,
  p_typed_chars integer,
  p_duration_seconds integer,
  p_completion_reason text,
  p_metric_domain text,
  p_passage_rankable boolean
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    coalesce(p_passage_rankable, false)
    and p_completion_reason in ('time_up', 'text_completed', 'legacy')
    and p_accuracy between 70 and 100
    and p_accuracy <> 'NaN'::numeric
    and p_elapsed_seconds between 15 and 86400
    and p_wpm between 0 and 1000
    and p_wpm <> 'NaN'::numeric
    and p_correct_chars between 0 and 1000000
    and p_typed_chars between 1 and 1000000
    and p_correct_chars <= p_typed_chars
    and p_wpm <= (
      case
        when p_metric_domain = 'chinese'
          then (p_correct_chars::numeric * 60) / greatest(p_elapsed_seconds, 1)
        else (p_correct_chars::numeric * 12) / greatest(p_elapsed_seconds, 1)
      end
    ) + 0.2
    and (
      p_completion_reason <> 'time_up'
      or abs(p_elapsed_seconds - p_duration_seconds) <= 2
    );
$$;

update public.typing_results
set is_rankable = public.typing_result_is_coherent(
  typing_results.accuracy,
  typing_results.elapsed_seconds,
  typing_results.wpm,
  typing_results.correct_chars,
  typing_results.typed_chars,
  typing_results.duration_seconds,
  typing_results.completion_reason,
  typing_results.metric_domain,
  typing_results.passage_id is null or coalesce(
    (select passages.is_active and passages.is_public from public.passages where passages.id = typing_results.passage_id),
    false
  )
);

create or replace view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce('@' || profiles.handle, 'Anonymous typist') as display_name,
  typing_results.passage_title,
  passages.category as passage_category,
  typing_results.metric_domain,
  typing_results.elapsed_seconds as duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.created_at
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
  typing_results.elapsed_seconds as duration_seconds,
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

grant select on public.typing_results_leaderboard to anon, authenticated;
grant select on public.public_profile_typing_results to anon, authenticated;
