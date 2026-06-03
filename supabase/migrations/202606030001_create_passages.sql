-- FormalType passage library table.
-- This prepares Supabase storage for passages while the app continues to use
-- localStorage through lib/passageStorage.ts until the migration is enabled.

create extension if not exists pgcrypto;

create table if not exists public.passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  style text,
  content text not null,
  is_active boolean not null default true,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index if not exists passages_is_public_idx on public.passages (is_public);
create index if not exists passages_is_active_idx on public.passages (is_active);
create index if not exists passages_created_by_idx on public.passages (created_by);
create index if not exists passages_updated_at_idx on public.passages (updated_at desc);

create or replace function public.set_passages_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_passages_updated_at on public.passages;
create trigger set_passages_updated_at
before update on public.passages
for each row
execute function public.set_passages_updated_at();

alter table public.passages enable row level security;

-- Public readers can browse public, active passages.
drop policy if exists "Public can read active public passages" on public.passages;
create policy "Public can read active public passages"
on public.passages
for select
using (is_public = true and is_active = true);

-- Signed-in hosts can manage their own rows. The app can tighten this to a
-- dedicated admin role later when FormalType has role metadata in Supabase.
drop policy if exists "Authenticated users can insert own passages" on public.passages;
create policy "Authenticated users can insert own passages"
on public.passages
for insert
to authenticated
with check (created_by = auth.uid());

drop policy if exists "Authenticated users can update own passages" on public.passages;
create policy "Authenticated users can update own passages"
on public.passages
for update
to authenticated
using (created_by = auth.uid())
with check (created_by = auth.uid());

drop policy if exists "Authenticated users can delete own passages" on public.passages;
create policy "Authenticated users can delete own passages"
on public.passages
for delete
to authenticated
using (created_by = auth.uid());
