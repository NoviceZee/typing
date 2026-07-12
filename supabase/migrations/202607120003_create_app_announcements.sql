create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 2 and 80),
  body text not null check (char_length(trim(body)) between 2 and 280),
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.app_announcements enable row level security;
create policy "Anyone can read active announcements" on public.app_announcements for select to anon, authenticated using (is_active = true and published_at <= now());
grant select on public.app_announcements to anon, authenticated;

insert into public.app_announcements (title, body)
select 'Welcome to the FormalType beta', 'Profile comparisons, expanded themes and account controls are now available.'
where not exists (select 1 from public.app_announcements where title = 'Welcome to the FormalType beta');
