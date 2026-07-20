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

  it("enforces handle cooldowns and blocking below the client layer", () => {
    const sql = readMigration("202607140005_profile_handle_cooldown_and_user_blocks.sql");

    expect(sql).toContain("old.handle_changed_at > now() - interval '30 days'");
    expect(sql).toContain("new.handle_changed_at := old.handle_changed_at");
    expect(sql).toContain("where user_id = auth.uid()");
    expect(sql).toContain("alter table public.user_blocks enable row level security");
    expect(sql).toContain("blocker_id = auth.uid()");
    expect(sql).toContain("before insert or update on public.friendships");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("delete from public.friendships");
    expect(sql).toContain("This profile is unavailable for friend requests.");
    expect(sql).toContain("revoke all on public.user_blocks from anon, authenticated");
    expect(sql).toContain("revoke insert on public.friendships from authenticated");
    expect(sql).toContain("revoke execute on function public.block_user_by_handle(text) from public, anon");
  });

  it("restores the complete prescribed HKDSE Classical Chinese passages", () => {
    const sql = readMigration("202607190001_restore_hkdse_classics.sql");

    expect(sql).toContain("惠子謂莊子曰");
    expect(sql).toContain("安所困苦哉");
    expect(sql).toContain("為刎頸之交");
    expect(sql).toContain("array['廉頗藺相如列傳（節錄）', '廉頗藺相如列傳 (節錄)', '廉頗藺相如列傳']");
    expect(sql).toContain("作《師說》以貽之");
    expect(sql).toContain("是歲元和四年也");
    expect(sql).toContain("茍以天下之大，而從六國破亡之故事");
    expect(sql).toContain("array['出師表', '出師表（節錄）']");
    expect(sql).toContain("array['岳陽樓記', '岳陽樓記（節錄）']");
    expect(sql).toContain("array['六國論', '六國論（節錄）']");
    expect(sql).toContain("title in ('醉翁亭記（節錄）', '桃花源記（節錄）', '陋室銘', '愛蓮說', '蘭亭集序（節錄）')");
    expect(sql).toContain("row_number() over");
    expect(sql).toContain("and ranked.duplicate_rank > 1");
  });
});
