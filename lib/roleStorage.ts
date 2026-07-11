import { supabase } from "./supabaseClient";

export type AppRole = "user" | "admin";

export async function getSupabaseUserRole(userId: string, client: any = supabase): Promise<AppRole> {
  if (!client) {
    return "user";
  }

  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role === "admin" ? "admin" : "user";
}
