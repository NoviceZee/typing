import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

type CheckResult = { label: string; detail: string };

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase public URL/key are not configured.");
  }

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const checks: CheckResult[] = [];

  for (const table of ["profiles", "typing_results", "typing_attempt_details", "friendships", "user_roles", "user_blocks"]) {
    const { data, error } = await client.from(table).select("*").limit(1);
    if (!error && (data?.length ?? 0) > 0) {
      throw new Error(`Anonymous client could read private base table ${table}.`);
    }
    checks.push({ label: `anon:${table}`, detail: error ? "access denied" : "zero rows" });
  }

  const { data: passages, error: passagesError } = await client
    .from("passages")
    .select("id,is_active,is_public")
    .limit(500);
  if (passagesError) throw passagesError;
  if ((passages ?? []).some((row) => row.is_active !== true || row.is_public !== true)) {
    throw new Error("Anonymous passage read exposed an inactive or private row.");
  }
  checks.push({ label: "anon:passages", detail: `${passages?.length ?? 0} active public rows` });

  const { data: profiles, error: profilesError } = await client
    .from("public_profiles")
    .select("handle,bio,avatar_style,avatar_path,public_profile_enabled,created_at")
    .limit(500);
  if (profilesError) throw profilesError;
  const privateProfiles = (profiles ?? []).filter((row) => row.public_profile_enabled === false);
  if (privateProfiles.some((row) => row.bio !== null || row.avatar_style !== null || row.avatar_path !== null || row.created_at !== null)) {
    throw new Error("A private public-profile row exposed identity metadata.");
  }
  checks.push({ label: "public_profiles", detail: `${profiles?.length ?? 0} rows; ${privateProfiles.length} private projections redacted` });

  const { data: publicResults, error: publicResultsError } = await client
    .from("public_profile_typing_results")
    .select("id,metric_domain,duration_seconds,wpm,accuracy,created_at")
    .limit(500);
  if (publicResultsError) throw publicResultsError;
  assertQualifyingResults(publicResults ?? [], "public profile");
  checks.push({ label: "public_profile_typing_results", detail: `${publicResults?.length ?? 0} qualifying rows` });

  const { data: leaderboard, error: leaderboardError } = await client
    .from("typing_results_leaderboard")
    .select("id,display_name,passage_title,passage_category,metric_domain,duration_seconds,wpm,accuracy,created_at")
    .limit(500);
  if (leaderboardError) throw leaderboardError;
  assertQualifyingResults(leaderboard ?? [], "leaderboard");
  if ((leaderboard ?? []).some((row) => "user_id" in row || "email" in row)) {
    throw new Error("Leaderboard projection exposed a private identifier.");
  }
  checks.push({ label: "typing_results_leaderboard", detail: `${leaderboard?.length ?? 0} qualifying public rows` });

  const { data: adminState, error: adminError } = await client.rpc("is_admin");
  if (adminError) {
    if (adminError.code !== "42501") throw adminError;
    checks.push({ label: "anon:is_admin", detail: "execution denied" });
  } else {
    if (adminState !== false) throw new Error("Anonymous is_admin() did not return false.");
    checks.push({ label: "anon:is_admin", detail: "false" });
  }

  for (const check of checks) {
    console.log(`[pass] ${check.label}: ${check.detail}`);
  }
}

function assertQualifyingResults(
  rows: Array<{ metric_domain?: unknown; duration_seconds: unknown; wpm: unknown; accuracy: unknown; created_at: unknown }>,
  label: string
) {
  for (const row of rows) {
    const duration = Number(row.duration_seconds);
    const wpm = Number(row.wpm);
    const accuracy = Number(row.accuracy);
    if (
      !["english", "chinese", "code"].includes(String(row.metric_domain)) ||
      !Number.isFinite(duration) || duration < 15 || duration > 86_400 ||
      !Number.isFinite(wpm) || wpm < 0 || wpm > 1_000 ||
      !Number.isFinite(accuracy) || accuracy < 70 || accuracy > 100 ||
      !Number.isFinite(Date.parse(String(row.created_at)))
    ) {
      throw new Error(`${label} exposed a non-qualifying result.`);
    }
  }
}

function loadEnvLocal() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : JSON.stringify(error);
  console.error(`[fail] Supabase public-boundary verification: ${message}`);
  process.exitCode = 1;
});
