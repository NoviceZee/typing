import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type SupabasePassageInsert = {
  title: string;
  category?: string | null;
  style?: string | null;
  content: string;
  is_active?: boolean;
  is_public?: boolean;
  created_by?: string | null;
};

type SupabasePassageRow = {
  id: string;
  title: string;
  category: string | null;
  style: string | null;
  content: string;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

const TEST_TITLE = "FormalType Supabase CRUD Test";
const UPDATED_TITLE = "FormalType Supabase CRUD Test Updated";
const require = createRequire(import.meta.url);

let insertedPassageId: string | null = null;
let supabaseClient: any;
let insertSupabasePassageRow: (payload: SupabasePassageInsert, client?: any) => Promise<SupabasePassageRow>;
let deleteSupabasePassageRow: (id: string, client?: any) => Promise<void>;
let getSupabasePassageRowById: (id: string, client?: any) => Promise<SupabasePassageRow | null>;
let updateSupabasePassageRow: (
  id: string,
  payload: Partial<SupabasePassageInsert>,
  client?: any
) => Promise<SupabasePassageRow>;

async function main() {
  loadEnvLocal();
  loadRuntimeModules();

  logStep("Checking Supabase configuration");

  if (!supabaseClient) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const createdBy = await signInForRls();
  const testPassage = makeTestPassage();

  try {
    await assertAuthenticatedUser(createdBy);

    logStep("Inserting test passage");
    const insertedPassage = await insertSupabasePassageRow({ ...testPassage, created_by: createdBy }, supabaseClient);
    insertedPassageId = insertedPassage.id;
    logResult(`Inserted ${insertedPassage.id}: ${insertedPassage.title}`);

    logStep("Fetching inserted passage");
    const fetchedPassage = await getSupabasePassageRowById(insertedPassage.id, supabaseClient);
    assertPassage(fetchedPassage, "Inserted passage was not readable after insert.");
    logResult(`Fetched ${fetchedPassage.id}: ${fetchedPassage.title}`);

    logStep("Updating test passage");
    const updatedPassage = await updateSupabasePassageRow(
      insertedPassage.id,
      {
        title: UPDATED_TITLE,
        content: "Updated FormalType Supabase CRUD verification content."
      },
      supabaseClient
    );
    logResult(`Updated ${updatedPassage.id}: ${updatedPassage.title}`);

    logStep("Fetching updated passage");
    const refetchedPassage = await getSupabasePassageRowById(insertedPassage.id, supabaseClient);
    assertPassage(refetchedPassage, "Updated passage was not readable after update.");

    if (refetchedPassage.title !== UPDATED_TITLE) {
      throw new Error(`Update verification failed. Expected "${UPDATED_TITLE}", got "${refetchedPassage.title}".`);
    }

    logResult(`Confirmed update for ${refetchedPassage.id}`);

    logStep("Deleting test passage");
    await deleteSupabasePassageRow(insertedPassage.id, supabaseClient);
    insertedPassageId = null;

    const deletedPassage = await getSupabasePassageRowById(insertedPassage.id, supabaseClient);
    if (deletedPassage) {
      throw new Error(`Delete verification failed. Passage ${insertedPassage.id} is still readable.`);
    }

    logResult("Deleted test passage and confirmed it is no longer readable.");
    await assertNoTestRowsRemain();
  } finally {
    await cleanupInsertedPassage();
  }
}

async function signInForRls(): Promise<string | null> {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;

  if (!email || !password) {
    logResult(
      "No SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD provided. Trying anon access; RLS may block insert if created_by is required."
    );
    return null;
  }

  logStep("Signing in test user for RLS");
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Supabase sign-in succeeded without a user.");
  }

  logResult(`Signed in test user ${data.user.id}`);
  return data.user.id;
}

async function assertAuthenticatedUser(expectedUserId: string | null) {
  if (!expectedUserId) {
    return;
  }

  logStep("Confirming authenticated Supabase session before insert");
  const { data, error } = await supabaseClient.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user || data.user.id !== expectedUserId) {
    throw new Error("Authenticated Supabase client user does not match the created_by value.");
  }

  logResult(`Authenticated session confirmed for ${data.user.id}`);
}

async function cleanupInsertedPassage() {
  if (!insertedPassageId) {
    return;
  }

  logStep(`Cleaning up test passage ${insertedPassageId}`);

  try {
    await deleteSupabasePassageRow(insertedPassageId, supabaseClient);
    logResult("Cleanup delete completed.");
  } catch (error) {
    logError("Cleanup failed. Delete this test row manually if it remains in Supabase.", error);
  } finally {
    insertedPassageId = null;
  }
}

async function assertNoTestRowsRemain() {
  logStep("Confirming no CRUD test rows remain");
  const { data, error } = await supabaseClient
    .from("passages")
    .select("id,title")
    .in("title", [TEST_TITLE, UPDATED_TITLE]);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    throw new Error(`Found ${data.length} remaining FormalType Supabase CRUD Test row(s).`);
  }

  logResult("No FormalType Supabase CRUD Test rows remain.");
}

function makeTestPassage(): SupabasePassageInsert {
  return {
    title: TEST_TITLE,
    category: "News article",
    style: "Simple",
    content: "FormalType Supabase CRUD verification content.",
    is_active: true,
    is_public: true
  };
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
  const passageStorageModule = require("../lib/supabasePassageStorage.ts");

  if (!supabaseModule.isSupabaseConfigured || !supabaseModule.supabase) {
    return;
  }

  supabaseClient = supabaseModule.supabase;
  insertSupabasePassageRow = passageStorageModule.insertSupabasePassageRow;
  deleteSupabasePassageRow = passageStorageModule.deleteSupabasePassageRow;
  getSupabasePassageRowById = passageStorageModule.getSupabasePassageRowById;
  updateSupabasePassageRow = passageStorageModule.updateSupabasePassageRow;
}

function assertPassage(passage: SupabasePassageRow | null, message: string): asserts passage is SupabasePassageRow {
  if (!passage) {
    throw new Error(message);
  }
}

function logStep(message: string) {
  console.log(`\n[FormalType Supabase passages] ${message}`);
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
    "Supabase passage CRUD verification failed. If the blocker is RLS, provide SUPABASE_TEST_EMAIL and SUPABASE_TEST_PASSWORD for an authenticated test user rather than weakening production policies.",
    error
  );
  process.exitCode = 1;
});
