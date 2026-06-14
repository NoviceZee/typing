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
