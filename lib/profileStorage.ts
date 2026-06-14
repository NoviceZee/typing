import { supabase } from "./supabaseClient";

export type SupabaseProfile = {
  user_id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
};

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

export async function upsertSupabaseProfile(userId: string, displayName: string): Promise<SupabaseProfile> {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  const cleanDisplayName = displayName.trim();

  if (cleanDisplayName.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }

  const { data, error } = await supabase
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
