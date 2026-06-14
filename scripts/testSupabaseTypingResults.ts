import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const TEST_TITLE = "FormalType Supabase Typing Result Test";

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
    logStep("Inserting typing result");
    const { data: insertedResult, error: insertError } = await supabaseCrudClient
      .from("typing_results")
      .insert({
        user_id: authContext.userId,
        passage_id: null,
        passage_title: TEST_TITLE,
        duration_seconds: 60,
        wpm: 72,
        accuracy: 98.9,
        correct_chars: 180,
        typed_chars: 182
      })
      .select("*")
      .single();

    if (insertError) {
      throw insertError;
    }

    insertedResultId = insertedResult.id;
    logResult(`Inserted typing result ${insertedResult.id}`);

    logStep("Reading inserted typing result");
    const { data: fetchedResult, error: fetchError } = await supabaseCrudClient
      .from("typing_results")
      .select("*")
      .eq("id", insertedResult.id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    if (!fetchedResult) {
      throw new Error("Inserted typing result was not readable after insert.");
    }

    if (fetchedResult.user_id !== authContext.userId || fetchedResult.passage_title !== TEST_TITLE) {
      throw new Error("Fetched typing result did not match the inserted payload.");
    }

    logResult(`Fetched typing result ${fetchedResult.id}`);

    logStep("Deleting typing result");
    await deleteInsertedResult();
    await assertNoTestRowsRemain();
  } finally {
    await cleanupInsertedResult();
  }
}

async function signInForRls(): Promise<{ userId: string; accessToken: string }> {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error("Set SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD for authenticated typing result RLS verification.");
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

async function deleteInsertedResult() {
  if (!insertedResultId) {
    return;
  }

  const { error } = await supabaseCrudClient.from("typing_results").delete().eq("id", insertedResultId);

  if (error) {
    throw error;
  }

  logResult(`Deleted typing result ${insertedResultId}`);
  insertedResultId = null;
}

async function cleanupInsertedResult() {
  if (!insertedResultId) {
    return;
  }

  logStep(`Cleaning up typing result ${insertedResultId}`);

  try {
    await deleteInsertedResult();
  } catch (error) {
    logError("Cleanup failed. Delete this test row manually if it remains in Supabase.", error);
  }
}

async function assertNoTestRowsRemain() {
  logStep("Confirming no typing result test rows remain");
  const { error: deleteError } = await supabaseCrudClient
    .from("typing_results")
    .delete()
    .eq("passage_title", TEST_TITLE);

  if (deleteError) {
    throw deleteError;
  }

  const { data, error } = await supabaseCrudClient
    .from("typing_results")
    .select("id,passage_title")
    .eq("passage_title", TEST_TITLE);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    throw new Error(`Found ${data.length} remaining FormalType Supabase Typing Result Test row(s).`);
  }

  logResult("No FormalType Supabase Typing Result Test rows remain.");
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
  console.log(`\n[FormalType Supabase typing results] ${message}`);
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
  logError(
    "Supabase typing result verification failed. If the blocker is RLS, apply the typing_results migration before weakening policies.",
    error
  );
  process.exitCode = 1;
});
