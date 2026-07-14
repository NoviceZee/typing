import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type TestPrincipal = {
  label: "user-A" | "user-B" | "admin";
  client: SupabaseClient;
  user: User;
};

async function main() {
  loadEnvLocal();
  const url = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (process.env.SUPABASE_AUTHORIZATION_TEST_WRITES !== "true") {
    throw new Error("Set SUPABASE_AUTHORIZATION_TEST_WRITES=true only for a disposable staging project.");
  }

  const userA = await signIn(url, anonKey, "user-A", "SUPABASE_TEST_USER_A_EMAIL", "SUPABASE_TEST_USER_A_PASSWORD");
  const userB = await signIn(url, anonKey, "user-B", "SUPABASE_TEST_USER_B_EMAIL", "SUPABASE_TEST_USER_B_PASSWORD");
  const admin = await signIn(url, anonKey, "admin", "SUPABASE_TEST_ADMIN_EMAIL", "SUPABASE_TEST_ADMIN_PASSWORD");

  assert(new Set([userA.user.id, userB.user.id, admin.user.id]).size === 3, "Test principals must be distinct users.");
  await assertAdminState(userA, false);
  await assertAdminState(userB, false);
  await assertAdminState(admin, true);
  await assertOwnProfilesExist([userA, userB, admin]);
  await assertCrossUserReadsAreDenied(userA, userB);
  await assertCrossUserWritesAreDenied(userA, userB);
  await assertBlockAuthorization(userA, userB);
  await assertResultOwnershipIsServerDerived(userA, userB);
  await assertPassageAuthorization(userA, admin);

  for (const principal of [userA, userB, admin]) {
    await principal.client.auth.signOut();
  }

  console.log("[pass] authenticated RLS matrix: user-A, user-B and admin boundaries verified");
}

async function signIn(
  url: string,
  anonKey: string,
  label: TestPrincipal["label"],
  emailKey: string,
  passwordKey: string
): Promise<TestPrincipal> {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false }
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: requiredEnv(emailKey),
    password: requiredEnv(passwordKey)
  });

  if (error || !data.user) throw error ?? new Error(`${label} did not return an authenticated user.`);
  return { label, client, user: data.user };
}

async function assertAdminState(principal: TestPrincipal, expected: boolean) {
  const { data, error } = await principal.client.rpc("is_admin");
  if (error) throw error;
  assert(data === expected, `${principal.label} is_admin() expected ${expected}, received ${String(data)}.`);
}

async function assertOwnProfilesExist(principals: TestPrincipal[]) {
  for (const principal of principals) {
    const { data, error } = await principal.client
      .from("profiles")
      .select("user_id")
      .eq("user_id", principal.user.id);
    if (error) throw error;
    assert(data?.length === 1, `${principal.label} must have one own profile before the RLS test.`);
  }
}

async function assertCrossUserReadsAreDenied(userA: TestPrincipal, userB: TestPrincipal) {
  for (const table of ["profiles", "typing_results", "typing_attempt_details", "user_roles"]) {
    const { data, error } = await userA.client
      .from(table)
      .select("*")
      .eq("user_id", userB.user.id)
      .limit(1);
    if (error) throw error;
    assert((data?.length ?? 0) === 0, `${userA.label} could read ${userB.label}'s ${table} row.`);
  }

  const { data: friendships, error: friendshipsError } = await userA.client
    .from("friendships")
    .select("requester_id,addressee_id");
  if (friendshipsError) throw friendshipsError;
  assert(
    (friendships ?? []).every((row) => row.requester_id === userA.user.id || row.addressee_id === userA.user.id),
    `${userA.label} could read a friendship that does not involve them.`
  );
}

async function assertCrossUserWritesAreDenied(userA: TestPrincipal, userB: TestPrincipal) {
  const { data: profileUpdate, error: profileUpdateError } = await userA.client
    .from("profiles")
    .update({ bio: "authorization-audit-must-not-write" })
    .eq("user_id", userB.user.id)
    .select("user_id");
  if (profileUpdateError) throw profileUpdateError;
  assert((profileUpdate?.length ?? 0) === 0, `${userA.label} updated ${userB.label}'s profile.`);

  const { error: attemptError } = await userA.client.from("typing_attempt_details").insert({
    id: `authorization-audit-${randomUUID()}`,
    user_id: userB.user.id,
    completed_at: new Date().toISOString(),
    duration_seconds: 60,
    category: "Business email",
    wpm: 1,
    accuracy: 100,
    characters: [],
    timeline: []
  });
  assert(Boolean(attemptError), `${userA.label} inserted ${userB.label}'s attempt detail.`);

  const { error: friendshipError } = await userA.client.from("friendships").insert({
    requester_id: userB.user.id,
    addressee_id: userA.user.id,
    status: "pending"
  });
  assert(Boolean(friendshipError), `${userA.label} forged a request owned by ${userB.label}.`);

}

async function assertBlockAuthorization(userA: TestPrincipal, userB: TestPrincipal) {
  const [userAHandle, userBHandle] = await Promise.all([getProfileHandle(userA), getProfileHandle(userB)]);

  const { error: directReadError } = await userA.client.from("user_blocks").select("*").limit(1);
  assert(Boolean(directReadError), "Authenticated clients can read the private user_blocks base table.");

  const { error: directWriteError } = await userA.client.from("user_blocks").insert({
    blocker_id: userA.user.id,
    blocked_id: userB.user.id
  });
  assert(Boolean(directWriteError), "Authenticated clients can bypass the guarded block RPC.");

  await userA.client.rpc("unblock_user_by_handle", { target_handle: userBHandle });
  try {
    const { error: blockError } = await userA.client.rpc("block_user_by_handle", { target_handle: userBHandle });
    if (blockError) throw blockError;

    const { data: blockedUsers, error: listError } = await userA.client.rpc("list_blocked_users");
    if (listError) throw listError;
    assert(
      Array.isArray(blockedUsers) && blockedUsers.some((row) => row.handle === userBHandle),
      "Blocked user was not returned by the owner-scoped list RPC."
    );

    const { error: reverseRequestError } = await userB.client.rpc("send_friend_request_by_handle", {
      target_handle: userAHandle
    });
    assert(Boolean(reverseRequestError), "A blocked user sent a reverse friend request.");

    const { error: outboundRequestError } = await userA.client.rpc("send_friend_request_by_handle", {
      target_handle: userBHandle
    });
    assert(Boolean(outboundRequestError), "A blocker sent a friend request without unblocking first.");

    const { data: friendship, error: friendshipError } = await userA.client.rpc("get_friendship_with_handle", {
      target_handle: userBHandle
    });
    if (friendshipError) throw friendshipError;
    assert(friendship === null, "Blocking left a stale friendship or pending request behind.");
  } finally {
    const { error } = await userA.client.rpc("unblock_user_by_handle", { target_handle: userBHandle });
    if (error) throw error;
  }

  const { data: directFriendship, error: directFriendshipError } = await userA.client
    .from("friendships")
    .insert({ requester_id: userA.user.id, addressee_id: userB.user.id, status: "pending" })
    .select("id")
    .maybeSingle();
  if (directFriendship?.id) {
    await userA.client.from("friendships").delete().eq("id", directFriendship.id);
  }
  assert(Boolean(directFriendshipError), "Authenticated clients can bypass the guarded friend-request RPC.");
}

async function getProfileHandle(principal: TestPrincipal) {
  const { data, error } = await principal.client
    .from("profiles")
    .select("handle")
    .eq("user_id", principal.user.id)
    .single();
  if (error) throw error;
  assert(typeof data.handle === "string" && data.handle.length > 0, `${principal.label} needs a handle for block tests.`);
  return data.handle;
}

async function assertResultOwnershipIsServerDerived(userA: TestPrincipal, userB: TestPrincipal) {
  let resultId: string | null = null;

  try {
    const { data, error } = await userA.client
      .from("typing_results")
      .insert({
        user_id: userB.user.id,
        client_attempt_id: `authorization-audit-${randomUUID()}`,
        passage_id: null,
        passage_title: "Authorization audit",
        duration_seconds: 60,
        elapsed_seconds: 60,
        completion_reason: "time_up",
        is_rankable: false,
        metric_domain: "english",
        wpm: 1,
        accuracy: 100,
        correct_chars: 5,
        typed_chars: 5,
        created_at: "2000-01-01T00:00:00.000Z"
      })
      .select("id,user_id,created_at,is_rankable")
      .single();
    if (error) throw error;
    resultId = data.id;
    assert(data.user_id === userA.user.id, "Result owner was not replaced with auth.uid().");
    assert(data.created_at !== "2000-01-01T00:00:00.000Z", "Result timestamp remained client-controlled.");
    assert(data.is_rankable === true, "Coherent audit result was not server-classified as rankable.");
  } finally {
    if (resultId) {
      const { error } = await userA.client.from("typing_results").delete().eq("id", resultId);
      if (error) throw error;
    }
  }
}

async function assertPassageAuthorization(userA: TestPrincipal, admin: TestPrincipal) {
  const passage = {
    title: `Authorization audit ${randomUUID()}`,
    category: "Uncategorised",
    style: "Authorization audit",
    content: "This temporary passage verifies that passage administration is protected by database policy.",
    language: "english",
    is_active: false,
    is_public: false
  };

  const { error: nonAdminError } = await userA.client
    .from("passages")
    .insert({ ...passage, created_by: userA.user.id });
  assert(Boolean(nonAdminError), "A non-admin inserted a passage.");

  let passageId: string | null = null;
  try {
    const { data, error } = await admin.client
      .from("passages")
      .insert({ ...passage, created_by: admin.user.id })
      .select("id")
      .single();
    if (error) throw error;
    passageId = data.id;
  } finally {
    if (passageId) {
      const { error } = await admin.client.from("passages").delete().eq("id", passageId);
      if (error) throw error;
    }
  }
}

function requiredEnv(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
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
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fail] Supabase authorization verification: ${message}`);
  process.exitCode = 1;
});
