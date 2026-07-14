import { supabase } from "./supabaseClient";

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_FILE_SIZE_BYTES = 2 * 1024 * 1024;
export const HANDLE_CHANGE_COOLDOWN_DAYS = 30;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export type SupabaseProfile = {
  user_id: string;
  display_name: string;
  handle: string | null;
  bio: string | null;
  avatar_style: string | null;
  avatar_path: string | null;
  public_profile_enabled: boolean;
  handle_changed_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type SupabasePublicProfile = {
  handle: string;
  bio: string | null;
  avatar_style: string | null;
  avatar_path: string | null;
  public_profile_enabled: boolean;
  created_at: string | null;
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
    .select("handle,bio,avatar_style,avatar_path,public_profile_enabled,created_at")
    .eq("handle", cleanHandle)
    .maybeSingle();

  if (error) {
    if (isMissingIdentityColumnError(error)) {
      return getSupabaseLegacyPublicProfileByHandle(cleanHandle, client);
    }

    throw error;
  }

  return data;
}

export function getSupabaseAvatarPublicUrl(
  avatarPath: string | null | undefined,
  client = requireSupabaseClient()
): string | null {
  if (!avatarPath) {
    return null;
  }

  const { data } = client.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);
  return data.publicUrl;
}

export async function uploadSupabaseProfileAvatar(
  userId: string,
  file: File | Blob,
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  const contentType = file.type || "application/octet-stream";
  const fileSize = "size" in file ? file.size : 0;

  if (!ALLOWED_AVATAR_MIME_TYPES.has(contentType)) {
    throw new Error("Choose a PNG, JPG, or WebP image.");
  }

  if (fileSize > MAX_AVATAR_FILE_SIZE_BYTES) {
    throw new Error("Avatar image must be 2MB or smaller.");
  }

  const avatarPath = `${userId}/avatar.${getAvatarExtension(contentType)}`;
  const { error: uploadError } = await client.storage.from(AVATAR_BUCKET).upload(avatarPath, file, {
    cacheControl: "3600",
    contentType,
    upsert: true
  });

  if (uploadError) {
    throw uploadError;
  }

  return updateProfileAvatarPath(userId, avatarPath, client);
}

export async function removeSupabaseProfileAvatar(
  userId: string,
  avatarPath: string | null | undefined,
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  if (avatarPath) {
    if (!avatarPath.startsWith(`${userId}/`)) {
      throw new Error("Avatar path does not belong to this user.");
    }
  }

  const nextProfile = await updateProfileAvatarPath(userId, null, client);

  if (avatarPath) {
    const { error: removeError } = await client.storage.from(AVATAR_BUCKET).remove([avatarPath]);
    void removeError;
  }

  return nextProfile;
}

async function updateProfileAvatarPath(
  userId: string,
  avatarPath: string | null,
  client: ReturnType<typeof requireSupabaseClient>
): Promise<SupabaseProfile> {
  const { data, error } = await client
    .from("profiles")
    .update({ avatar_path: avatarPath })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getSupabaseLegacyPublicProfileByHandle(
  cleanHandle: string,
  client: ReturnType<typeof requireSupabaseClient>
): Promise<SupabasePublicProfile | null> {
  const { data, error } = await client
    .from("public_profiles")
    .select("handle")
    .eq("handle", cleanHandle)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    handle: data.handle,
    bio: null,
    avatar_style: null,
    avatar_path: null,
    public_profile_enabled: true,
    created_at: null
  };
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

export async function updateSupabaseProfileDisplayName(
  userId: string,
  displayName: string,
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  const cleanDisplayName = displayName.trim();
  if (cleanDisplayName.length < 2 || cleanDisplayName.length > 40) {
    throw new Error("Display name must be 2-40 characters.");
  }
  const { data, error } = await client.from("profiles").update({ display_name: cleanDisplayName }).eq("user_id", userId).select("*").single();
  if (error) throw error;
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

export function getNextHandleChangeAt(handleChangedAt?: string | null): Date | null {
  if (!handleChangedAt) return null;
  const changedAt = new Date(handleChangedAt);
  if (Number.isNaN(changedAt.getTime())) return null;
  return new Date(changedAt.getTime() + HANDLE_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
}

export function canChangeHandle(handleChangedAt?: string | null, now = new Date()) {
  const nextChangeAt = getNextHandleChangeAt(handleChangedAt);
  return !nextChangeAt || nextChangeAt.getTime() <= now.getTime();
}

export async function changeSupabaseProfileHandle(
  handle: string,
  client = requireSupabaseClient()
): Promise<SupabaseProfile> {
  const validation = validateHandle(handle);
  if (!validation.isValid) throw new Error(validation.message);

  const { data, error } = await client.rpc("change_own_handle", {
    new_handle: validation.handle
  });

  if (error) {
    if (error.code === "23505") throw new Error("That handle is already taken.");
    throw error;
  }

  return data;
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

function isMissingIdentityColumnError(error: { code?: string; message?: string }) {
  return error.code === "42703" || /column .* does not exist/i.test(error.message ?? "");
}

function getAvatarExtension(contentType: string) {
  if (contentType === "image/png") {
    return "png";
  }

  if (contentType === "image/webp") {
    return "webp";
  }

  return "jpg";
}
