import { supabase } from "@/lib/supabaseClient";

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  return supabase;
}

export async function updateCurrentUserPassword(password: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
}

export async function deleteCurrentUserAccount() {
  const { error } = await requireClient().rpc("delete_current_user");
  if (error) throw error;
  await requireClient().auth.signOut();
}

export async function deleteCurrentUserStats() {
  const { error } = await requireClient().rpc("delete_current_user_stats");
  if (error) throw error;
  if (typeof window !== "undefined") {
    ["formaltype_previous_results", "formaltype_typing_attempt_details", "formaltype_previous_result"].forEach((key) => window.localStorage.removeItem(key));
  }
}
