import { supabase } from "./supabaseClient";

export type SupabaseProfile = {
  user_id: string;
  display_name: string;
  handle: string | null;
  created_at: string;
  updated_at: string;
};

export type HandleValidationResult =
  | { isValid: true; handle: string }
  | { isValid: false; message: string };

export async function getSupabaseProfile(userId: string): Promise<SupabaseProfile | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase();
}

export function validateHandle(handle: string): HandleValidationResult {
  const cleanHandle = normalizeHandle(handle);

  if (cleanHandle.length < 3 || cleanHandle.length > 20) {
    return { isValid: false, message: "Handle must be 3-20 characters." };
  }

  if (!/^[a-z0-9_]+$/.test(cleanHandle)) {
    return { isValid: false, message: "Use letters, numbers, and underscores only." };
  }

  return { isValid: true, handle: cleanHandle };
}

export function getProfileDisplayLabel(profile: Pick<SupabaseProfile, "handle"> | null) {
  if (profile?.handle) {
    return `@${profile.handle}`;
  }

  return "Account";
}

export async function upsertSupabaseProfile(
  userId: string,
  displayName: string,
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  if (!client) {
    throw new Error("Supabase is not configured yet.");
  }

  const cleanDisplayName = displayName.trim();

  if (cleanDisplayName.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        display_name: cleanDisplayName
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function setSupabaseProfileHandle(
  userId: string,
  handle: string,
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  const validation = validateHandle(handle);

  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  const { data, error } = await client
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        display_name: validation.handle,
        handle: validation.handle
      },
      { onConflict: "user_id" }
    )
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("That handle is already taken.");
    }

    throw error;
  }

  return data;
}

function requireSupabaseClient(): any {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}
