-- Private per-attempt detail used by Typing Insights across devices.

create table if not exists public.typing_attempt_details (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  typing_result_id uuid references public.typing_results(id) on delete set null,
  completed_at timestamptz not null,
  duration_seconds integer not null check (duration_seconds > 0),
  category text,
  wpm numeric not null check (wpm >= 0),
  accuracy numeric not null check (accuracy >= 0 and accuracy <= 100),
  characters jsonb not null default '[]'::jsonb check (
    jsonb_typeof(characters) = 'array' and jsonb_array_length(characters) <= 1500
  ),
  timeline jsonb not null default '[]'::jsonb check (
    jsonb_typeof(timeline) = 'array' and jsonb_array_length(timeline) <= 120
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists typing_attempt_details_user_completed_idx
on public.typing_attempt_details (user_id, completed_at desc);

alter table public.typing_attempt_details enable row level security;

create policy "Users can read own typing attempt details"
on public.typing_attempt_details for select to authenticated
using (user_id = auth.uid());

create policy "Users can insert own typing attempt details"
on public.typing_attempt_details for insert to authenticated
with check (user_id = auth.uid());

create policy "Users can update own typing attempt details"
on public.typing_attempt_details for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Users can delete own typing attempt details"
on public.typing_attempt_details for delete to authenticated
using (user_id = auth.uid());

grant select, insert, update, delete on public.typing_attempt_details to authenticated;
