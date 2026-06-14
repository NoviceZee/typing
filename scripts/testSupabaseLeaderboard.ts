import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const TEST_TITLE = "FormalType Supabase Leaderboard Display Name Test";
const TEST_DISPLAY_NAME = "FormalType Tester";

let supabaseClient: any;
let supabaseCrudClient: any;
let createClient: any;
let insertedResultId: string | null = null;
let previousProfile: { display_name: string } | null = null;
let profileTouched = false;

async function main() {
  loadEnvLocal();
  loadRuntimeModules();

  logStep("Checking Supabase configuration");

  if (!supabaseClient) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const authContext = await signInForRls();

  try {
    await prepareProfile(authContext.userId);
    await insertTestResult(authContext.userId);
    await verifyAnonymousLeaderboardRead();
  } finally {
    await cleanupTestResult();
    await restoreProfile(authContext.userId);
  }
}

async function signInForRls(): Promise<{ userId: string; accessToken: string }> {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD for leaderboard profile verification.");
  }

  logStep("Signing in test user for profile setup");
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  if (!data.user || !data.session?.access_token) {
    throw new Error("Supabase sign-in did not return a user and access token.");
  }

  supabaseCrudClient = createAuthenticatedCrudClient(data.session.access_token);
  logResult(`Signed in test user ${data.user.id}`);
  return { userId: data.user.id, accessToken: data.session.access_token };
}

async function prepareProfile(userId: string) {
  logStep("Saving test display name");
  const { data: profile, error: fetchError } = await supabaseCrudClient
    .from("profiles")
    .select("display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  previousProfile = profile;

  const { error } = await supabaseCrudClient.from("profiles").upsert(
    {
      user_id: userId,
      display_name: TEST_DISPLAY_NAME
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw error;
  }

  profileTouched = true;
  logResult(`Saved display name "${TEST_DISPLAY_NAME}".`);
}

async function insertTestResult(userId: string) {
  logStep("Inserting leaderboard test result");
  const { data, error } = await supabaseCrudClient
    .from("typing_results")
    .insert({
      user_id: userId,
      passage_id: null,
      passage_title: TEST_TITLE,
      duration_seconds: 60,
      wpm: 88,
      accuracy: 99.1,
      correct_chars: 220,
      typed_chars: 222
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  insertedResultId = data.id;
  logResult(`Inserted leaderboard result ${insertedResultId}.`);
}

async function verifyAnonymousLeaderboardRead() {
  logStep("Reading public leaderboard view as anonymous client");
  const { data, error } = await supabaseClient
    .from("typing_results_leaderboard")
    .select("id,display_name,passage_title,duration_seconds,wpm,accuracy,created_at")
    .eq("passage_title", TEST_TITLE)
    .order("wpm", { ascending: false })
    .order("accuracy", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const row = data?.[0];

  if (!row) {
    throw new Error("Leaderboard view did not return the inserted test result.");
  }

  if (row.display_name !== TEST_DISPLAY_NAME) {
    throw new Error(`Expected display_name "${TEST_DISPLAY_NAME}", got "${row.display_name}".`);
  }

  if ("user_id" in row || "email" in row) {
    throw new Error("Leaderboard view exposed user_id or email.");
  }

  logResult(`Read leaderboard display name "${row.display_name}".`);
  logResult("Selected columns exclude user_id and email/profile data.");
}

async function cleanupTestResult() {
  if (!insertedResultId) {
    return;
  }

  logStep(`Cleaning up leaderboard result ${insertedResultId}`);
  const { error } = await supabaseCrudClient.from("typing_results").delete().eq("id", insertedResultId);

  if (error) {
    throw error;
  }

  insertedResultId = null;
}

async function restoreProfile(userId: string) {
  if (!profileTouched) {
    return;
  }

  logStep("Restoring test user display name");

  if (previousProfile) {
    const { error } = await supabaseCrudClient.from("profiles").upsert(
      {
        user_id: userId,
        display_name: previousProfile.display_name
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw error;
    }

    logResult("Restored previous display name.");
    return;
  }

  const { error } = await supabaseCrudClient.from("profiles").delete().eq("user_id", userId);

  if (error) {
    throw error;
  }

  logResult("Removed temporary display name.");
}

function loadEnvLocal() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");

  if (!existsSync(envPath)) {
    return;
  }

  const envFile = readFileSync(envPath, "utf8");

  for (const line of envFile.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function loadRuntimeModules() {
  const supabaseModule = require("../lib/supabaseClient.ts");
  const supabaseJsModule = require("@supabase/supabase-js");

  if (!supabaseModule.isSupabaseConfigured || !supabaseModule.supabase) {
    return;
  }

  supabaseClient = supabaseModule.supabase;
  supabaseCrudClient = supabaseModule.supabase;
  createClient = supabaseJsModule.createClient;
}

function createAuthenticatedCrudClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

function logStep(message: string) {
  console.log(`\n[FormalType Supabase leaderboard] ${message}`);
}

function logResult(message: string) {
  console.log(`  ${message}`);
}

function logError(message: string, error: unknown) {
  console.error(`\n${message}`);

  if (error && typeof error === "object") {
    const maybeSupabaseError = error as { message?: string; code?: string; details?: string; hint?: string };
    console.error({
      message: maybeSupabaseError.message,
      code: maybeSupabaseError.code,
      details: maybeSupabaseError.details,
      hint: maybeSupabaseError.hint
    });
    return;
  }

  console.error(error);
}

main().catch((error) => {
  logError("Supabase leaderboard verification failed. Apply the leaderboard view migration, then rerun.", error);
  process.exitCode = 1;
});
