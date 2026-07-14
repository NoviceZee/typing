-- Tighten public ranking coherence without putting network work in the typing loop.
-- This still cannot prove that physical keystrokes occurred; it prevents internally
-- inconsistent metrics, client-selected official passage metadata, and stale time-up claims.

create or replace function public.resolve_typing_metric_domain(
  p_passage_category text,
  p_passage_title text,
  p_passage_language text default null
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when lower(coalesce(p_passage_category, '')) = 'training_code'
      or lower(coalesce(p_passage_title, '')) like '%training code%'
      then 'code'
    when lower(coalesce(p_passage_language, '')) = 'chinese'
      then 'chinese'
    when lower(coalesce(p_passage_language, '')) = 'english'
      then 'english'
    when lower(coalesce(p_passage_category, '')) = 'training_chinese'
      or lower(coalesce(p_passage_title, '')) like '%training chinese%'
      or coalesce(p_passage_category, '') = any (array[
        '生活', '工作', '教育', '科技', '文化', '社會', '環境', '健康',
        '香港', '房屋', '土地', '交通', '民生', '養老', '勞工', '財政',
        '醫療', '文言文', '詩詞'
      ])
      then 'chinese'
    else 'english'
  end;
$$;

alter table public.typing_results
add column if not exists metric_domain text;

update public.typing_results
set metric_domain = public.resolve_typing_metric_domain(
  (select passages.category from public.passages where passages.id = typing_results.passage_id),
  typing_results.passage_title,
  (select passages.language from public.passages where passages.id = typing_results.passage_id)
)
where metric_domain is null
   or metric_domain not in ('english', 'chinese', 'code');

alter table public.typing_results
alter column metric_domain set not null,
alter column metric_domain drop default;

alter table public.typing_results
drop constraint if exists typing_results_metric_domain_check;
alter table public.typing_results
add constraint typing_results_metric_domain_check
check (metric_domain in ('english', 'chinese', 'code')) not valid;

alter table public.typing_results
validate constraint typing_results_metric_domain_check;

create index if not exists typing_results_ranked_domain_idx
on public.typing_results (metric_domain, elapsed_seconds, wpm desc, accuracy desc, created_at desc)
where is_rankable = true;

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

create or replace function public.prepare_typing_result_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  passage_category text;
  passage_title text;
  passage_language text;
  passage_rankable boolean := true;
begin
  if auth.uid() is not null then
    if (
      select count(*)
      from public.typing_results
      where typing_results.user_id = auth.uid()
        and typing_results.created_at >= now() - interval '1 minute'
        and typing_results.client_attempt_id <> new.client_attempt_id
    ) >= 20 then
      raise exception 'Too many typing results. Please wait before saving again.' using errcode = 'P0001';
    end if;

    new.user_id := auth.uid();
    new.created_at := now();
  end if;

  if new.passage_id is not null then
    select passages.title, passages.category, passages.language, passages.is_active and passages.is_public
    into passage_title, passage_category, passage_language, passage_rankable
    from public.passages
    where passages.id = new.passage_id;

    if found then
      new.passage_title := passage_title;
      new.metric_domain := public.resolve_typing_metric_domain(passage_category, passage_title, passage_language);
    else
      passage_rankable := false;
    end if;
  end if;

  if new.metric_domain is null or new.metric_domain not in ('english', 'chinese', 'code') then
    new.metric_domain := public.resolve_typing_metric_domain(null, new.passage_title, null);
  end if;

  new.elapsed_seconds := greatest(coalesce(new.elapsed_seconds, new.duration_seconds), 1);
  new.completion_reason := coalesce(new.completion_reason, 'manual');
  new.is_rankable := public.typing_result_is_coherent(
    new.accuracy,
    new.elapsed_seconds,
    new.wpm,
    new.correct_chars,
    new.typed_chars,
    new.duration_seconds,
    new.completion_reason,
    new.metric_domain,
    passage_rankable
  );
  return new;
end;
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

drop view if exists public.typing_results_leaderboard;

create view public.typing_results_leaderboard as
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

drop view if exists public.public_profile_typing_results;

create view public.public_profile_typing_results as
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
