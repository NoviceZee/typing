import { createRequire } from "node:module";
import type { SupabasePassageInsert, SupabasePassageRow, SupabasePassageUpdate } from "./supabasePassageTypes";

const require = createRequire(import.meta.url);
const { supabase } = require("./supabaseClient.ts");

export async function insertSupabasePassageRow(
  payload: SupabasePassageInsert,
  client = requireSupabaseClient()
): Promise<SupabasePassageRow> {
  const { data, error } = await client.from("passages").insert(payload).select("id").single();

  if (error) {
    throw error;
  }

  const inserted = await getSupabasePassageRowById(data.id, client);
  if (!inserted) throw new Error("Inserted passage was not returned by the admin passage reader.");
  return inserted;
}

export async function getSupabasePassageRowById(
  id: string,
  client = requireSupabaseClient()
): Promise<SupabasePassageRow | null> {
  const { data, error } = await client
    .rpc("get_admin_passage", { target_passage_id: id })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateSupabasePassageRow(
  id: string,
  payload: SupabasePassageUpdate,
  client = requireSupabaseClient()
): Promise<SupabasePassageRow> {
  const { error } = await client.from("passages").update(payload).eq("id", id).select("id").single();

  if (error) {
    throw error;
  }

  const updated = await getSupabasePassageRowById(id, client);
  if (!updated) throw new Error("Updated passage was not returned by the admin passage reader.");
  return updated;
}

export async function deleteSupabasePassageRow(id: string, client = requireSupabaseClient()): Promise<void> {
  const { error } = await client.from("passages").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

function requireSupabaseClient(): any {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}
