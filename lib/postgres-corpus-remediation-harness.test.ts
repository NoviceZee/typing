import { describe, expect, test } from "vitest";
import { readFile } from "node:fs/promises";

import {
  buildHistoricalResultSeedSql,
  buildEnglishV2PrerequisiteSql,
  buildPsqlFileArgs,
  buildOldCIdentityReconciliationSql,
  buildProductionCountFixtureSql,
  getTemporaryClusterPrefix,
  lastScalarResult,
  runDisposablePostgresLifecycle,
  buildSupabaseBootstrapSql,
  extractBGuardIds,
  injectForcedFailure,
  listMigrationsThrough,
} from "../scripts/verifyCorpusRemediationPostgres.mjs";
import corpus from "../outputs/corpus-remediation/replacement-corpus-v1.json";

const repoRoot = new URL("..", import.meta.url);

describe("disposable PostgreSQL corpus-remediation harness", () => {
  test("discovers every repository migration through review metadata in timestamp order", async () => {
    const migrations = await listMigrationsThrough(repoRoot, "202608220001");
    const names = migrations.map((migration) => migration.name);

    expect(names[0]).toBe("202606030001_create_passages.sql");
    expect(names.at(-1)).toBe("202608220001_add_passage_review_metadata.sql");
    expect(names).toEqual([...names].sort());
    expect(names).not.toContain("202608220002_replace_c_rated_passages.sql");
  });

  test("bootstraps only the Supabase objects referenced by repository migrations", () => {
    const sql = buildSupabaseBootstrapSql();

    expect(sql).toContain("create role anon nologin");
    expect(sql).toContain("create role authenticated nologin");
    expect(sql).toContain("create schema auth");
    expect(sql).toContain("create table auth.users");
    expect(sql).toContain("create or replace function auth.uid()");
    expect(sql).toContain("create schema storage");
    expect(sql).toContain("create table storage.buckets");
    expect(sql).toContain("create table storage.objects");
    expect(sql).toContain("create or replace function storage.foldername");
    expect(sql).not.toMatch(/password|secret/i);
  });

  test.each(["before_bypass", "after_bypass"] as const)(
    "injects one forced %s failure inside the cutover transaction",
    (phase) => {
      const source = [
        "begin;",
        "alter table public.passages disable trigger enforce_passage_review_gate;",
        "alter table public.passages drop constraint if exists passages_publication_requires_approval;",
        "alter table public.passages add constraint passages_publication_requires_approval check (true) not valid;",
        "alter table public.passages enable trigger enforce_passage_review_gate;",
        "commit;",
      ].join("\n");

      const injected = injectForcedFailure(source, phase);

      expect(injected.match(/forced corpus-remediation harness failure/g)).toHaveLength(1);
      expect(injected.indexOf("forced corpus-remediation harness failure")).toBeGreaterThan(
        phase === "before_bypass"
          ? injected.indexOf("begin;")
          : injected.indexOf("enable trigger enforce_passage_review_gate"),
      );
      expect(injected.indexOf("forced corpus-remediation harness failure")).toBeLessThan(
        phase === "before_bypass"
          ? injected.indexOf("disable trigger enforce_passage_review_gate")
          : injected.indexOf("commit;"),
      );
    },
  );

  test("builds one historical result for every old C identity using the live old category", () => {
    const sql = buildHistoricalResultSeedSql(
      corpus.passages,
      "20000000-0000-4000-8000-000000000002",
    );

    expect(sql.match(/\('20000000-0000-4000-8000-000000000002'::uuid,/g)).toHaveLength(63);
    for (const passage of corpus.passages) {
      expect(sql).toContain(`'${passage.oldId}'::uuid`);
      expect(sql).toContain(`'${passage.oldTitle.replaceAll("'", "''")}'`);
    }
    expect(sql).toContain(
      "coalesce(nullif(btrim(passage.category), ''), 'Uncategorised') as passage_category"
    );
    expect(sql).not.toContain("passage.category is distinct from expected.passage_category");
  });

  test("extracts the exact 23 remote B-rated guard identities from the generated cutover", () => {
    const source = `
-- BEGIN B-RATED BYTE GUARD
insert into typing_station_b_guard (id, content_bytes) values
  ('00000000-0000-4000-8000-000000000001'::uuid, decode('aa', 'hex')),
  ('00000000-0000-4000-8000-000000000002'::uuid, decode('bb', 'hex'));
-- END B-RATED BYTE GUARD`;

    expect(extractBGuardIds(source)).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
    ]);
  });

  test("applies each migration as one transaction so ON COMMIT DROP fixtures survive the file", () => {
    expect(buildPsqlFileArgs(["--dbname", "test"], "/tmp/migration.sql")).toEqual([
      "--dbname",
      "test",
      "--single-transaction",
      "--quiet",
      "--file",
      "/tmp/migration.sql",
    ]);
  });

  test("reconciles fresh random-ID seed rows to the English-v2 production prerequisites", () => {
    const migration = `begin;
create temp table typing_station_english_corpus_v2 (id uuid, retained boolean, title text, category text, style text, content text);
insert into typing_station_english_corpus_v2 values ('00000000-0000-4000-8000-000000000001', true, 'Retained', 'Articles', 'General', 'content');
create temp table typing_station_english_corpus_v2_deactivate (id uuid, title text);
insert into typing_station_english_corpus_v2_deactivate values ('00000000-0000-4000-8000-000000000002', 'Legacy');
create temp table typing_station_english_corpus_v2_guard as select 1;
commit;`;

    const sql = buildEnglishV2PrerequisiteSql(migration);

    expect(sql).toContain("where seed.retained");
    expect(sql).toContain("where not seed.retained");
    expect(sql).toContain("typing_station_english_corpus_v2_deactivate");
    expect(sql).toContain("set id = seed.id");
    expect(sql).toContain("set is_active = false, is_public = false");
    expect(sql).toContain("insert into public.passages");
    expect(sql).not.toContain("create temp table typing_station_english_corpus_v2_guard");
  });

  test("reconciles all 63 old C identities without rewriting their original categories or prose", () => {
    const sql = buildOldCIdentityReconciliationSql(corpus.passages);

    expect(sql.match(/\('[-0-9a-f]{36}'::uuid,/g)).toHaveLength(63);
    expect(sql).toContain("set id = expected.old_id");
    expect(sql).not.toContain("category = expected.category");
    expect(sql).toContain("passage.title = expected.old_title");
    expect(sql).toContain("passage.language = expected.language");
    expect(sql).toContain(") <> 1");
    expect(sql).not.toContain("insert into public.passages");
  });

  test("fills the three-row fresh-history gap with explicit protected A fixtures", () => {
    const sql = buildProductionCountFixtureSql();

    expect(sql).toContain("<> 215");
    expect(sql).toContain("<> 75");
    expect(sql.match(/30000000-0000-4000-8000-00000000000[1-3]/g)).toHaveLength(3);
    expect(sql).toContain("values");
    expect(sql).toContain("true, true");
  });

  test("qualifies passage content in joined PostgreSQL snapshot guards", async () => {
    const migration = await readFile(
      new URL("../supabase/migrations/202608220002_replace_c_rated_passages.sql", import.meta.url),
      "utf8",
    );

    expect(migration).not.toContain("convert_to(content, 'UTF8') as content_bytes");
    expect(migration.match(/convert_to\(passage\.content, 'UTF8'\) as content_bytes/g)).toHaveLength(2);
  });

  test("verifies historical categories against retained old passages, not replacements", async () => {
    const harness = await readFile(
      new URL("../scripts/verifyCorpusRemediationPostgres.mjs", import.meta.url),
      "utf8",
    );

    expect(harness).toContain("join public.passages old_passage on old_passage.id = expected.old_id");
    expect(harness).toMatch(
      /result\.passage_category is distinct from\s+coalesce\(nullif\(btrim\(old_passage\.category\), ''\), 'Uncategorised'\)/,
    );
    expect(harness).not.toContain("result.passage_category is distinct from expected.category");
  });

  test("places the disposable cluster under an explicit mkdtemp path in /tmp", () => {
    expect(getTemporaryClusterPrefix()).toBe("/tmp/typing-station-postgres-");
  });

  test("reads the final scalar from role setup plus verification output", () => {
    expect(lastScalarResult("SET\n218\n")).toBe("218");
    expect(lastScalarResult("\n20000000-0000-4000-8000-000000000001\n63\n")).toBe("63");
  });

  test("stops a server whose start command throws after launching it before removing paths", async () => {
    const events: string[] = [];
    let serverRunning = false;
    const startFailure = new Error("start lost readiness response");

    await expect(
      runDisposablePostgresLifecycle({
        prepare: async () => {
          events.push("prepare");
        },
        start: async () => {
          events.push("start");
          serverRunning = true;
          throw startFailure;
        },
        work: async () => {
          events.push("work");
        },
        stop: async () => {
          events.push("stop");
          serverRunning = false;
        },
        isRunning: async () => serverRunning,
        remove: async () => {
          expect(serverRunning).toBe(false);
          events.push("remove");
        },
      }),
    ).rejects.toBe(startFailure);
    expect(events).toEqual(["prepare", "start", "stop", "remove"]);
  });

  test("preserves work and stop failures while still removing paths once status proves stopped", async () => {
    const events: string[] = [];
    let serverRunning = false;
    const workFailure = new Error("migration failed");
    const stopFailure = new Error("stop command lost its response");

    const failure = await runDisposablePostgresLifecycle({
      prepare: async () => {
        events.push("prepare");
      },
      start: async () => {
        events.push("start");
        serverRunning = true;
      },
      work: async () => {
        events.push("work");
        throw workFailure;
      },
      stop: async () => {
        events.push("stop");
        serverRunning = false;
        throw stopFailure;
      },
      isRunning: async () => {
        events.push("status");
        return serverRunning;
      },
      remove: async () => {
        events.push("remove");
      },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([workFailure, stopFailure]);
    expect(events).toEqual(["prepare", "start", "work", "stop", "status", "remove"]);
  });

  test("does not remove paths when stop fails and status says the server is still live", async () => {
    const events: string[] = [];
    let serverRunning = false;
    const stopFailure = new Error("stop failed");

    const failure = await runDisposablePostgresLifecycle({
      prepare: async () => {
        events.push("prepare");
      },
      start: async () => {
        events.push("start");
        serverRunning = true;
      },
      work: async () => {
        events.push("work");
      },
      stop: async () => {
        events.push("stop");
        throw stopFailure;
      },
      isRunning: async () => {
        events.push("status");
        return serverRunning;
      },
      remove: async () => {
        events.push("remove");
      },
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(AggregateError);
    expect((failure as AggregateError).errors).toEqual([
      stopFailure,
      expect.objectContaining({ message: expect.stringContaining("still running") }),
    ]);
    expect(events).toEqual(["prepare", "start", "work", "stop", "status"]);
  });
});
