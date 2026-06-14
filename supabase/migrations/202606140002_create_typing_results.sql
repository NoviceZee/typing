-- FormalType typing result history.
-- Results are written only for authenticated users after a practice session
-- completes. Anonymous practice remains local-only.

create table if not exists public.typing_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  passage_id uuid references public.passages(id) on delete set null,
  passage_title text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  wpm numeric not null check (wpm >= 0),
  accuracy numeric not null check (accuracy >= 0 and accuracy <= 100),
  correct_chars integer not null check (correct_chars >= 0),
  typed_chars integer not null check (typed_chars >= 0),
  created_at timestamptz not null default now()
);

create index if not exists typing_results_user_created_at_idx on public.typing_results (user_id, created_at desc);
create index if not exists typing_results_passage_id_idx on public.typing_results (passage_id);
create index if not exists typing_results_leaderboard_idx on public.typing_results (duration_seconds, wpm desc, accuracy desc);

alter table public.typing_results enable row level security;

drop policy if exists "Authenticated users can insert own typing results" on public.typing_results;
create policy "Authenticated users can insert own typing results"
on public.typing_results
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Authenticated users can read own typing results" on public.typing_results;
create policy "Authenticated users can read own typing results"
on public.typing_results
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can delete own typing results" on public.typing_results;
create policy "Authenticated users can delete own typing results"
on public.typing_results
for delete
to authenticated
using (user_id = auth.uid());
