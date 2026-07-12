alter table public.passages
add column if not exists language text not null default 'english';

alter table public.passages
drop constraint if exists passages_language_check;

alter table public.passages
add constraint passages_language_check check (language in ('english', 'chinese'));

create index if not exists passages_language_idx on public.passages (language);
