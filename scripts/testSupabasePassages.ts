import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupabasePassageInsert, SupabasePassageRow, SupabasePassageUpdate } from "../lib/supabasePassageTypes";

const TEST_TITLE = "Typing Station Supabase CRUD Test";
const UPDATED_TITLE = "Typing Station Supabase CRUD Test Updated";
const IMPORT_TEST_TITLES = ["Typing Station Supabase Import Test A", "Typing Station Supabase Import Test B"];
const require = createRequire(import.meta.url);

let insertedPassageId: string | null = null;
let importedPassageIds: string[] = [];
let supabaseClient: any;
let supabaseCrudClient: any;
let createClient: any;
let insertSupabasePassageRow: (payload: SupabasePassageInsert, client?: any) => Promise<SupabasePassageRow>;
let deleteSupabasePassageRow: (id: string, client?: any) => Promise<void>;
let getSupabasePassageRowById: (id: string, client?: any) => Promise<SupabasePassageRow | null>;
let updateSupabasePassageRow: (
  id: string,
  payload: SupabasePassageUpdate,
  client?: any
) => Promise<SupabasePassageRow>;

async function main() {
  loadEnvLocal();
  loadRuntimeModules();

  logStep("Checking Supabase configuration");

  if (!supabaseClient) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const authContext = await signInForRls();
  const testPassage = makeTestPassage();

  try {
    await assertAuthenticatedUser(authContext.userId);

    logStep("Inserting test passage");
    const insertPayload = { ...testPassage, created_by: authContext.userId };
    logResult(`Signed-in user id: ${authContext.userId ?? "none"}`);
    logResult(`Session access token exists: ${Boolean(authContext.accessToken)}`);
    logResult(`Insert payload created_by: ${insertPayload.created_by ?? "null"}`);
    const insertedPassage = await insertSupabasePassageRow(insertPayload, supabaseCrudClient);
    insertedPassageId = insertedPassage.id;
    logResult(`Inserted ${insertedPassage.id}: ${insertedPassage.title}`);

    logStep("Confirming safe draft defaults");
    const fetchedPassage = await getSupabasePassageRowById(insertedPassage.id, supabaseCrudClient);
    assertPassage(fetchedPassage, "Inserted passage was not readable after insert.");
    assertReviewState(fetchedPassage, {
      risk_classification: null,
      review_status: "draft",
      reviewed_at: null,
      is_active: false,
      is_public: false
    });
    logResult(`Fetched safe draft ${fetchedPassage.id}: ${fetchedPassage.title}`);

    logStep("Rejecting invalid activation with nullable risk");
    await expectUpdateRejected(
      insertedPassage.id,
      {
        risk_classification: null,
        review_status: "approved",
        reviewed_at: new Date().toISOString(),
        is_active: true,
        is_public: true
      },
      "Invalid activation with null risk was accepted"
    );

    logStep("Approving risk-A passage atomically");
    const approvedPassage = await updateSupabasePassageRow(
      insertedPassage.id,
      {
        risk_classification: "A",
        source_type: "original",
        fictional: false,
        review_notes: "Integration approval.",
        review_status: "approved",
        reviewed_at: new Date().toISOString(),
        is_active: true,
        is_public: true
      },
      supabaseCrudClient
    );
    assertReviewState(approvedPassage, {
      risk_classification: "A",
      review_status: "approved",
      is_active: true,
      is_public: true
    });

    const { error: anonymousNotesError } = await createAnonClient()
      .from("passages")
      .select("review_notes")
      .limit(1);
    if (!anonymousNotesError) {
      throw new Error("Anonymous review_notes was directly selectable");
    }

    logStep("Resetting approval after a risk downgrade");
    const riskDowngraded = await updateSupabasePassageRow(
      insertedPassage.id,
      { risk_classification: "B" },
      supabaseCrudClient
    );
    if (
      riskDowngraded.review_status !== "pending_review" ||
      riskDowngraded.reviewed_at !== null ||
      riskDowngraded.is_active ||
      riskDowngraded.is_public
    ) {
      throw new Error("Risk downgrade did not reset approval");
    }

    await updateSupabasePassageRow(
      insertedPassage.id,
      {
        risk_classification: "A",
        review_status: "approved",
        reviewed_at: new Date().toISOString(),
        is_active: true,
        is_public: true
      },
      supabaseCrudClient
    );

    logStep("Resetting approval after a material edit");
    const materiallyEdited = await updateSupabasePassageRow(
      insertedPassage.id,
      {
        title: UPDATED_TITLE,
        content: "Updated Typing Station Supabase CRUD verification content."
      },
      supabaseCrudClient
    );
    if (
      materiallyEdited.review_status !== "pending_review" ||
      materiallyEdited.reviewed_at !== null ||
      materiallyEdited.is_active ||
      materiallyEdited.is_public
    ) {
      throw new Error("Material edit did not reset approval");
    }

    logStep("Persisting complete submitted draft");
    const submittedPassage = await updateSupabasePassageRow(
      insertedPassage.id,
      {
        title: "Typing Station Submitted Draft",
        content: "Submitted draft content persisted atomically.",
        risk_classification: "B",
        source_type: "licensed",
        fictional: true,
        review_notes: "Submitted draft notes.",
        review_status: "pending_review",
        reviewed_at: null,
        is_active: false,
        is_public: false
      },
      supabaseCrudClient
    );
    if (
      submittedPassage.title !== "Typing Station Submitted Draft" ||
      submittedPassage.review_notes !== "Submitted draft notes." ||
      submittedPassage.source_type !== "licensed" ||
      submittedPassage.review_status !== "pending_review"
    ) {
      throw new Error("Submitted draft fields were not persisted");
    }

    await updateSupabasePassageRow(
      insertedPassage.id,
      {
        risk_classification: "A",
        review_status: "approved",
        reviewed_at: new Date().toISOString(),
        is_active: true,
        is_public: true
      },
      supabaseCrudClient
    );

    logStep("Persisting complete rejected draft from an approved row");
    const rejectedPassage = await updateSupabasePassageRow(
      insertedPassage.id,
      {
        title: "Typing Station Rejected Draft",
        content: "Rejected draft content persisted atomically.",
        risk_classification: "C",
        source_type: "public_domain",
        fictional: false,
        review_notes: "Rejected draft notes.",
        review_status: "rejected",
        reviewed_at: null,
        is_active: false,
        is_public: false
      },
      supabaseCrudClient
    );
    if (
      rejectedPassage.title !== "Typing Station Rejected Draft" ||
      rejectedPassage.review_notes !== "Rejected draft notes." ||
      rejectedPassage.source_type !== "public_domain" ||
      rejectedPassage.review_status !== "rejected"
    ) {
      throw new Error("Rejected approved draft fields were not persisted");
    }

    logStep("Deleting test passage");
    await deleteSupabasePassageRow(insertedPassage.id, supabaseCrudClient);
    insertedPassageId = null;

    const deletedPassage = await getSupabasePassageRowById(insertedPassage.id, supabaseCrudClient);
    if (deletedPassage) {
      throw new Error(`Delete verification failed. Passage ${insertedPassage.id} is still readable.`);
    }

    logResult("Deleted test passage and confirmed it is no longer readable.");

    logStep("Importing safe private draft passages");
    const importedPassages = await insertSupabasePassageRows(
      IMPORT_TEST_TITLES.map((title, index) => ({
        title,
        category: "News article",
        style: "Simple",
        content: `Typing Station Supabase import verification content ${index + 1}.`,
        created_by: authContext.userId
      })),
      supabaseCrudClient
    );
    importedPassageIds = importedPassages.map((passage) => passage.id);
    for (const passage of importedPassages) {
      assertReviewState(passage, { review_status: "draft", is_active: false, is_public: false });
    }
    logResult(`Imported ${importedPassageIds.length} private draft passage rows.`);

    const publicBeforeApproval = await getPublicActiveImportedPassages();
    if (publicBeforeApproval.length !== 0) {
      throw new Error("Draft imports were visible through the public active passage filter.");
    }

    logStep("Approving imported passages atomically");
    for (const passage of importedPassages) {
      await updateSupabasePassageRow(
        passage.id,
        {
          risk_classification: "A",
          review_status: "approved",
          reviewed_at: new Date().toISOString(),
          is_active: true,
          is_public: true
        },
        supabaseCrudClient
      );
    }

    logStep("Reading imported passages through public active query");
    const publicImportedPassages = await getPublicActiveImportedPassages();

    if (publicImportedPassages.length !== IMPORT_TEST_TITLES.length) {
      throw new Error(
        `Expected ${IMPORT_TEST_TITLES.length} public active imported passages, got ${publicImportedPassages.length}.`
      );
    }

    logResult("Imported passages are readable through the public active passage filter.");

    await cleanupImportedPassages();
    await assertNoTestRowsRemain();
  } finally {
    await cleanupInsertedPassage();
    await cleanupImportedPassages();
  }
}

async function signInForRls(): Promise<{ userId: string | null; accessToken: string | null }> {
  const email = process.env.SUPABASE_TEST_EMAIL;
  const password = process.env.SUPABASE_TEST_PASSWORD;

  if (!email || !password) {
    logResult(
      "No SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD provided. Trying anon access; RLS may block insert if created_by is required."
    );
    supabaseCrudClient = supabaseClient;
    return { userId: null, accessToken: null };
  }

  logStep("Signing in test user for RLS");
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Supabase sign-in succeeded without a user.");
  }

  if (!data.session?.access_token) {
    throw new Error("Supabase sign-in succeeded without a session access token.");
  }

  supabaseCrudClient = createAuthenticatedCrudClient(data.session.access_token);
  logResult(`Signed in test user ${data.user.id}`);
  logResult(`Session access token exists: ${Boolean(data.session.access_token)}`);
  return { userId: data.user.id, accessToken: data.session.access_token };
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
    await deleteSupabasePassageRow(insertedPassageId, supabaseCrudClient ?? supabaseClient);
    logResult("Cleanup delete completed.");
  } catch (error) {
    logError("Cleanup failed. Delete this test row manually if it remains in Supabase.", error);
  } finally {
    insertedPassageId = null;
  }
}

async function cleanupImportedPassages() {
  if (importedPassageIds.length === 0) {
    return;
  }

  logStep(`Cleaning up ${importedPassageIds.length} imported test passage row(s)`);

  for (const passageId of importedPassageIds) {
    await deleteSupabasePassageRow(passageId, supabaseCrudClient ?? supabaseClient);
  }

  importedPassageIds = [];
  logResult("Imported passage cleanup completed.");
}

async function assertNoTestRowsRemain() {
  logStep("Confirming no CRUD test rows remain");
  const { data, error } = await (supabaseCrudClient ?? supabaseClient)
    .from("passages")
    .select("id,title")
    .in("title", [TEST_TITLE, UPDATED_TITLE, ...IMPORT_TEST_TITLES]);

  if (error) {
    throw error;
  }

  if (data && data.length > 0) {
    throw new Error(`Found ${data.length} remaining Typing Station Supabase CRUD Test row(s).`);
  }

  logResult("No Typing Station Supabase CRUD Test rows remain.");
}

async function insertSupabasePassageRows(
  payloads: SupabasePassageInsert[],
  client: any
): Promise<SupabasePassageRow[]> {
  const { data, error } = await client.from("passages").insert(payloads).select("id");

  if (error) {
    throw error;
  }

  const insertedIds = new Set((data ?? []).map((row: { id: string }) => row.id));
  const { data: adminPassages, error: adminError } = await client.rpc("get_admin_passages");
  if (adminError) throw adminError;
  return (adminPassages ?? []).filter((row: SupabasePassageRow) => insertedIds.has(row.id));
}

async function getPublicActiveImportedPassages(): Promise<Array<{ id: string; title: string }>> {
  const anonClient = createAnonClient();
  const { data, error } = await anonClient
    .from("public_passages")
    .select("id,title")
    .in("title", IMPORT_TEST_TITLES);

  if (error) {
    throw error;
  }

  return data ?? [];
}

function makeTestPassage(): SupabasePassageInsert {
  return {
    title: TEST_TITLE,
    category: "News article",
    style: "Simple",
    content: "Typing Station Supabase CRUD verification content.",
    source_type: "original",
    fictional: false,
    is_active: false,
    is_public: false
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
  const supabaseJsModule = require("@supabase/supabase-js");
  const passageStorageModule = require("../lib/supabasePassageStorage.ts");

  if (!supabaseModule.isSupabaseConfigured || !supabaseModule.supabase) {
    return;
  }

  supabaseClient = supabaseModule.supabase;
  supabaseCrudClient = supabaseModule.supabase;
  createClient = supabaseJsModule.createClient;
  insertSupabasePassageRow = passageStorageModule.insertSupabasePassageRow;
  deleteSupabasePassageRow = passageStorageModule.deleteSupabasePassageRow;
  getSupabasePassageRowById = passageStorageModule.getSupabasePassageRowById;
  updateSupabasePassageRow = passageStorageModule.updateSupabasePassageRow;
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

function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function assertPassage(passage: SupabasePassageRow | null, message: string): asserts passage is SupabasePassageRow {
  if (!passage) {
    throw new Error(message);
  }
}

function assertReviewState(passage: SupabasePassageRow, expected: Partial<SupabasePassageRow>) {
  for (const [key, value] of Object.entries(expected)) {
    if (passage[key as keyof SupabasePassageRow] !== value) {
      throw new Error(
        `Review-state verification failed for ${key}. Expected ${String(value)}, got ${String(
          passage[key as keyof SupabasePassageRow]
        )}.`
      );
    }
  }
}

async function expectUpdateRejected(id: string, payload: SupabasePassageUpdate, failureMessage: string) {
  try {
    await updateSupabasePassageRow(id, payload, supabaseCrudClient);
  } catch {
    return;
  }
  throw new Error(failureMessage);
}

function logStep(message: string) {
  console.log(`\n[Typing Station Supabase passages] ${message}`);
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
