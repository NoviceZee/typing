import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationDirectory = join(process.cwd(), "supabase", "migrations");

function readMigration(name: string) {
  return readFileSync(join(migrationDirectory, name), "utf8");
}

describe("database security migration contracts", () => {
  it("derives result ownership, timestamps, eligibility and rate limits in the database", () => {
    const sql = readMigration("202607130002_harden_typing_results.sql");

    expect(sql).toContain("new.user_id := auth.uid()");
    expect(sql).toContain("new.created_at := now()");
    expect(sql).toContain("new.is_rankable :=");
    expect(sql).toContain("interval '1 minute'");
    expect(sql).toContain("alter column client_attempt_id set not null");
    expect(sql).toContain("correct_chars <= typed_chars");
    expect(sql).toContain("typing_results.is_rankable = true");
  });

  it("keeps private identity and non-qualifying result history out of public views", () => {
    const sql = readMigration("202607130003_hide_private_profile_identity.sql");

    expect(sql).toContain("case when profiles.public_profile_enabled then profiles.avatar_path else null end");
    expect(sql).toContain("profiles.public_profile_enabled = true");
    expect(sql).toContain("typing_results.is_rankable = true");
  });

  it("uses domain-aware pace and accuracy coherence for public ranking", () => {
    const sql = readMigration("202607130004_tighten_result_coherence.sql");

    expect(sql).toContain("p_correct_chars::numeric * 12");
    expect(sql).toContain("p_correct_chars::numeric * 60");
    expect(sql).toContain("p_accuracy between 70 and 100");
    expect(sql).toContain("abs(p_elapsed_seconds - p_duration_seconds) <= 2");
    expect(sql).toContain("new.passage_title := passage_title");
    expect(sql).toContain("new.metric_domain := public.resolve_typing_metric_domain");
    expect(sql).toContain("new.metric_domain is null or new.metric_domain not in");
    expect(sql).toContain("passages.language");
    expect(sql).toContain("typing_results.metric_domain");
    expect(sql).toContain("passages.is_active and passages.is_public");
    expect(sql).toContain("typing_results_ranked_domain_idx");
    expect(sql).toContain("validate constraint typing_results_metric_domain_check");
  });
});
