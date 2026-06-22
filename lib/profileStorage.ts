import { supabase } from "./supabaseClient";

export type SupabaseProfile = {
  user_id: string;
  display_name: string;
  handle: string | null;
  bio: string | null;
  avatar_style: string | null;
  public_profile_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type SupabasePublicProfile = {
  handle: string;
  bio: string | null;
  avatar_style: string | null;
  created_at: string;
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

export async function getSupabasePublicProfileByHandle(
  handle: string,
  client = requireSupabaseClient()
): Promise<SupabasePublicProfile | null> {
  const cleanHandle = normalizeHandle(handle);

  if (!cleanHandle) {
    return null;
  }

  const { data, error } = await client
    .from("public_profiles")
    .select("handle,bio,avatar_style,created_at")
    .eq("handle", cleanHandle)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSupabaseProfileIdentity(
  userId: string,
  identity: {
    bio?: string | null;
    avatar_style?: string | null;
    public_profile_enabled?: boolean;
  },
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  const cleanBio = identity.bio?.trim() || null;
  const avatarStyle = identity.avatar_style?.trim() || null;

  if (cleanBio && cleanBio.length > 180) {
    throw new Error("Bio must be 180 characters or fewer.");
  }

  if (avatarStyle && !/^[a-z0-9_-]{2,24}$/.test(avatarStyle)) {
    throw new Error("Avatar style is not valid.");
  }

  const updates: Record<string, string | boolean | null> = {
    bio: cleanBio,
    avatar_style: avatarStyle
  };

  if (typeof identity.public_profile_enabled === "boolean") {
    updates.public_profile_enabled = identity.public_profile_enabled;
  }

  const { data, error } = await client
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select("*")
    .single();

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
