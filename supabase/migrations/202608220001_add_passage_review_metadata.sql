-- Passage provenance and editorial review gate.
-- source_type is deliberately limited to: original work, synthetic text,
-- public-domain material, licensed material, and user-submitted material.

alter table public.passages
  add column if not exists risk_classification text,
  add column if not exists source_type text not null default 'original',
  add column if not exists fictional boolean not null default false,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_notes text,
  add column if not exists review_status text not null default 'draft';

-- Defaults apply only to future rows. Existing production rows are not
-- rewritten or broadly deactivated by this schema migration.
alter table public.passages
  alter column is_active set default false,
  alter column is_public set default false;

alter table public.passages
  drop constraint if exists passages_risk_classification_check,
  add constraint passages_risk_classification_check
    check (risk_classification is null or risk_classification in ('A', 'B', 'C')) not valid,
  drop constraint if exists passages_source_type_check,
  add constraint passages_source_type_check
    check (source_type in ('original', 'synthetic', 'public_domain', 'licensed', 'user_submitted')) not valid,
  drop constraint if exists passages_review_status_check,
  add constraint passages_review_status_check
    check (review_status in ('draft', 'pending_review', 'approved', 'rejected')) not valid,
  drop constraint if exists passages_approval_metadata_check,
  add constraint passages_approval_metadata_check
    check (
      review_status <> 'approved'
      or (coalesce(risk_classification = 'A', false) and reviewed_at is not null)
    ) not valid,
  drop constraint if exists passages_publication_requires_approval,
  add constraint passages_publication_requires_approval
    check (
      not (is_active or is_public)
      or (
        coalesce(risk_classification = 'A', false)
        and review_status = 'approved'
        and reviewed_at is not null
      )
    ) not valid,
  drop constraint if exists passages_public_requires_active,
  add constraint passages_public_requires_active
    check (not is_public or is_active) not valid;

create index if not exists passages_review_status_idx
  on public.passages (review_status, updated_at desc);
create index if not exists passages_risk_classification_idx
  on public.passages (risk_classification)
  where risk_classification is not null;

create or replace function public.enforce_passage_review_gate()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  material_edit boolean;
  explicit_approval boolean;
  explicit_rejection boolean;
  risk_a_invalidated boolean;
begin
  if tg_op = 'UPDATE' then
    material_edit :=
      new.title is distinct from old.title
      or new.content is distinct from old.content
      or new.language is distinct from old.language
      or new.category is distinct from old.category
      or new.style is distinct from old.style
      or new.source_type is distinct from old.source_type;

    -- A fresh reviewed_at value distinguishes the deliberate approval
    -- statement from an ordinary save that merely leaves old approval
    -- metadata untouched. This permits one atomic edit-and-approve update.
    explicit_approval := (
      new.review_status = 'approved'
      and coalesce(new.risk_classification = 'A', false)
      and new.reviewed_at is not null
      and new.reviewed_at is distinct from old.reviewed_at
      and new.is_active = true
      and new.is_public = true
    ) is true;

    -- Rejection is also an explicit private terminal decision, so a reviewer
    -- can atomically save the current draft and reject it without losing notes.
    explicit_rejection := (
      new.review_status = 'rejected'
      and new.reviewed_at is null
      and new.is_active = false
      and new.is_public = false
    ) is true;

    risk_a_invalidated := (
      old.review_status = 'approved'
      and coalesce(old.risk_classification = 'A', false)
      and new.risk_classification is distinct from 'A'
    ) is true;

    if old.review_status = 'approved'
      and (material_edit or risk_a_invalidated)
      and explicit_approval is not true
      and explicit_rejection is not true
    then
      new.review_status := 'pending_review';
      new.reviewed_at := null;
      new.is_active := false;
      new.is_public := false;
    end if;
  end if;

  if (new.is_active or new.is_public) and (
    not coalesce(new.risk_classification = 'A', false)
    or new.review_status is distinct from 'approved'
    or new.reviewed_at is null
  ) then
    raise exception 'Active or public passages require risk A approval and a review timestamp.'
      using errcode = '23514', constraint = 'passages_publication_requires_approval';
  end if;

  if new.is_public and not new.is_active then
    raise exception 'Public passages must also be active.'
      using errcode = '23514', constraint = 'passages_public_requires_active';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_passage_review_gate on public.passages;
create trigger enforce_passage_review_gate
before insert or update on public.passages
for each row
execute function public.enforce_passage_review_gate();

-- Row policies cannot make one column private. Remove broad base-table reads,
-- restore only the non-sensitive columns needed by direct mutation responses,
-- and expose the typing library through a deliberately narrow projection.
revoke select on public.passages from public, anon, authenticated;
grant select (
  id,
  title,
  category,
  style,
  content,
  language,
  is_active,
  is_public,
  created_at,
  updated_at
) on public.passages to anon, authenticated;

create or replace view public.public_passages
with (security_barrier = true, security_invoker = true)
as
select
  passages.id,
  passages.title,
  passages.category,
  passages.style,
  passages.content,
  passages.language,
  passages.is_active,
  passages.is_public,
  passages.created_at,
  passages.updated_at
from public.passages
where passages.is_active = true
  and passages.is_public = true;

revoke all on public.public_passages from public, anon, authenticated;
grant select on public.public_passages to anon, authenticated;

-- Editorial metadata is available only through RPCs that verify the trusted
-- application role. Ordinary authenticated users receive 42501 and cannot
-- select review_notes directly from the base table.
create or replace function public.get_admin_passages()
returns setof public.passages
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return query
  select passages.*
  from public.passages
  order by passages.updated_at desc;
end;
$$;

revoke all on function public.get_admin_passages() from public, anon;
grant execute on function public.get_admin_passages() to authenticated;

create or replace function public.get_admin_passage(target_passage_id uuid)
returns setof public.passages
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required.' using errcode = '42501';
  end if;

  return query
  select passages.*
  from public.passages
  where passages.id = target_passage_id;
end;
$$;

revoke all on function public.get_admin_passage(uuid) from public, anon;
grant execute on function public.get_admin_passage(uuid) to authenticated;

-- Task 2 legacy B-row backfill must use one privileged transaction: lock
-- public.passages, disable this named trigger, drop only the publication
-- approval constraint, update only the reviewed UUID allow-list without
-- changing content or visibility, recreate the constraint NOT VALID, re-enable
-- the trigger, assert the exact affected row set and flags, then commit. This
-- intentionally provides no reusable session flag or broad runtime bypass.
