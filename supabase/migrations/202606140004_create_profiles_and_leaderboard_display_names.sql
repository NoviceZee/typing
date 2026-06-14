-- Public display names for leaderboard rows.
-- Email and raw auth ids stay out of the public leaderboard projection.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as '
begin
  new.updated_at = now();
  return new;
end;
';

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can insert own profile" on public.profiles;
create policy "Authenticated users can insert own profile"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "Authenticated users can read own profile" on public.profiles;
create policy "Authenticated users can read own profile"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can update own profile" on public.profiles;
create policy "Authenticated users can update own profile"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Authenticated users can delete own profile" on public.profiles;
create policy "Authenticated users can delete own profile"
on public.profiles
for delete
to authenticated
using (user_id = auth.uid());

drop view if exists public.typing_results_leaderboard;

create view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce(profiles.display_name, 'Anonymous typist') as display_name,
  typing_results.passage_title,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.created_at
from public.typing_results
left join public.profiles on profiles.user_id = typing_results.user_id;

grant select on public.typing_results_leaderboard to anon, authenticated;
