import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const UUID_NAMESPACE = "8c9f6cf2-bc8f-5afe-9fc0-c4b90f14d9a7";
const REVIEWED_AT = "2026-08-22T10:00:00.000Z";
const CORPUS_VERSION = "neutral-replacements-v1";
const draftPaths = [
  "outputs/corpus-remediation/drafts/chinese-01-27.json",
  "outputs/corpus-remediation/drafts/chinese-28-54.json",
  "outputs/corpus-remediation/drafts/english-01-09.json"
];
const corpusPath = "outputs/corpus-remediation/replacement-corpus-v1.json";
const migrationPath = "supabase/migrations/202608220002_replace_c_rated_passages.sql";
const englishV2MigrationPath = "supabase/migrations/202608090001_english_corpus_v2.sql";

const bRatedIds = [
  "a444442e-3eca-508e-94e9-fd0c108fa6d3",
  "8fb8f511-cc01-5a23-830c-653fd93ca848",
  "04d4ea10-75c4-5c2c-9bea-3b2447b90fc8",
  "54915d56-da5d-5013-a7d5-88b5646405ba",
  "716cb320-8056-51b0-b22f-ddd2e49df226",
  "a14c4991-6e14-510b-b81b-203c57490b39",
  "a892ac88-6631-5fb9-bbf6-43003572a2ce",
  "b6799906-7710-5b98-ad40-b75049d013cb",
  "91bc7bc1-7a43-5731-a453-12487414bd44",
  "3dcb3cfa-2e67-5b59-b7d7-635f78002b3a",
  "3dd4d7ef-252e-4502-a683-e3c26cd6959d",
  "7f239e87-924f-5a8d-8265-c3bd64f8920c",
  "7eb700d0-3a00-56c0-b5de-27cf22e82101",
  "56ab756e-b97e-44aa-8658-2c893aed52f9",
  "20030528-60b9-475b-905d-d29ad44f3b98",
  "900b19ba-1ed0-5b18-8887-e4f382bf162e",
  "283bca77-6486-4a0a-92a2-9209a9c48492",
  "0469c41f-db8d-5a9c-8d3c-a54c2adf6b6e",
  "a66bcad1-3b90-4ca0-8c8b-861987e1e11f",
  "0162ba87-0977-5fe2-8bf7-d9dbe7f45787",
  "cb97e3f3-7060-5a5c-a5d3-261866b9a1b9",
  "74f1dcf1-96c8-559a-b59c-69f896326eb1",
  "51a96dec-ed47-5ec0-b7e0-333c43da3331"
];

function uuidV5(namespace, name) {
  const namespaceBytes = Buffer.from(namespace.replaceAll("-", ""), "hex");
  const digest = createHash("sha1").update(namespaceBytes).update(name).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const value = digest.subarray(0, 16).toString("hex");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function loadDrafts() {
  const passages = draftPaths.flatMap((path) => JSON.parse(readFileSync(path, "utf8")));
  if (passages.length !== 63) throw new Error(`Expected 63 draft passages, found ${passages.length}.`);
  if (passages.filter((passage) => passage.language === "chinese").length !== 54) {
    throw new Error("Expected 54 Chinese draft passages.");
  }
  if (passages.filter((passage) => passage.language === "english").length !== 9) {
    throw new Error("Expected 9 English draft passages.");
  }
  for (const key of ["oldId", "title"]) {
    if (new Set(passages.map((passage) => passage[key])).size !== passages.length) {
      throw new Error(`Draft ${key} values must be unique.`);
    }
  }
  const oldIds = new Set(passages.map((passage) => passage.oldId));
  if (bRatedIds.some((id) => oldIds.has(id))) throw new Error("C-rated and B-rated ID sets overlap.");
  for (const passage of passages) {
    const expectedUnit = passage.language === "chinese" ? "characters" : "words";
    const count = expectedUnit === "characters"
      ? Array.from(passage.content).length
      : passage.content.trim().split(/\s+/u).filter(Boolean).length;
    if (passage.unit !== expectedUnit || count < passage.min || count > passage.max) {
      throw new Error(`${passage.title} has ${count} ${expectedUnit}; expected ${passage.min}-${passage.max}.`);
    }
    if (passage.content !== passage.content.trim()) throw new Error(`${passage.title} has outer whitespace.`);
    if (passage.verification !== "no" && (!Array.isArray(passage.sources) || passage.sources.length === 0)) {
      throw new Error(`${passage.title} requires an authoritative source note.`);
    }
    for (const source of passage.sources ?? []) {
      if (!source.url.startsWith("https://") || !source.note?.trim()) {
        throw new Error(`${passage.title} has an invalid source note.`);
      }
    }
  }
  return passages.map((passage) => {
    const sources = passage.sources ?? [];
    const reviewNotes = sources.length === 0
      ? "Original neutral replacement; no external factual verification required."
      : `Original neutral replacement; factual claims checked against: ${sources.map((source) => `${source.note} ${source.url}`).join(" | ")}`;
    return {
      ...passage,
      newId: uuidV5(UUID_NAMESPACE, `typing-station:corpus-remediation-v1:${passage.oldId}`),
      sourceType: "synthetic",
      riskClassification: "A",
      reviewStatus: "approved",
      reviewedAt: REVIEWED_AT,
      reviewNotes,
      sha256: sha256(passage.content)
    };
  });
}

function extractEnglishV2Rows(sql) {
  const pattern = /\('([^']+)', '([0-9a-f-]+)'::uuid, (true|false), '((?:''|[^'])*)', '((?:''|[^'])*)', '((?:''|[^'])*)', '([0-9a-f]{64})', \$ecv2\$([\s\S]*?)\$ecv2\$\)(?:,|;)/g;
  return new Map(Array.from(sql.matchAll(pattern), (match) => [
    match[2],
    {
      title: match[4].replaceAll("''", "'"),
      category: match[5].replaceAll("''", "'"),
      style: match[6].replaceAll("''", "'"),
      sha256: match[7],
      content: match[8]
    }
  ]));
}

function renderReplacementRows(passages) {
  return passages.map((passage, index) => {
    const tag = `replacement_${String(index + 1).padStart(3, "0")}`;
    if (passage.content.includes(`$${tag}$`)) throw new Error(`Content collides with SQL tag ${tag}.`);
    return `  (${sqlString(passage.oldId)}::uuid, ${sqlString(passage.newId)}::uuid, ${sqlString(passage.oldTitle)}, ${sqlString(passage.title)}, ${sqlString(passage.category)}, ${sqlString(passage.style)}, ${sqlString(passage.language)}, ${passage.min}, ${passage.max}, ${sqlString(passage.unit)}, ${sqlString(passage.verification)}, ${sqlString(passage.sourceType)}, ${passage.fictional}, ${sqlString(passage.reviewedAt)}::timestamptz, ${sqlString(passage.reviewNotes)}, ${sqlString(passage.sha256)}, $${tag}$${passage.content}$${tag}$)`;
  }).join(",\n");
}

function renderBGuardRows(sourceRows) {
  return bRatedIds.map((id) => {
    const row = sourceRows.get(id);
    if (!row) throw new Error(`B-rated passage ${id} is absent from English Corpus v2.`);
    if (sha256(row.content) !== row.sha256) throw new Error(`B-rated source hash drift for ${id}.`);
    return `  ('${id}'::uuid, decode('${Buffer.from(row.content, "utf8").toString("hex")}', 'hex'))`;
  }).join(",\n");
}

function renderMigration(passages, sourceRows) {
  return `begin;

-- Neutral replacement corpus v1. Generated by scripts/buildCorpusRemediationMigration.mjs.
-- The transaction aborts on any preflight/postflight mismatch; old rows and all
-- historical references remain present. The permanent map makes the cutover auditable.

-- Lock result writes first: their insert trigger reads passages. Taking these
-- final lock modes in dependency order avoids a typing-results/passages cycle.
lock table public.typing_results in access exclusive mode;
lock table public.passages in access exclusive mode;

create table if not exists public.passage_replacement_map (
  old_passage_id uuid primary key references public.passages(id) on delete restrict,
  new_passage_id uuid not null unique references public.passages(id) on delete restrict,
  corpus_version text not null,
  old_title text not null,
  new_title text not null,
  cutover_at timestamptz not null
);
alter table public.passage_replacement_map enable row level security;

create temp table typing_station_corpus_replacements (
  old_id uuid primary key,
  new_id uuid not null unique,
  old_title text not null unique,
  new_title text not null unique,
  category text not null,
  style text not null,
  language text not null check (language in ('chinese', 'english')),
  target_min integer not null,
  target_max integer not null,
  target_unit text not null,
  verification text not null,
  source_type text not null,
  fictional boolean not null,
  reviewed_at timestamptz not null,
  review_notes text not null,
  sha256 text not null,
  content text not null
) on commit drop;

insert into typing_station_corpus_replacements
  (old_id, new_id, old_title, new_title, category, style, language, target_min, target_max,
   target_unit, verification, source_type, fictional, reviewed_at, review_notes, sha256, content)
values
${renderReplacementRows(passages)};

create temp table typing_station_b_guard (
  id uuid primary key,
  content_bytes bytea not null
) on commit drop;

-- BEGIN B-RATED BYTE GUARD
insert into typing_station_b_guard (id, content_bytes) values
${renderBGuardRows(sourceRows)};
-- END B-RATED BYTE GUARD

do $preflight$
declare
  seed_total integer;
  seed_chinese integer;
  seed_english integer;
  seed_range_mismatch integer;
  old_mismatch integer;
  new_id_collisions integer;
  new_title_collisions integer;
  existing_map_collisions integer;
  b_mismatch integer;
begin
  select count(*), count(*) filter (where language = 'chinese'), count(*) filter (where language = 'english')
    into seed_total, seed_chinese, seed_english
  from typing_station_corpus_replacements;

  select count(*) into seed_range_mismatch
  from typing_station_corpus_replacements seed
  where case
      when seed.language = 'chinese' then char_length(seed.content)
      else cardinality(regexp_split_to_array(btrim(seed.content), '[[:space:]]+'))
    end not between seed.target_min and seed.target_max
    or seed.target_unit is distinct from case
      when seed.language = 'chinese' then 'characters'
      else 'words'
    end;

  select count(*) into old_mismatch
  from typing_station_corpus_replacements seed
  left join public.passages passage on passage.id = seed.old_id
  where passage.id is null
    or passage.title is distinct from seed.old_title
    or passage.language is distinct from seed.language
    or passage.is_active is distinct from true
    or passage.is_public is distinct from true;

  select count(*) into new_id_collisions
  from typing_station_corpus_replacements seed
  join public.passages passage on passage.id = seed.new_id;

  select count(*) into new_title_collisions
  from typing_station_corpus_replacements seed
  join public.passages passage on passage.title = seed.new_title;

  select count(*) into existing_map_collisions
  from typing_station_corpus_replacements seed
  join public.passage_replacement_map mapping
    on mapping.old_passage_id = seed.old_id or mapping.new_passage_id = seed.new_id;

  select count(*) into b_mismatch
  from typing_station_b_guard guard
  left join public.passages passage on passage.id = guard.id
  where passage.id is null
    or passage.language is distinct from 'english'
    or passage.is_active is distinct from true
    or passage.is_public is distinct from true
    or convert_to(passage.content, 'UTF8') is distinct from guard.content_bytes;

  if seed_total <> 63 or seed_chinese <> 54 or seed_english <> 9
    or seed_range_mismatch <> 0
    or old_mismatch <> 0 or new_id_collisions <> 0 or new_title_collisions <> 0
    or existing_map_collisions <> 0 or b_mismatch <> 0
  then
    raise exception 'Corpus remediation preflight failed: seed % (Chinese %, English %), range mismatch %, old mismatch %, new ID collisions %, title collisions %, map collisions %, B mismatch %',
      seed_total, seed_chinese, seed_english, seed_range_mismatch, old_mismatch, new_id_collisions,
      new_title_collisions, existing_map_collisions, b_mismatch;
  end if;
end
$preflight$;

-- Snapshot category on each result before the old passage rows become private.
-- Official passage-backed results take their category from the server row;
-- unlinked/generated results retain a supplied category or use a safe fallback.
alter table public.typing_results
  add column if not exists passage_category text;

update public.typing_results typing_results
set passage_category = coalesce(
  nullif(btrim(passages.category), ''),
  nullif(btrim(typing_results.passage_category), ''),
  'Uncategorised'
)
from public.passages passages
where passages.id = typing_results.passage_id;

update public.typing_results
set passage_category = 'Uncategorised'
where passage_category is null or btrim(passage_category) = '';

alter table public.typing_results
  alter column passage_category set not null,
  alter column passage_category set default 'Uncategorised';

create index if not exists typing_results_ranked_category_idx
  on public.typing_results (passage_category, mode_duration_seconds, wpm desc, accuracy desc)
  where is_rankable = true;

do $historical_category_backfill$
begin
  if exists (
    select 1
    from public.typing_results typing_results
    join typing_station_corpus_replacements stage
      on typing_results.passage_id = stage.old_id
    join public.passages passages on passages.id = stage.old_id
    where typing_results.passage_category is distinct from
      coalesce(nullif(btrim(passages.category), ''), 'Uncategorised')
  ) then
    raise exception 'Historical typing-result category backfill failed for a C-rated passage.';
  end if;
end
$historical_category_backfill$;

create temp table typing_station_historical_result_guard on commit drop as
select
  typing_results.id,
  typing_results.passage_id,
  typing_results.passage_title,
  typing_results.passage_category
from public.typing_results typing_results
join typing_station_corpus_replacements stage
  on typing_results.passage_id = stage.old_id;

-- Keep the canonical insert trigger authoritative for official passage
-- metadata while preserving the existing ownership/rate/coherence boundary.
create or replace function public.prepare_typing_result_insert()
returns trigger
language plpgsql
set search_path = ''
as $typing_result_insert$
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
      new.passage_category := passage_category;
      new.metric_domain := public.resolve_typing_metric_domain(passage_category, passage_title, passage_language);
    else
      passage_rankable := false;
    end if;
  end if;

  new.passage_category := coalesce(nullif(btrim(new.passage_category), ''), 'Uncategorised');

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
$typing_result_insert$;

create or replace view public.typing_results_leaderboard as
select
  typing_results.id,
  coalesce('@' || profiles.handle, 'Anonymous typist') as display_name,
  typing_results.passage_title,
  typing_results.passage_category,
  typing_results.metric_domain,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.created_at,
  typing_results.mode_duration_seconds,
  typing_results.elapsed_seconds
from public.typing_results
left join public.profiles on profiles.user_id = typing_results.user_id
where typing_results.is_rankable = true;

create or replace view public.public_profile_typing_results as
select
  profiles.handle,
  typing_results.id,
  typing_results.passage_title,
  typing_results.passage_category,
  typing_results.metric_domain,
  typing_results.duration_seconds,
  typing_results.wpm,
  typing_results.accuracy,
  typing_results.correct_chars,
  typing_results.created_at,
  typing_results.mode_duration_seconds,
  typing_results.elapsed_seconds
from public.typing_results
join public.profiles on profiles.user_id = typing_results.user_id
where profiles.handle is not null
  and profiles.public_profile_enabled = true
  and typing_results.is_rankable = true;

grant select on public.typing_results_leaderboard to anon, authenticated;
grant select on public.public_profile_typing_results to anon, authenticated;

-- Dynamic snapshots guard every pre-existing prose byte, including A, B,
-- classical Chinese, poetry, and the C-rated rows whose visibility will change.
create temp table typing_station_preserved_passage_guard on commit drop as
select passage.id, passage.title, passage.category, passage.style, passage.language,
  passage.is_active, passage.is_public, convert_to(passage.content, 'UTF8') as content_bytes
from public.passages passage
where not exists (
  select 1 from typing_station_corpus_replacements seed where seed.old_id = passage.id
);

create temp table typing_station_old_c_content_guard on commit drop as
select passage.id, passage.title, passage.category, passage.style, passage.language,
  convert_to(passage.content, 'UTF8') as content_bytes
from public.passages passage
join typing_station_corpus_replacements seed on seed.old_id = passage.id;

create temp table typing_station_b_runtime_guard on commit drop as
select passage.id, passage.is_active, passage.is_public
from public.passages passage
join typing_station_b_guard guard on guard.id = passage.id;

-- Backfill only established live/public rows outside the exact C and B sets.
-- This changes review metadata only; the snapshots above guard prose and runtime state.
update public.passages passage
set risk_classification = 'A',
  review_status = 'approved',
  reviewed_at = '${REVIEWED_AT}'::timestamptz,
  review_notes = coalesce(passage.review_notes, 'Established live/public corpus row backfilled as A; prose and runtime state unchanged.')
where passage.is_active and passage.is_public
  and not exists (select 1 from typing_station_corpus_replacements seed where seed.old_id = passage.id)
  and not exists (select 1 from typing_station_b_guard guard where guard.id = passage.id);

-- Stage approved replacements privately before the atomic visibility swap.
insert into public.passages
  (id, title, category, style, content, language, is_active, is_public,
   risk_classification, source_type, fictional, reviewed_at, review_notes, review_status)
select seed.new_id, seed.new_title, seed.category, seed.style, seed.content, seed.language, false, false,
  'A', seed.source_type, seed.fictional, seed.reviewed_at, seed.review_notes, 'approved'
from typing_station_corpus_replacements seed;

insert into public.passage_replacement_map
  (old_passage_id, new_passage_id, corpus_version, old_title, new_title, cutover_at)
select seed.old_id, seed.new_id, '${CORPUS_VERSION}', seed.old_title, seed.new_title, now()
from typing_station_corpus_replacements seed;

-- Classify and preserve the 23 reviewed B rows without changing their content,
-- titles, categories, styles, language, or active/public runtime state. The table
-- lock and named, one-use bypass prevent concurrent writes during grandfathering.
alter table public.passages disable trigger enforce_passage_review_gate;
alter table public.passages drop constraint if exists passages_publication_requires_approval;

update public.passages passage
set risk_classification = 'B'
from typing_station_b_guard guard
where passage.id = guard.id;

alter table public.passages
  add constraint passages_publication_requires_approval
    check (
      not (is_active or is_public)
      or (
        coalesce(risk_classification = 'A', false)
        and review_status = 'approved'
        and reviewed_at is not null
      )
    ) not valid;
alter table public.passages enable trigger enforce_passage_review_gate;

do $b_grandfathering$
declare
  exact_b integer;
begin
  select count(*) into exact_b
  from typing_station_b_guard guard
  join public.passages passage on passage.id = guard.id
  join typing_station_b_runtime_guard runtime on runtime.id = passage.id
  where passage.risk_classification = 'B'
    and passage.is_active is not distinct from runtime.is_active
    and passage.is_public is not distinct from runtime.is_public
    and convert_to(passage.content, 'UTF8') = guard.content_bytes;

  if exact_b <> 23 then
    raise exception 'B-rated grandfathering failed: exact rows %', exact_b;
  end if;
end
$b_grandfathering$;

-- Atomic cutover: retain old identities/content, swap their visibility, then publish replacements.
update public.passages passage
set is_active = false, is_public = false,
  risk_classification = 'C', review_status = 'rejected', reviewed_at = null,
  review_notes = 'Superseded by the mapped neutral replacement; original prose retained for historical references.'
from typing_station_corpus_replacements seed
where passage.id = seed.old_id;

update public.passages passage
set is_active = true, is_public = true
from typing_station_corpus_replacements seed
where passage.id = seed.new_id;

do $postflight$
declare
  active_public_total integer;
  active_public_english integer;
  active_public_chinese integer;
  old_inactive_private integer;
  new_active_public integer;
  exact_replacements integer;
  exact_mapping integer;
  protected_drift integer;
  old_c_content_drift integer;
  b_runtime_drift integer;
  b_content_drift integer;
  historical_result_drift integer;
  unclassified_established integer;
begin
  select count(*) into active_public_total from public.passages where is_active and is_public;
  select count(*) into active_public_english from public.passages where is_active and is_public and language = 'english';
  select count(*) into active_public_chinese from public.passages where is_active and is_public and language = 'chinese';

  select count(*) into old_inactive_private
  from typing_station_corpus_replacements seed
  join public.passages passage on passage.id = seed.old_id
  where not passage.is_active and not passage.is_public;

  select count(*) into new_active_public
  from typing_station_corpus_replacements seed
  join public.passages passage on passage.id = seed.new_id
  where passage.is_active and passage.is_public;

  select count(*) into exact_replacements
  from typing_station_corpus_replacements seed
  join public.passages passage on passage.id = seed.new_id
  where passage.title = seed.new_title
    and passage.category = seed.category
    and passage.style = seed.style
    and passage.language = seed.language
    and passage.content = seed.content
    and encode(digest(passage.content, 'sha256'), 'hex') = seed.sha256
    and passage.risk_classification = 'A'
    and passage.source_type = seed.source_type
    and passage.fictional = seed.fictional
    and passage.reviewed_at = seed.reviewed_at
    and passage.review_notes = seed.review_notes
    and passage.review_status = 'approved'
    and passage.is_active and passage.is_public;

  select count(*) into exact_mapping
  from typing_station_corpus_replacements seed
  join public.passage_replacement_map mapping
    on mapping.old_passage_id = seed.old_id and mapping.new_passage_id = seed.new_id
  where mapping.corpus_version = '${CORPUS_VERSION}';

  select count(*) into protected_drift
  from typing_station_preserved_passage_guard guard
  left join public.passages passage on passage.id = guard.id
  where passage.id is null
    or passage.title is distinct from guard.title
    or passage.category is distinct from guard.category
    or passage.style is distinct from guard.style
    or passage.language is distinct from guard.language
    or passage.is_active is distinct from guard.is_active
    or passage.is_public is distinct from guard.is_public
    or convert_to(passage.content, 'UTF8') is distinct from guard.content_bytes;

  select count(*) into old_c_content_drift
  from typing_station_old_c_content_guard guard
  left join public.passages passage on passage.id = guard.id
  where passage.id is null
    or passage.title is distinct from guard.title
    or passage.category is distinct from guard.category
    or passage.style is distinct from guard.style
    or passage.language is distinct from guard.language
    or convert_to(passage.content, 'UTF8') is distinct from guard.content_bytes;

  select count(*) into b_runtime_drift
  from typing_station_b_runtime_guard guard
  left join public.passages passage on passage.id = guard.id
  where passage.id is null
    or passage.is_active is distinct from guard.is_active
    or passage.is_public is distinct from guard.is_public;

  select count(*) into b_content_drift
  from typing_station_b_guard guard
  left join public.passages passage on passage.id = guard.id
  where passage.id is null
    or convert_to(passage.content, 'UTF8') is distinct from guard.content_bytes;

  select count(*) into historical_result_drift
  from typing_station_historical_result_guard guard
  left join public.typing_results typing_results on typing_results.id = guard.id
  where typing_results.id is null
    or typing_results.passage_id is distinct from guard.passage_id
    or typing_results.passage_title is distinct from guard.passage_title
    or typing_results.passage_category is distinct from guard.passage_category;

  select count(*) into unclassified_established
  from public.passages passage
  where passage.is_active and passage.is_public
    and not exists (select 1 from typing_station_b_guard guard where guard.id = passage.id)
    and (passage.risk_classification is distinct from 'A'
      or passage.review_status is distinct from 'approved'
      or passage.reviewed_at is null);

  if protected_drift <> 0 then raise exception 'Protected passage drift detected'; end if;
  if old_c_content_drift <> 0 then raise exception 'Old C-rated content drift detected'; end if;
  if b_runtime_drift <> 0 then raise exception 'B-rated runtime state changed'; end if;
  if b_content_drift <> 0 then raise exception 'B-rated content bytes changed'; end if;
  if historical_result_drift <> 0 then
    raise exception 'Historical typing-result identity, title, or category drift detected';
  end if;

  if active_public_total <> 218 or active_public_english <> 140 or active_public_chinese <> 78
    or old_inactive_private <> 63 or new_active_public <> 63 or exact_replacements <> 63
    or exact_mapping <> 63 or unclassified_established <> 0
  then
    raise exception 'Corpus remediation postflight failed: active % (English %, Chinese %), old private %, new public %, exact replacements %, map %, protected drift %, old C drift %, B runtime drift %, B content drift %, unclassified established %',
      active_public_total, active_public_english, active_public_chinese,
      old_inactive_private, new_active_public, exact_replacements, exact_mapping,
      protected_drift, old_c_content_drift, b_runtime_drift, b_content_drift,
      unclassified_established;
  end if;

end
$postflight$;

commit;
`;
}

const passages = loadDrafts();
const corpus = {
  schemaVersion: 1,
  corpusVersion: CORPUS_VERSION,
  uuidNamespace: UUID_NAMESPACE,
  deterministicNamePattern: "typing-station:corpus-remediation-v1:<oldId>",
  reviewedAt: REVIEWED_AT,
  passages
};
const sourceRows = extractEnglishV2Rows(readFileSync(englishV2MigrationPath, "utf8"));
if (sourceRows.size !== 140) throw new Error(`Expected 140 English Corpus v2 rows, found ${sourceRows.size}.`);

mkdirSync(dirname(corpusPath), { recursive: true });
writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
writeFileSync(migrationPath, renderMigration(passages, sourceRows));

console.log(`Generated ${passages.length} replacements at ${corpusPath}.`);
console.log(`Generated guarded migration at ${migrationPath}.`);
