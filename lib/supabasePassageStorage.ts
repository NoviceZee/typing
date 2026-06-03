import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { supabase } = require("./supabaseClient.ts");

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

type SupabasePassageInsert = {
  id?: string;
  title: string;
  category?: string | null;
  style?: string | null;
  content: string;
  is_active?: boolean;
  is_public?: boolean;
  created_by?: string | null;
};

type SupabasePassageUpdate = Partial<Omit<SupabasePassageInsert, "id" | "created_by">>;

export async function insertSupabasePassageRow(payload: SupabasePassageInsert): Promise<SupabasePassageRow> {
  const client = requireSupabaseClient();
  const { data, error } = await client.from("passages").insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSupabasePassageRowById(id: string): Promise<SupabasePassageRow | null> {
  const client = requireSupabaseClient();
  const { data, error } = await client.from("passages").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSupabasePassageRow(
  id: string,
  payload: SupabasePassageUpdate
): Promise<SupabasePassageRow> {
  const client = requireSupabaseClient();
  const { data, error } = await client.from("passages").update(payload).eq("id", id).select("*").single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteSupabasePassageRow(id: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client.from("passages").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

function requireSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}
