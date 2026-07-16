import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const TEST_TITLE = "Typing Station Supabase Own Results Test";

let insertedResultId: string | null = null;
let supabaseClient: any;
let supabaseCrudClient: any;
let createClient: any;

async function main() {
  loadEnvLocal();
  loadRuntimeModules();

  logStep("Checking Supabase configuration");

  if (!supabaseClient) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const authContext = await signInForRls();

  try {
    await insertTestResult(authContext.userId);
    await verifyOwnResults(authContext.userId);
  } finally {
    await cleanupInsertedResult();
  }
}

async function signInForRls(): Promise<{ userId: string; accessToken: string }> {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD for authenticated own-results verification.");
  }

  logStep("Signing in test user for RLS");
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

async function insertTestResult(userId: string) {
  logStep("Inserting own-results test row");
  const { data, error } = await supabaseCrudClient
    .from("typing_results")
    .insert({
      user_id: userId,
      passage_id: null,
      passage_title: TEST_TITLE,
      duration_seconds: 60,
      wpm: 66,
      accuracy: 97.5,
      correct_chars: 165,
      typed_chars: 170
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  insertedResultId = data.id;
  logResult(`Inserted own-results row ${insertedResultId}`);
}

async function verifyOwnResults(expectedUserId: string) {
  logStep("Reading current user's typing_results rows");
  const { data, error } = await supabaseCrudClient
    .from("typing_results")
    .select("id,user_id,passage_title,duration_seconds,wpm,accuracy,created_at")
    .eq("user_id", expectedUserId)
    .eq("passage_title", TEST_TITLE)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  if (!data || data.length !== 1) {
    throw new Error(`Expected exactly one own-results row, got ${data?.length ?? 0}.`);
  }

  const row = data[0];

  if (row.user_id !== expectedUserId) {
    throw new Error("Own-results query returned a row for another user.");
  }

  if (row.passage_title !== TEST_TITLE || Number(row.wpm) !== 66 || Number(row.accuracy) !== 97.5) {
    throw new Error("Own-results row did not match the inserted payload.");
  }

  logResult("Own-results query returned exactly the current user's test row.");
}

async function cleanupInsertedResult() {
  if (!insertedResultId) {
    return;
  }

  logStep(`Cleaning up own-results row ${insertedResultId}`);
  const { error } = await supabaseCrudClient.from("typing_results").delete().eq("id", insertedResultId);

  if (error) {
    throw error;
  }

  insertedResultId = null;
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
  console.log(`\n[Typing Station Supabase own results] ${message}`);
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
  logError("Supabase own-results verification failed.", error);
  process.exitCode = 1;
});
