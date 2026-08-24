#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function listMigrationsThrough(repoRoot, cutoff) {
  const rootPath = repoRoot instanceof URL ? fileURLToPath(repoRoot) : repoRoot;
  const migrationDirectory = new URL("supabase/migrations/", new URL(`file://${rootPath.replace(/\/$/, "")}/`));
  const names = (await readdir(migrationDirectory))
    .filter((name) => /^\d{12}_.+\.sql$/.test(name) && name.slice(0, 12) <= cutoff)
    .sort();

  return names.map((name) => ({
    name,
    path: fileURLToPath(new URL(name, migrationDirectory)),
  }));
}

export function buildSupabaseBootstrapSql() {
  return String.raw`
create role anon nologin;
create role authenticated nologin;

create schema auth;
create table auth.users (
  id uuid primary key
);
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/')
$$;
`;
}

export function injectForcedFailure(source, phase) {
  const marker =
    phase === "before_bypass"
      ? "alter table public.passages disable trigger enforce_passage_review_gate;"
      : phase === "after_bypass"
        ? "commit;"
        : null;

  if (marker === null) {
    throw new TypeError(`Unsupported forced-failure phase: ${phase}`);
  }
  const position = phase === "after_bypass" ? source.lastIndexOf(marker) : source.indexOf(marker);
  if (position === -1) {
    throw new Error(`Cannot inject ${phase} failure: migration marker is absent.`);
  }

  const failure = "do $$ begin raise exception 'forced corpus-remediation harness failure'; end $$;\n\n";
  return `${source.slice(0, position)}${failure}${source.slice(position)}`;
}

export function buildHistoricalResultSeedSql(passages, userId) {
  const rows = passages.map(
    (passage, index) =>
      `  (${quoteLiteral(userId)}::uuid, ${quoteLiteral(passage.oldId)}::uuid, ${quoteLiteral(passage.oldTitle)}, ${quoteLiteral(`corpus-history-${String(index + 1).padStart(3, "0")}`)})`,
  );

  return `begin;
create temp table typing_station_expected_history (
  user_id uuid not null,
  passage_id uuid primary key,
  passage_title text not null,
  passage_category text not null,
  client_attempt_id text not null
) on commit drop;

insert into typing_station_expected_history
  (user_id, passage_id, passage_title, passage_category, client_attempt_id)
select
  source.user_id,
  source.passage_id,
  source.passage_title,
  coalesce(nullif(btrim(passage.category), ''), 'Uncategorised') as passage_category,
  source.client_attempt_id
from (values
${rows.join(",\n")}
) as source (user_id, passage_id, passage_title, client_attempt_id)
join public.passages passage on passage.id = source.passage_id;

do $historical_seed_preflight$
begin
  if (select count(*) from typing_station_expected_history) <> 63
    or exists (
      select 1
      from typing_station_expected_history expected
      left join public.passages passage on passage.id = expected.passage_id
      where passage.id is null
        or passage.title is distinct from expected.passage_title
        or passage.is_active is distinct from true
        or passage.is_public is distinct from true
    )
  then
    raise exception 'Historical result seed does not match all 63 live old C passages.';
  end if;
end
$historical_seed_preflight$;

insert into public.typing_results
  (user_id, passage_id, passage_title, duration_seconds, wpm, accuracy,
   correct_chars, typed_chars, client_attempt_id, elapsed_seconds,
   completion_reason, mode_duration_seconds)
select
  expected.user_id,
  expected.passage_id,
  expected.passage_title,
  60,
  10,
  100,
  100,
  100,
  expected.client_attempt_id,
  60,
  'manual',
  60
from typing_station_expected_history expected
order by expected.passage_id;

do $historical_seed_postflight$
begin
  if (
    select count(*)
    from public.typing_results result
    join typing_station_expected_history expected on expected.passage_id = result.passage_id
    where result.user_id = expected.user_id
      and result.passage_title = expected.passage_title
  ) <> 63 then
    raise exception 'Failed to seed all 63 historical typing results.';
  end if;
end
$historical_seed_postflight$;
commit;
`;
}

export function extractBGuardIds(source) {
  const match = source.match(/-- BEGIN B-RATED BYTE GUARD([\s\S]*?)-- END B-RATED BYTE GUARD/);
  if (match === null) {
    throw new Error("Generated cutover has no B-rated byte-guard block.");
  }
  return [...match[1].matchAll(/'([0-9a-f]{8}-[0-9a-f-]{27})'::uuid/gi)].map(
    (entry) => entry[1].toLowerCase(),
  );
}

const POSTGRES_BIN = "/opt/homebrew/opt/postgresql@17/bin";
const DATABASE_NAME = "typing_station_corpus_verification";
const ADMIN_USER_ID = "20000000-0000-4000-8000-000000000001";
const ORDINARY_USER_ID = "20000000-0000-4000-8000-000000000002";

function sqlUuidList(ids) {
  return ids.map((id) => `${quoteLiteral(id)}::uuid`).join(", ");
}

function historicalExpectedValues(passages) {
  return passages
    .map(
      (passage) =>
        `(${quoteLiteral(passage.oldId)}::uuid, ${quoteLiteral(passage.oldTitle)})`,
    )
    .join(",\n      ");
}

function commandFailure(command, args, result) {
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  const tail = combined.length > 6000 ? combined.slice(-6000) : combined;
  return new Error(
    `${basename(command)} ${args.join(" ")} exited ${result.status ?? "without a status"}${tail ? `:\n${tail}` : ""}`,
  );
}

function runProgram(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    input: options.input,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (options.expectFailure) {
    if (result.status === 0) {
      throw new Error(`${basename(command)} unexpectedly succeeded during ${options.label}.`);
    }
    if (
      options.expectedMessage &&
      !`${result.stdout ?? ""}\n${result.stderr ?? ""}`.includes(options.expectedMessage)
    ) {
      throw commandFailure(command, args, result);
    }
    return result;
  }
  if (result.status !== 0) throw commandFailure(command, args, result);
  return result;
}

function postgresServerIsRunning(dataDirectory, environment) {
  const command = join(POSTGRES_BIN, "pg_ctl");
  const args = ["--pgdata", dataDirectory, "status"];
  const result = spawnSync(command, args, {
    env: environment,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 3) return false;
  throw commandFailure(command, args, result);
}

function isolatedEnvironment() {
  const environment = { ...process.env };
  for (const name of [
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGPASSFILE",
  ]) {
    delete environment[name];
  }
  return environment;
}

export async function runDisposablePostgresLifecycle({
  prepare,
  start,
  work,
  stop,
  isRunning,
  remove,
}) {
  const failures = [];
  let startAttempted = false;
  let safeToRemove = false;
  let value;

  try {
    await prepare();
    startAttempted = true;
    await start();
    value = await work();
  } catch (error) {
    failures.push(error);
  }

  if (!startAttempted) {
    safeToRemove = true;
  } else {
    try {
      await stop();
      safeToRemove = true;
    } catch (stopError) {
      failures.push(stopError);
      try {
        if (await isRunning()) {
          failures.push(
            new Error("PostgreSQL is still running; temporary data and socket paths were preserved."),
          );
        } else {
          safeToRemove = true;
        }
      } catch (statusError) {
        failures.push(statusError);
      }
    }
  }

  if (safeToRemove) {
    try {
      await remove();
    } catch (removeError) {
      failures.push(removeError);
    }
  }

  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, "Disposable PostgreSQL lifecycle failed.");
  }
  return value;
}

export function buildPsqlFileArgs(connection, path) {
  return [...connection, "--single-transaction", "--quiet", "--file", path];
}

export function buildEnglishV2PrerequisiteSql(migrationSource) {
  const start = migrationSource.indexOf("create temp table typing_station_english_corpus_v2 (");
  const end = migrationSource.indexOf(
    "create temp table typing_station_english_corpus_v2_guard",
  );
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Cannot extract the English corpus v2 prerequisite inventories.");
  }
  const inventories = migrationSource.slice(start, end);
  return `begin;
${inventories}

-- Earlier repository seed migrations used generated UUID defaults, whereas
-- the production corpus-v2 migration intentionally preflights fixed live IDs.
-- Reconcile only those staged identities in this fresh disposable database.
delete from public.passages passage
using typing_station_english_corpus_v2 seed
where not seed.retained
  and passage.title = seed.title
  and passage.id <> seed.id;

update public.passages passage
set id = seed.id
from typing_station_english_corpus_v2 seed
where seed.retained
  and passage.title = seed.title
  and passage.id <> seed.id
  and not exists (select 1 from public.passages existing where existing.id = seed.id);

insert into public.passages
  (id, title, category, style, content, language, is_active, is_public)
select seed.id, seed.title, seed.category, seed.style, seed.content, 'english', true, true
from typing_station_english_corpus_v2 seed
where seed.retained
  and not exists (select 1 from public.passages passage where passage.id = seed.id);

update public.passages passage
set id = seed.id
from typing_station_english_corpus_v2_deactivate seed
where passage.title = seed.title
  and passage.id <> seed.id
  and not exists (select 1 from public.passages existing where existing.id = seed.id);

insert into public.passages
  (id, title, category, style, content, language, is_active, is_public)
select seed.id, seed.title, 'Legacy fixture', 'Legacy fixture',
  'Disposable production-shape prerequisite for ' || seed.title,
  'english', true, true
from typing_station_english_corpus_v2_deactivate seed
where not exists (select 1 from public.passages passage where passage.id = seed.id);

update public.passages passage
set is_active = false, is_public = false
where passage.language = 'english'
  and not exists (
    select 1 from typing_station_english_corpus_v2 seed
    where seed.retained and seed.id = passage.id
  )
  and not exists (
    select 1 from typing_station_english_corpus_v2_deactivate seed
    where seed.id = passage.id
  );

do $english_v2_prerequisite$
begin
  if (select count(*) from typing_station_english_corpus_v2 seed
      join public.passages passage on passage.id = seed.id
      where seed.retained and passage.language = 'english') <> 40
    or (select count(*) from typing_station_english_corpus_v2_deactivate seed
      join public.passages passage on passage.id = seed.id
      where passage.language = 'english') <> 9
    or exists (
      select 1 from typing_station_english_corpus_v2 seed
      join public.passages passage on passage.title = seed.title and passage.id <> seed.id
    )
    or (select count(*) from public.passages
      where language = 'english' and is_active and is_public) <> 49
  then
    raise exception 'Failed to build English corpus v2 production prerequisites.';
  end if;
end
$english_v2_prerequisite$;
commit;
`;
}

export function buildOldCIdentityReconciliationSql(passages) {
  const rows = passages
    .map(
      (passage) =>
        `  (${quoteLiteral(passage.oldId)}::uuid, ${quoteLiteral(passage.oldTitle)}, ${quoteLiteral(passage.language)})`,
    )
    .join(",\n");
  return `begin;
create temp table typing_station_old_c_identity (
  old_id uuid primary key,
  old_title text not null unique,
  language text not null
) on commit drop;

insert into typing_station_old_c_identity (old_id, old_title, language)
values
${rows};

do $old_c_identity_preflight$
begin
  if (select count(*) from typing_station_old_c_identity) <> 63
    or exists (
      select 1
      from typing_station_old_c_identity expected
      where (
        select count(*)
        from public.passages passage
        where passage.title = expected.old_title
          and passage.language = expected.language
      ) <> 1
    )
    or exists (
      select 1
      from typing_station_old_c_identity expected
      join public.passages passage on passage.id = expected.old_id
      where passage.title is distinct from expected.old_title
        or passage.language is distinct from expected.language
    )
  then
    raise exception 'Fresh-database corpus cannot be reconciled to all 63 audited old C identities.';
  end if;
end
$old_c_identity_preflight$;

update public.passages passage
set id = expected.old_id
from typing_station_old_c_identity expected
where passage.title = expected.old_title
  and passage.language = expected.language
  and passage.id <> expected.old_id
  and (
    passage.id = expected.old_id
    or not exists (select 1 from public.passages existing where existing.id = expected.old_id)
  );

do $old_c_identity_postflight$
begin
  if (
    select count(*)
    from typing_station_old_c_identity expected
    join public.passages passage on passage.id = expected.old_id
    where passage.title = expected.old_title
      and passage.language = expected.language
      and passage.is_active
      and passage.is_public
  ) <> 63
  then
    raise exception 'Old C identity reconciliation did not preserve 63 exact live rows.';
  end if;
end
$old_c_identity_postflight$;
commit;
`;
}

export function buildProductionCountFixtureSql() {
  return `
do $production_count_preflight$
begin
  if (select count(*) from public.passages where is_active and is_public) <> 215
    or (select count(*) from public.passages where is_active and is_public and language = 'english') <> 140
    or (select count(*) from public.passages where is_active and is_public and language = 'chinese') <> 75
  then
    raise exception 'Fresh repository history no longer has the expected 215/140/75 production-fixture gap.';
  end if;
end
$production_count_preflight$;

insert into public.passages
  (id, title, category, style, content, language, is_active, is_public)
values
  ('30000000-0000-4000-8000-000000000001'::uuid, '雨後石階的光', '生活', 'Harness preservation fixture', '雨停後，石階留下深淺不一的水痕，簷角滴水慢慢落下，映出窗邊逐漸明亮的天空。', 'chinese', true, true),
  ('30000000-0000-4000-8000-000000000002'::uuid, '木盒裏的舊鈕扣', '生活', 'Harness preservation fixture', '木盒打開時，大小不同的鈕扣輕輕碰在一起，磨亮的邊緣記着衣物曾被反覆穿着的年月。', 'chinese', true, true),
  ('30000000-0000-4000-8000-000000000003'::uuid, '黃昏窗前的紙影', '生活', 'Harness preservation fixture', '黃昏的光穿過薄紙，在桌面留下柔和影子；風從窗縫進來，紙角便隨呼吸般微微起伏。', 'chinese', true, true);

do $production_count_postflight$
begin
  if (select count(*) from public.passages where is_active and is_public) <> 218
    or (select count(*) from public.passages where is_active and is_public and language = 'chinese') <> 78
  then
    raise exception 'Failed to complete the disposable 218/140/78 production-shaped fixture.';
  end if;
end
$production_count_postflight$;
`;
}

export function getTemporaryClusterPrefix() {
  return "/tmp/typing-station-postgres-";
}

export function lastScalarResult(output) {
  return output
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .at(-1) ?? "";
}

function createDatabaseClient(socketDirectory, environment) {
  const psql = join(POSTGRES_BIN, "psql");
  const connection = [
    "-X",
    "--no-psqlrc",
    "--host",
    socketDirectory,
    "--port",
    "5432",
    "--username",
    "postgres",
    "--dbname",
    DATABASE_NAME,
    "--set",
    "ON_ERROR_STOP=1",
    "--set",
    "VERBOSITY=terse",
  ];

  return {
    execute(sql, options = {}) {
      return runProgram(psql, [...connection, "--quiet", "--file", "-"], {
        env: environment,
        input: sql,
        ...options,
      });
    },
    applyFile(path) {
      return runProgram(psql, buildPsqlFileArgs(connection, path), {
        env: environment,
      });
    },
    query(sql) {
      return runProgram(psql, [...connection, "--tuples-only", "--no-align", "--command", sql], {
        env: environment,
      }).stdout.trim();
    },
  };
}

function buildActorSeedSql() {
  return `
insert into auth.users (id) values
  ('${ADMIN_USER_ID}'::uuid),
  ('${ORDINARY_USER_ID}'::uuid);

insert into public.profiles (user_id, display_name, handle, public_profile_enabled) values
  ('${ADMIN_USER_ID}'::uuid, 'Harness Admin', 'harness_admin', true),
  ('${ORDINARY_USER_ID}'::uuid, 'Harness User', 'harness_user', true);

insert into public.user_roles (user_id, role) values
  ('${ADMIN_USER_ID}'::uuid, 'admin'),
  ('${ORDINARY_USER_ID}'::uuid, 'user');
`;
}

function buildRollbackAssertionSql(passages) {
  const oldIds = sqlUuidList(passages.map((passage) => passage.oldId));
  const newIds = sqlUuidList(passages.map((passage) => passage.newId));
  return `
do $rollback_assertions$
begin
  if (select count(*) from public.passages where is_active and is_public) <> 218
    or (select count(*) from public.passages where is_active and is_public and language = 'english') <> 140
    or (select count(*) from public.passages where is_active and is_public and language = 'chinese') <> 78
    or (select count(*) from public.passages where id in (${oldIds}) and is_active and is_public) <> 63
    or (select count(*) from public.passages where id in (${newIds})) <> 0
    or to_regclass('public.passage_replacement_map') is not null
    or exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'typing_results' and column_name = 'passage_category'
    )
    or (select count(*) from public.typing_results where passage_id in (${oldIds})) <> 63
    or not exists (
      select 1 from pg_trigger
      where tgrelid = 'public.passages'::regclass
        and tgname = 'enforce_passage_review_gate'
        and tgenabled = 'O'
    )
    or not exists (
      select 1 from pg_constraint
      where conrelid = 'public.passages'::regclass
        and conname = 'passages_publication_requires_approval'
        and convalidated = false
    )
  then
    raise exception 'Forced-failure transaction left schema or data residue.';
  end if;
end
$rollback_assertions$;
`;
}

function buildSuccessAssertionSql(passages, bGuardIds) {
  const oldIds = sqlUuidList(passages.map((passage) => passage.oldId));
  const newIds = sqlUuidList(passages.map((passage) => passage.newId));
  const bIds = sqlUuidList(bGuardIds);
  const expectedRows = historicalExpectedValues(passages);
  return `
do $success_assertions$
declare
  historical_drift integer;
begin
  with expected(old_id, old_title) as (
    values
      ${expectedRows}
  )
  select count(*) into historical_drift
  from expected
  join public.passages old_passage on old_passage.id = expected.old_id
  left join public.typing_results result on result.passage_id = expected.old_id
  where result.id is null
    or result.passage_title is distinct from expected.old_title
    or result.passage_category is distinct from
      coalesce(nullif(btrim(old_passage.category), ''), 'Uncategorised');

  if (select count(*) from public.passages where is_active and is_public) <> 218
    or (select count(*) from public.passages where is_active and is_public and language = 'english') <> 140
    or (select count(*) from public.passages where is_active and is_public and language = 'chinese') <> 78
    or (select count(*) from public.passages where id in (${oldIds}) and not is_active and not is_public) <> 63
    or (select count(*) from public.passages where id in (${newIds}) and is_active and is_public) <> 63
    or (select count(*) from public.passage_replacement_map) <> 63
    or (select count(distinct old_passage_id) from public.passage_replacement_map) <> 63
    or (select count(distinct new_passage_id) from public.passage_replacement_map) <> 63
    or historical_drift <> 0
    or (select count(*) from public.typing_results where passage_id in (${oldIds})) <> 63
    or (select count(*) from public.passages where id in (${bIds}) and risk_classification = 'B' and is_active and is_public) <> 23
    or not exists (
      select 1 from pg_trigger
      where tgrelid = 'public.passages'::regclass
        and tgname = 'enforce_passage_review_gate'
        and tgenabled = 'O'
    )
    or not exists (
      select 1 from pg_constraint
      where conrelid = 'public.passages'::regclass
        and conname = 'passages_publication_requires_approval'
        and convalidated = false
    )
    or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'typing_results'
        and column_name = 'passage_category' and is_nullable = 'NO'
    )
    or exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'public_passages'
        and column_name in ('review_notes', 'review_status', 'risk_classification', 'created_by')
    )
    or position('passages' in pg_get_viewdef('public.typing_results_leaderboard'::regclass, true)) > 0
    or position('passages' in pg_get_viewdef('public.public_profile_typing_results'::regclass, true)) > 0
  then
    raise exception 'Successful cutover verification failed.';
  end if;
end
$success_assertions$;
`;
}

function passageFingerprintQuery(ids, filter = "true") {
  return `
select encode(digest(coalesce(jsonb_agg(jsonb_build_array(
  passage.id,
  passage.title,
  passage.category,
  passage.style,
  passage.language,
  passage.is_active,
  passage.is_public,
  encode(digest(passage.content, 'sha256'), 'hex')
) order by passage.id)::text, '[]'), 'sha256'), 'hex')
from public.passages passage
where passage.id in (${sqlUuidList(ids)}) and (${filter});`;
}

async function runHarness() {
  const repoRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
  const reportPath = "/tmp/corpus-remediation-postgres-report.md";
  const corpusPath = join(repoRoot, "outputs/corpus-remediation/replacement-corpus-v1.json");
  const cutoverPath = join(
    repoRoot,
    "supabase/migrations/202608220002_replace_c_rated_passages.sql",
  );
  const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
  const cutover = await readFile(cutoverPath, "utf8");
  const bGuardIds = extractBGuardIds(cutover);
  const migrations = await listMigrationsThrough(repoRoot, "202608220001");

  if (corpus.passages.length !== 63 || bGuardIds.length !== 23) {
    throw new Error(
      `Harness inputs are incomplete: ${corpus.passages.length} C replacements and ${bGuardIds.length} B guards.`,
    );
  }

  const environment = isolatedEnvironment();
  const temporaryRoot = await mkdtemp(getTemporaryClusterPrefix());
  const dataDirectory = join(temporaryRoot, "data");
  const socketDirectory = join(temporaryRoot, "socket");
  const logPath = join(temporaryRoot, "postgres.log");
  const evidence = [];

  const reportContents = await runDisposablePostgresLifecycle({
    prepare: async () => {
      await import("node:fs/promises").then(({ mkdir }) => mkdir(socketDirectory));
      const version = runProgram(join(POSTGRES_BIN, "postgres"), ["--version"], {
        env: environment,
      }).stdout.trim();
      evidence.push(`PostgreSQL runtime: ${version}`);

      runProgram(
        join(POSTGRES_BIN, "initdb"),
        ["--pgdata", dataDirectory, "--username", "postgres", "--auth", "trust", "--encoding", "UTF8", "--no-locale"],
        { env: environment },
      );
    },
    start: () => {
      runProgram(
        join(POSTGRES_BIN, "pg_ctl"),
        [
          "--pgdata",
          dataDirectory,
          "--log",
          logPath,
          "--options",
          `-c listen_addresses='' -c unix_socket_directories='${socketDirectory}'`,
          "--wait",
          "start",
        ],
        { env: environment },
      );
    },
    work: async () => {
    runProgram(
      join(POSTGRES_BIN, "createdb"),
      ["--host", socketDirectory, "--port", "5432", "--username", "postgres", DATABASE_NAME],
      { env: environment },
    );

    const database = createDatabaseClient(socketDirectory, environment);
    database.execute(buildSupabaseBootstrapSql());
    evidence.push("Supabase bootstrap: minimal anon/authenticated roles, auth schema, and storage schema applied");

    let reconciledEnglishV2Prerequisites = false;
    for (const migration of migrations) {
      if (migration.name === "202608090001_english_corpus_v2.sql") {
        const migrationSource = await readFile(migration.path, "utf8");
        database.execute(buildEnglishV2PrerequisiteSql(migrationSource));
        reconciledEnglishV2Prerequisites = true;
      }
      if (migration.name === "202608220001_add_passage_review_metadata.sql") {
        database.execute(buildOldCIdentityReconciliationSql(corpus.passages));
        database.execute(buildProductionCountFixtureSql());
      }
      database.applyFile(migration.path);
    }
    evidence.push(`Repository migrations parsed/executed through 202608220001: ${migrations.length}`);
    if (reconciledEnglishV2Prerequisites) {
      evidence.push("Fresh-database prerequisite: reconciled only the 40 retained and 9 legacy English production identities required by 202608090001");
    }
    evidence.push("Fresh-database prerequisite: reconciled all 63 audited old C IDs/categories by exact existing title/language while retaining their repository-seeded prose");
    evidence.push("Fresh-history count fixture: added three explicit protected A rows because repository migration history yields 215/140/75 while the audited production shape is 218/140/78");

    database.execute(buildActorSeedSql());
    database.execute(buildHistoricalResultSeedSql(corpus.passages, ORDINARY_USER_ID));

    const preCutoverCounts = database.query(`
      select count(*),
        count(*) filter (where language = 'english'),
        count(*) filter (where language = 'chinese')
      from public.passages where is_active and is_public;
    `);
    if (preCutoverCounts !== "218|140|78") {
      throw new Error(`Unexpected pre-cutover counts: ${preCutoverCounts}`);
    }
    evidence.push("Pre-cutover active/public totals: 218 total, 140 English, 78 Chinese");
    evidence.push("Historical fixtures: 63 results, one for every old C-rated passage identity");

    const oldIds = new Set(corpus.passages.map((passage) => passage.oldId));
    const protectedIds = database
      .query(
        `select id from public.passages where id not in (${sqlUuidList([...oldIds])}) order by id;`,
      )
      .split("\n")
      .filter(Boolean);
    const protectedBefore = database.query(passageFingerprintQuery(protectedIds));
    const bBefore = database.query(passageFingerprintQuery(bGuardIds));
    const classicsBefore = database.query(
      passageFingerprintQuery(protectedIds, "passage.category in ('文言文', '詩詞')"),
    );
    const classicsCountBefore = database.query(
      "select count(*) from public.passages where category in ('文言文', '詩詞');",
    );

    for (const phase of ["before_bypass", "after_bypass"]) {
      database.execute(injectForcedFailure(cutover, phase), {
        expectFailure: true,
        expectedMessage: "forced corpus-remediation harness failure",
        label: `${phase} rollback scenario`,
      });
      database.execute(buildRollbackAssertionSql(corpus.passages));
      if (
        database.query(passageFingerprintQuery(protectedIds)) !== protectedBefore ||
        database.query(passageFingerprintQuery(bGuardIds)) !== bBefore
      ) {
        throw new Error(`${phase} rollback changed protected passage bytes or runtime state.`);
      }
      evidence.push(
        `Forced ${phase.replaceAll("_", "-")} failure: full transaction rolled back; trigger/constraint restored; no mapping, result-column, or replacement residue`,
      );
    }

    database.applyFile(cutoverPath);
    database.execute(buildSuccessAssertionSql(corpus.passages, bGuardIds));

    if (database.query(passageFingerprintQuery(protectedIds)) !== protectedBefore) {
      throw new Error("Non-C passage bytes or runtime state changed during successful cutover.");
    }
    if (database.query(passageFingerprintQuery(bGuardIds)) !== bBefore) {
      throw new Error("B-rated passage bytes or runtime state changed during successful cutover.");
    }
    if (
      database.query(
        passageFingerprintQuery(protectedIds, "passage.category in ('文言文', '詩詞')"),
      ) !== classicsBefore ||
      database.query("select count(*) from public.passages where category in ('文言文', '詩詞');") !==
        classicsCountBefore
    ) {
      throw new Error("Classical-Chinese or poetry rows changed during successful cutover.");
    }
    evidence.push("Successful cutover: 218/140/78; 63 old private; 63 new public; 63 one-to-one mappings");
    evidence.push("Preservation: all pre-existing non-C rows plus classical-Chinese/poetry rows retained exact prose/runtime fingerprints");
    evidence.push("Remote B inventory: 23 rows retained exact UTF-8 content/runtime fingerprint and were classified B");
    evidence.push("Historical results: all 63 retained old passage_id/title values and gained their original stored category");
    evidence.push("Safeguards: review trigger enabled; publication constraint present NOT VALID after grandfathering");

    const anonPublicCount = lastScalarResult(
      database.query("set role anon; select count(*) from public.public_passages;"),
    );
    const authenticatedPublicCount = lastScalarResult(
      database.query("set role authenticated; select count(*) from public.public_passages;"),
    );
    if (anonPublicCount !== "218" || authenticatedPublicCount !== "218") {
      throw new Error(
        `Safe public view returned unexpected role counts: anon ${anonPublicCount}, authenticated ${authenticatedPublicCount}.`,
      );
    }
    for (const [label, sql, expectedMessage] of [
      ["anon direct review_notes", "set role anon; select review_notes from public.passages limit 1;", "permission denied"],
      [
        "ordinary authenticated direct review_notes",
        `set role authenticated; select set_config('request.jwt.claim.sub', '${ORDINARY_USER_ID}', false); select review_notes from public.passages limit 1;`,
        "permission denied",
      ],
      [
        "ordinary authenticated admin RPC",
        `set role authenticated; select set_config('request.jwt.claim.sub', '${ORDINARY_USER_ID}', false); select * from public.get_admin_passages();`,
        "Admin access required",
      ],
      ["anon replacement map", "set role anon; select * from public.passage_replacement_map;", "permission denied"],
    ]) {
      database.execute(sql, { expectFailure: true, expectedMessage, label });
    }
    const adminNoteCount = lastScalarResult(
      database.query(`
        set role authenticated;
        select set_config('request.jwt.claim.sub', '${ADMIN_USER_ID}', false);
        select count(*) from public.get_admin_passages() passage where passage.review_notes is not null;
      `),
    );
    if (!adminNoteCount || Number(adminNoteCount) < 63) {
      throw new Error(`Admin review RPC returned an unexpected note count: ${adminNoteCount}`);
    }
    evidence.push("Privacy: safe public view works for anon/authenticated; review_notes denied directly; ordinary admin RPC denied; seeded admin JWT-claim context succeeds");

    database.execute(
      "insert into public.passages (title, content, is_active, is_public) values ('Harness unapproved public row', 'must rollback', true, true);",
      {
        expectFailure: true,
        expectedMessage: "Active or public passages require risk A approval",
        label: "post-cutover review gate",
      },
    );
    if (
      database.query(
        "select count(*) from public.passages where title = 'Harness unapproved public row';",
      ) !== "0"
    ) {
      throw new Error("Rejected unapproved-publication probe left a row behind.");
    }
    evidence.push("Review gate execution: unapproved active/public insert rejected without residue");

    const probePassage = corpus.passages[0];
    database.execute(`
      insert into public.typing_results
        (user_id, passage_id, passage_title, passage_category, duration_seconds, wpm, accuracy,
         correct_chars, typed_chars, client_attempt_id, elapsed_seconds, completion_reason,
         mode_duration_seconds)
      values
        ('${ORDINARY_USER_ID}'::uuid, '${probePassage.newId}'::uuid, 'spoofed title', 'spoofed category',
         60, 10, 100, 100, 100, 'post-cutover-trigger-probe', 60, 'manual', 60);
    `);
    const triggerProbe = database.query(`
      select passage_title, passage_category
      from public.typing_results
      where client_attempt_id = 'post-cutover-trigger-probe';
    `);
    if (triggerProbe !== `${probePassage.title}|${probePassage.category}`) {
      throw new Error(`Typing-result metadata trigger probe failed: ${triggerProbe}`);
    }
    evidence.push("Typing-result trigger: official new passage overwrote spoofed title/category with server metadata");

    return `# Corpus remediation disposable PostgreSQL report

Date: ${new Date().toISOString()}

## Outcome

PASS. The repository migrations and corpus cutover executed on a real disposable PostgreSQL 17 cluster. The harness used only an explicit Unix socket inside a unique \`/tmp/typing-station-postgres-*\` directory; it did not inspect or connect to the Homebrew default cluster, a remote database, or production.

## Commands

- \`pnpm verify:postgres-corpus-remediation\`
- Internally: explicit \`${POSTGRES_BIN}/initdb\`, \`pg_ctl\`, \`createdb\`, and \`psql\` paths with \`ON_ERROR_STOP=1\` and an explicit temporary socket/database.
- Applied all ${migrations.length} repository migrations from \`${migrations[0].name}\` through \`${migrations.at(-1).name}\`, then exercised two forced-failure variants and the repository \`202608220002_replace_c_rated_passages.sql\`.

## Defect found and fixed

- Real PostgreSQL execution found that the old-C snapshot joined two relations containing \`content\` but used \`convert_to(content, 'UTF8')\`. PostgreSQL rejected the migration as ambiguous. The generator now emits \`convert_to(passage.content, 'UTF8')\`, the SQL was regenerated, and a regression contract pins the qualification.

## Evidence

${evidence.map((item) => `- ${item}`).join("\n")}

## Cleanup

- Shutdown completes before the exact mkdtemp directory is removed. If shutdown reports failure, a status probe must prove the server stopped before removal; otherwise the paths are preserved for safety.
- Work, shutdown, status, and removal failures are retained together instead of one cleanup failure replacing another.
- No credentials or secrets are created or printed; fixed non-secret UUIDs simulate one admin and one ordinary authenticated user.

## Limitations

- This is PostgreSQL/Supabase-schema verification, not a running PostgREST/Auth/Storage stack. Role behavior is exercised with database \`SET ROLE\` plus the same \`request.jwt.claim.sub\` session claim read by \`auth.uid()\`.
- The harness proves transactional failure atomicity, schema behavior, RLS/column privileges, SQL execution, and corpus invariants locally. It does not claim production state or authorize deployment.
`;
    },
    stop: () => {
      runProgram(
        join(POSTGRES_BIN, "pg_ctl"),
        ["--pgdata", dataDirectory, "--wait", "--mode", "immediate", "stop"],
        { env: environment },
      );
    },
    isRunning: () => postgresServerIsRunning(dataDirectory, environment),
    remove: async () => {
      if (!temporaryRoot.startsWith(getTemporaryClusterPrefix())) {
        throw new Error(`Refusing to remove unexpected temporary path: ${temporaryRoot}`);
      }
      await rm(temporaryRoot, { recursive: true, force: true });
    },
  });

  await writeFile(reportPath, reportContents, "utf8");
  console.log(`PASS: disposable PostgreSQL corpus remediation verification completed.`);
  console.log(`Report: ${reportPath}`);
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  runHarness().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
