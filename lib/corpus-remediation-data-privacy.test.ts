import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase", "migrations");
const reviewMigration = readFileSync(
  join(migrations, "202608220001_add_passage_review_metadata.sql"),
  "utf8"
);
const replacementMigration = readFileSync(
  join(migrations, "202608220002_replace_c_rated_passages.sql"),
  "utf8"
);
const publicBoundaryScript = readFileSync(
  join(process.cwd(), "scripts", "testSupabasePublicBoundary.mts"),
  "utf8"
);
const authorizationScript = readFileSync(
  join(process.cwd(), "scripts", "testSupabaseAuthorization.mts"),
  "utf8"
);

describe("corpus remediation historical result categories", () => {
  it("snapshots every result category before the 63 old passages become private", () => {
    const categoryColumn = replacementMigration.indexOf(
      "add column if not exists passage_category text"
    );
    const categoryBackfill = replacementMigration.indexOf(
      "set passage_category = coalesce("
    );
    const cutover = replacementMigration.indexOf("set is_active = false, is_public = false");

    expect(categoryColumn).toBeGreaterThan(-1);
    expect(categoryBackfill).toBeGreaterThan(categoryColumn);
    expect(cutover).toBeGreaterThan(categoryBackfill);
    expect(replacementMigration).toContain("new.passage_category := passage_category");
    expect(replacementMigration).toContain("typing_results.passage_category");
    expect(replacementMigration).not.toContain("passages.category as passage_category");
  });

  it("asserts all 63 retained old passage identities resolve without rewriting history", () => {
    expect(replacementMigration).toContain("typing_station_old_c_content_guard on commit drop as");
    expect(replacementMigration).toContain("join typing_station_corpus_replacements seed on seed.old_id = passage.id");
    expect(replacementMigration).toContain("old_c_content_drift <> 0");
    expect(replacementMigration).toContain("old_inactive_private <> 63");
    expect(replacementMigration).toContain("typing_station_historical_result_guard on commit drop as");
    expect(replacementMigration).toContain("typing_results.passage_id = stage.old_id");
    expect(replacementMigration).toContain("join public.passages passages on passages.id = stage.old_id");
    expect(replacementMigration).toMatch(
      /typing_results\.passage_category is distinct from\s+coalesce\(nullif\(btrim\(passages\.category\), ''\), 'Uncategorised'\)/
    );
    expect(replacementMigration).not.toContain(
      "typing_results.passage_category is distinct from stage.category"
    );
    expect(replacementMigration).toContain("typing_results.passage_title is distinct from guard.passage_title");
    expect(replacementMigration).toContain("typing_results.passage_category is distinct from guard.passage_category");
  });
});

describe("internal passage review notes", () => {
  it("removes direct review-note reads and publishes only an explicit safe projection", () => {
    expect(reviewMigration).toContain(
      "revoke select on public.passages from public, anon, authenticated"
    );
    expect(reviewMigration).toMatch(/grant select \([\s\S]*?\) on public\.passages to anon, authenticated/);
    const safeGrant = reviewMigration.match(
      /grant select \(([\s\S]*?)\) on public\.passages to anon, authenticated/
    )?.[1];
    expect(safeGrant).not.toContain("review_notes");

    const publicView = reviewMigration.match(
      /create (?:or replace )?view public\.public_passages[\s\S]*?grant select on public\.public_passages/
    )?.[0];
    expect(publicView).toBeTruthy();
    expect(publicView).toContain("security_invoker = true");
    expect(publicView).not.toContain("review_notes");
    expect(publicView).toContain("where passages.is_active = true");
    expect(publicView).toContain("and passages.is_public = true");
  });

  it("allows full metadata reads only through authenticated admin-guarded RPCs", () => {
    expect(reviewMigration).toContain("create or replace function public.get_admin_passages()")
    expect(reviewMigration).toContain("create or replace function public.get_admin_passage(target_passage_id uuid)")
    expect(reviewMigration.match(/if not public\.is_admin\(\) then/g)).toHaveLength(2);
    expect(reviewMigration).toContain("revoke all on function public.get_admin_passages() from public, anon");
    expect(reviewMigration).toContain("grant execute on function public.get_admin_passages() to authenticated");
    expect(reviewMigration).toContain("revoke all on function public.get_admin_passage(uuid) from public, anon");
    expect(reviewMigration).toContain("grant execute on function public.get_admin_passage(uuid) to authenticated");
  });

  it("pins anonymous, ordinary authenticated, and admin visibility checks", () => {
    expect(publicBoundaryScript).toContain('.select("review_notes")');
    expect(publicBoundaryScript).toContain("Anonymous review_notes was directly selectable");
    expect(authorizationScript).toContain("Authenticated review_notes was directly selectable");
    expect(authorizationScript).toContain('userA.client.rpc("get_admin_passages")');
    expect(authorizationScript).toContain('admin.client.rpc("get_admin_passages")');
    expect(authorizationScript).toContain("Admin UI RPC could not read updated review notes");
  });
});
