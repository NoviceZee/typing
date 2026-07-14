-- Harden result integrity without removing private legacy history.
-- Public ranking now uses persisted measured time and server-derived eligibility.

alter table public.typing_results
add column if not exists client_attempt_id text;

alter table public.typing_results
add column if not exists elapsed_seconds integer;

alter table public.typing_results
add column if not exists completion_reason text;

alter table public.typing_results
add column if not exists is_rankable boolean;

update public.typing_results
set
  client_attempt_id = coalesce(client_attempt_id, id::text),
  elapsed_seconds = coalesce(elapsed_seconds, duration_seconds),
  completion_reason = coalesce(completion_reason, 'legacy'),
  is_rankable = coalesce(
    is_rankable,
    accuracy >= 70
      and duration_seconds >= 15
      and wpm <= 1000
      and wpm <= ((correct_chars::numeric * 60) / greatest(duration_seconds, 1)) + 0.2
  )
where client_attempt_id is null
   or elapsed_seconds is null
   or completion_reason is null
   or is_rankable is null;

alter table public.typing_results
alter column client_attempt_id set default gen_random_uuid()::text,
alter column client_attempt_id set not null,
alter column elapsed_seconds set default 1,
alter column elapsed_seconds set not null,
alter column completion_reason set default 'manual',
alter column completion_reason set not null,
alter column is_rankable set default false,
alter column is_rankable set not null;

create unique index if not exists typing_results_user_attempt_unique_idx
on public.typing_results (user_id, client_attempt_id);

alter table public.typing_results
drop constraint if exists typing_results_elapsed_seconds_bounds;
alter table public.typing_results
add constraint typing_results_elapsed_seconds_bounds
check (elapsed_seconds between 1 and 86400) not valid;

alter table public.typing_results
drop constraint if exists typing_results_duration_seconds_bounds;
alter table public.typing_results
add constraint typing_results_duration_seconds_bounds
check (duration_seconds between 1 and 86400) not valid;

alter table public.typing_results
drop constraint if exists typing_results_wpm_bounds;
alter table public.typing_results
add constraint typing_results_wpm_bounds
check (wpm between 0 and 1000 and wpm <> 'NaN'::numeric) not valid;

alter table public.typing_results
drop constraint if exists typing_results_character_bounds;
alter table public.typing_results
add constraint typing_results_character_bounds
check (
  correct_chars between 0 and 1000000
  and typed_chars between 0 and 1000000
  and correct_chars <= typed_chars
) not valid;

alter table public.typing_results
drop constraint if exists typing_results_accuracy_bounds;
alter table public.typing_results
add constraint typing_results_accuracy_bounds
check (accuracy between 0 and 100 and accuracy <> 'NaN'::numeric) not valid;

alter table public.typing_results
drop constraint if exists typing_results_title_length_check;
alter table public.typing_results
add constraint typing_results_title_length_check
check (char_length(trim(passage_title)) between 1 and 200) not valid;

alter table public.typing_results
drop constraint if exists typing_results_completion_reason_check;
alter table public.typing_results
add constraint typing_results_completion_reason_check
check (completion_reason in ('time_up', 'text_completed', 'manual', 'legacy')) not valid;

alter table public.typing_results
drop constraint if exists typing_results_attempt_id_length_check;
alter table public.typing_results
add constraint typing_results_attempt_id_length_check
check (client_attempt_id is null or char_length(client_attempt_id) between 8 and 100) not valid;

create or replace function public.prepare_typing_result_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    if (
      select count(*)
      from public.typing_results
      where typing_results.user_id = auth.uid()
        and typing_results.created_at >= now() - interval '1 minute'
    ) >= 20 then
      raise exception 'Too many typing results. Please wait before saving again.' using errcode = 'P0001';
    end if;

    new.user_id := auth.uid();
    new.created_at := now();
  end if;

  new.elapsed_seconds := greatest(coalesce(new.elapsed_seconds, new.duration_seconds), 1);
  new.completion_reason := coalesce(new.completion_reason, 'manual');
  new.is_rankable :=
    new.accuracy >= 70
    and new.elapsed_seconds >= 15
    and new.wpm <= 1000
    and new.wpm <= ((new.correct_chars::numeric * 60) / greatest(new.elapsed_seconds, 1)) + 0.2;
  return new;
end;
$$;

drop trigger if exists prepare_typing_result_insert on public.typing_results;
create trigger prepare_typing_result_insert
before insert on public.typing_results
for each row
execute function public.prepare_typing_result_insert();

drop view if exists public.typing_results_leaderboard;

create view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce('@' || profiles.handle, 'Anonymous typist') as display_name,
  typing_results.passage_title,
  passages.category as passage_category,
  typing_results.elapsed_seconds as duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.created_at
from public.typing_results
left join public.profiles on profiles.user_id = typing_results.user_id
left join public.passages on passages.id = typing_results.passage_id
where typing_results.is_rankable = true;

grant select on public.typing_results_leaderboard to anon, authenticated;
