import type { StoredPassage } from "./app-storage";
import { supabase } from "./supabaseClient";
import type { TypingResult } from "./typing-engine";

export type SupabaseTypingResultInsert = {
  user_id: string;
  passage_id: string | null;
  passage_title: string;
  duration_seconds: number;
  wpm: number;
  accuracy: number;
  correct_chars: number;
  typed_chars: number;
};

export type SupabaseTypingResultRow = SupabaseTypingResultInsert & {
  id: string;
  created_at: string;
};

export type SupabaseLeaderboardResultRow = {
  id: string;
  display_name: string;
  passage_title: string;
  passage_category: string | null;
  duration_seconds: number;
  wpm: number;
  accuracy: number;
  created_at: string;
};

export type SupabaseOwnTypingResultRow = {
  id: string;
  passage_title: string;
  duration_seconds: number;
  wpm: number;
  accuracy: number;
  created_at: string;
};

export type SupabaseLeaderboardFilters = {
  limit?: number;
  durationSeconds?: number | null;
  category?: string | null;
};

export type SaveTypingResultInput = {
  userId: string;
  passage: StoredPassage;
  result: TypingResult;
  typedCharacters: number;
  supabasePassageId?: string | null;
};

export function toSupabaseTypingResultInsert({
  userId,
  passage,
  result,
  typedCharacters,
  supabasePassageId
}: SaveTypingResultInput): SupabaseTypingResultInsert {
  return {
    user_id: userId,
    passage_id: isUuid(supabasePassageId) ? supabasePassageId : null,
    passage_title: passage.title?.trim() || "Untitled passage",
    duration_seconds: result.durationSeconds,
    wpm: result.wpm,
    accuracy: result.accuracy,
    correct_chars: result.correctCharacters,
    typed_chars: typedCharacters
  };
}

export async function saveSupabaseTypingResult(
  input: SaveTypingResultInput,
  client = requireSupabaseClient()
): Promise<SupabaseTypingResultRow> {
  const { data, error } = await client
    .from("typing_results")
    .insert(toSupabaseTypingResultInsert(input))
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSupabaseLeaderboardResults({
  limit = 25,
  durationSeconds,
  category
}: SupabaseLeaderboardFilters = {}): Promise<SupabaseLeaderboardResultRow[]> {
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("typing_results_leaderboard")
    .select("id,display_name,passage_title,passage_category,duration_seconds,wpm,accuracy,created_at")
    .order("wpm", { ascending: false })
    .order("accuracy", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (durationSeconds) {
    query = query.eq("duration_seconds", durationSeconds);
  }

  if (category?.trim()) {
    query = query.eq("passage_category", category.trim());
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getSupabaseLeaderboardCategories(limit = 200): Promise<string[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("typing_results_leaderboard")
    .select("passage_category")
    .not("passage_category", "is", null)
    .order("passage_category", { ascending: true })
    .limit(limit);

  if (error) {
    throw error;
  }

  return Array.from(new Set((data ?? []).map((row) => row.passage_category).filter(Boolean) as string[]));
}

export async function getSupabaseOwnTypingResultIds(resultIds: string[], userId: string): Promise<Set<string>> {
  const ids = resultIds.filter(Boolean);

  if (!supabase || ids.length === 0) {
    return new Set();
  }

  const { data, error } = await supabase.from("typing_results").select("id").eq("user_id", userId).in("id", ids);

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.id));
}

export async function getSupabaseOwnTypingResults(
  userId: string,
  limit = 50
): Promise<SupabaseOwnTypingResultRow[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("typing_results")
    .select("id,passage_title,duration_seconds,wpm,accuracy,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

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

function isUuid(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  );
}
