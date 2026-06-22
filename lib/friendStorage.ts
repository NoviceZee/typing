import { supabase } from "./supabaseClient";
import { validateHandle } from "./profileStorage";

export type FriendshipStatus = "pending" | "accepted";
export type FriendshipDirection = "incoming" | "outgoing" | "accepted";

export type SupabaseFriendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type FriendListItem = {
  id: string;
  user_id: string;
  handle: string;
  status: FriendshipStatus;
  direction: FriendshipDirection;
  created_at: string;
  updated_at: string;
};

export async function sendFriendRequestByProfileHandle(
  handle: string,
  client = requireSupabaseClient()
): Promise<SupabaseFriendship> {
  const validation = validateHandle(normalizeFriendHandle(handle));

  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  const { data, error } = await client.rpc("send_friend_request_by_handle", {
    target_handle: validation.handle
  });

  if (error) {
    throw error;
  }

  return data;
}

function normalizeFriendHandle(handle: string) {
  return handle.trim().replace(/^@+/, "");
}

export async function acceptFriendRequest(
  friendshipId: string,
  client = requireSupabaseClient()
): Promise<SupabaseFriendship> {
  const { data, error } = await client
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId)
    .eq("status", "pending")
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function rejectFriendRequest(friendshipId: string, client = requireSupabaseClient()): Promise<void> {
  const { error } = await client.from("friendships").delete().eq("id", friendshipId).eq("status", "pending");

  if (error) {
    throw error;
  }
}

export async function removeFriend(friendshipId: string, client = requireSupabaseClient()): Promise<void> {
  const { error } = await client.from("friendships").delete().eq("id", friendshipId).eq("status", "accepted");

  if (error) {
    throw error;
  }
}

export function listIncomingFriendRequests(client = requireSupabaseClient()): Promise<FriendListItem[]> {
  return listFriendships("pending", "incoming", client);
}

export function listOutgoingFriendRequests(client = requireSupabaseClient()): Promise<FriendListItem[]> {
  return listFriendships("pending", "outgoing", client);
}

export function listAcceptedFriends(client = requireSupabaseClient()): Promise<FriendListItem[]> {
  return listFriendships("accepted", "any", client);
}

export async function getFriendshipWithProfileHandle(
  handle: string,
  client = requireSupabaseClient()
): Promise<FriendListItem | null> {
  const validation = validateHandle(handle);

  if (!validation.isValid) {
    return null;
  }

  const { data, error } = await client.rpc("get_friendship_with_handle", {
    target_handle: validation.handle
  });

  if (error) {
    throw error;
  }

  return data;
}

async function listFriendships(
  status: FriendshipStatus,
  direction: "incoming" | "outgoing" | "any",
  client: any
): Promise<FriendListItem[]> {
  const { data, error } = await client.rpc("list_friendships", {
    request_direction: direction,
    request_status: status
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

function requireSupabaseClient(): any {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}
