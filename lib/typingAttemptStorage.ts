import { supabase } from "./supabaseClient";
import type { TypingAttemptDetail } from "./typingStatistics";
import { isProgressionEligibleResult } from "./resultEligibility";
import { getLegacyDurationBucket, resolveResultDuration } from "./resultDuration";

type TypingAttemptDetailRow = {
  id: string;
  user_id: string;
  completed_at: string;
  duration_seconds: number;
  mode_duration_seconds?: number | null;
  elapsed_seconds?: number | null;
  category: string | null;
  wpm: number;
  accuracy: number;
  characters: TypingAttemptDetail["characters"];
  timeline: NonNullable<TypingAttemptDetail["timeline"]>;
};

export async function saveSupabaseTypingAttemptDetail(
  detail: TypingAttemptDetail,
  typingResultId?: string | null,
  client: any = requireSupabaseClient()
): Promise<void> {
  if (!detail.userId || !isProgressionEligibleResult(detail)) return;

  const { error } = await client.from("typing_attempt_details").upsert(toRow(detail, typingResultId));

  if (error) throw error;
}

function toRow(detail: TypingAttemptDetail, typingResultId?: string | null) {
  return {
    id: detail.id,
    user_id: detail.userId,
    typing_result_id: typingResultId ?? null,
    completed_at: detail.completedAt,
    duration_seconds: getLegacyDurationBucket(detail),
    mode_duration_seconds: detail.modeDurationSeconds,
    elapsed_seconds: detail.elapsedSeconds,
    category: detail.category ?? null,
    wpm: detail.wpm,
    accuracy: detail.accuracy,
    characters: detail.characters.slice(0, 1500),
    timeline: (detail.timeline ?? []).slice(0, 120),
    updated_at: new Date().toISOString()
  };
}

export async function getSupabaseTypingAttemptDetails(
  userId: string,
  limit = 50,
  client: any = requireSupabaseClient()
): Promise<TypingAttemptDetail[]> {
  const { data, error } = await client
    .from("typing_attempt_details")
    .select("id,user_id,completed_at,duration_seconds,mode_duration_seconds,elapsed_seconds,category,wpm,accuracy,characters,timeline")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map(fromRow).filter(isProgressionEligibleResult);
}

export async function syncLocalTypingAttemptDetails(
  details: TypingAttemptDetail[],
  client: any = requireSupabaseClient()
): Promise<void> {
  const syncableDetails = details
    .filter((detail) => detail.userId && isProgressionEligibleResult(detail))
    .map((detail) => toRow(detail));
  if (syncableDetails.length === 0) return;

  const { error } = await client.from("typing_attempt_details").upsert(syncableDetails, {
    onConflict: "id",
    ignoreDuplicates: true
  });
  if (error) throw error;
}

function fromRow(row: TypingAttemptDetailRow): TypingAttemptDetail {
  const duration = resolveResultDuration(row);
  return {
    id: row.id,
    userId: row.user_id,
    completedAt: row.completed_at,
    modeDurationSeconds: duration.modeDurationSeconds,
    elapsedSeconds: duration.elapsedSeconds,
    category: row.category,
    wpm: Number(row.wpm),
    accuracy: Number(row.accuracy),
    characters: Array.isArray(row.characters) ? row.characters : [],
    timeline: Array.isArray(row.timeline) ? row.timeline : []
  };
}

function requireSupabaseClient(): any {
  if (!supabase) throw new Error("Supabase is not configured yet.");
  return supabase;
}
