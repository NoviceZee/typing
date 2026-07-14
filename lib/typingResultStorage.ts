import type { StoredPassage } from "./app-storage";
import { AnalyticsDomain, getResultAnalyticsDomain } from "./analyticsDomain";
import { LeaderboardTimeRange, getLeaderboardDateRange } from "./leaderboardFilters";
import { normalizeHandle } from "./profileStorage";
import { supabase } from "./supabaseClient";
import type { TypingResult } from "./typing-engine";

export type SupabaseTypingResultInsert = {
  user_id: string;
  client_attempt_id: string;
  passage_id: string | null;
  passage_title: string;
  duration_seconds: number;
  elapsed_seconds: number;
  completion_reason: TypingResult["completionReason"];
  is_rankable: boolean;
  metric_domain: AnalyticsDomain;
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
  metric_domain?: AnalyticsDomain;
  duration_seconds: number;
  wpm: number;
  accuracy: number;
  created_at: string;
};

export type SupabaseOwnTypingResultRow = {
  id: string;
  passage_title: string;
  passage_category?: string | null;
  metric_domain?: AnalyticsDomain;
  duration_seconds: number;
  wpm: number;
  accuracy: number;
  created_at: string;
};

export type SupabaseAnalyticsTypingResultRow = SupabaseOwnTypingResultRow & {
  passage_category: string | null;
  elapsed_seconds?: number;
  correct_chars: number;
};

export type SupabaseLeaderboardFilters = {
  limit?: number;
  durationSeconds?: number | null;
  category?: string | null;
  domain?: AnalyticsDomain;
  timeRange?: LeaderboardTimeRange;
  dateRange?: { start: Date; end: Date } | null;
};

export type SaveTypingResultInput = {
  userId: string;
  attemptId: string;
  passage: StoredPassage;
  result: TypingResult;
  typedCharacters: number;
  supabasePassageId?: string | null;
};

export function toSupabaseTypingResultInsert({
  userId,
  attemptId,
  passage,
  result,
  typedCharacters,
  supabasePassageId
}: SaveTypingResultInput): SupabaseTypingResultInsert {
  return {
    user_id: userId,
    client_attempt_id: attemptId,
    passage_id: isUuid(supabasePassageId) ? supabasePassageId : null,
    passage_title: passage.title?.trim() || "Untitled passage",
    duration_seconds: result.durationSeconds,
    elapsed_seconds: result.timeUsedSeconds,
    completion_reason: result.completionReason,
    is_rankable: result.isRankable,
    metric_domain: getResultAnalyticsDomain({
      category: result.category ?? passage.category,
      title: passage.title
    }),
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
  const payload = toSupabaseTypingResultInsert(input);
  const { data, error } = await client
    .from("typing_results")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && payload.client_attempt_id) {
      const { data: existing, error: existingError } = await client
        .from("typing_results")
        .select("*")
        .eq("user_id", payload.user_id)
        .eq("client_attempt_id", payload.client_attempt_id)
        .maybeSingle();
      if (!existingError && existing) return existing;
    }
    throw error;
  }

  return data;
}

export async function getSupabaseLeaderboardResults({
  limit = 25,
  durationSeconds,
  category,
  domain = "english",
  timeRange,
  dateRange
}: SupabaseLeaderboardFilters = {}, client = supabase): Promise<SupabaseLeaderboardResultRow[]> {
  if (!client) {
    return [];
  }

  let query = client
    .from("typing_results_leaderboard")
    .select("id,display_name,passage_title,passage_category,metric_domain,duration_seconds,wpm,accuracy,created_at")
    .order("wpm", { ascending: false })
    .order("accuracy", { ascending: false })
    .order("created_at", { ascending: false });

  if (durationSeconds) {
    query = query.eq("duration_seconds", durationSeconds);
  }

  if (category?.trim()) {
    query = query.eq("passage_category", category.trim());
  } else {
    query = applyLeaderboardDomainFilter(query, domain);
  }

  const resolvedDateRange = dateRange === undefined && timeRange ? getLeaderboardDateRange(timeRange) : dateRange;

  if (resolvedDateRange) {
    query = query.gte("created_at", resolvedDateRange.start.toISOString());
    query = query.lt("created_at", resolvedDateRange.end.toISOString());
  }

  const { data, error } = await query.limit(limit);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getSupabaseLeaderboardCategories(limit = 200, domain: AnalyticsDomain = "english"): Promise<string[]> {
  if (!supabase) {
    return [];
  }

  let query = supabase
    .from("typing_results_leaderboard")
    .select("passage_category,metric_domain")
    .not("passage_category", "is", null)
    .order("passage_category", { ascending: true });

  query = applyLeaderboardDomainFilter(query, domain);

  const { data, error } = await query.limit(limit);

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
    .select("id,passage_title,metric_domain,duration_seconds,wpm,accuracy,created_at,passages(category)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(toSupabaseOwnTypingResultRow);
}

export async function getSupabaseAnalyticsTypingResults(
  userId: string,
  limit = 1000,
  client = requireSupabaseClient()
): Promise<SupabaseAnalyticsTypingResultRow[]> {
  const { data, error } = await client
    .from("typing_results")
    .select("id,passage_title,metric_domain,duration_seconds,elapsed_seconds,wpm,accuracy,correct_chars,created_at,passages(category)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(toSupabaseAnalyticsTypingResultRow);
}

export async function getSupabasePublicTypingResultsByHandle(
  handle: string,
  limit = 1000,
  client = requireSupabaseClient()
): Promise<SupabaseAnalyticsTypingResultRow[]> {
  const cleanHandle = normalizeHandle(handle);

  if (!cleanHandle) {
    return [];
  }

  const { data, error } = await client
    .from("public_profile_typing_results")
    .select("id,passage_title,passage_category,metric_domain,duration_seconds,wpm,accuracy,correct_chars,created_at")
    .eq("handle", cleanHandle)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(toSupabasePublicTypingResultRow);
}

function requireSupabaseClient(): any {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  return supabase;
}

function toSupabaseAnalyticsTypingResultRow(row: any): SupabaseAnalyticsTypingResultRow {
  const passage = Array.isArray(row.passages) ? row.passages[0] : row.passages;

  return {
    id: row.id,
    passage_title: row.passage_title,
    passage_category: passage?.category ?? null,
    ...toMetricDomainField(row.metric_domain),
    duration_seconds: Number(row.duration_seconds),
    ...(row.elapsed_seconds == null ? {} : { elapsed_seconds: Number(row.elapsed_seconds) }),
    wpm: Number(row.wpm),
    accuracy: Number(row.accuracy),
    correct_chars: Number(row.correct_chars ?? 0),
    created_at: row.created_at
  };
}

function toSupabaseOwnTypingResultRow(row: any): SupabaseOwnTypingResultRow {
  const passage = Array.isArray(row.passages) ? row.passages[0] : row.passages;

  return {
    id: row.id,
    passage_title: row.passage_title,
    passage_category: passage?.category ?? row.passage_category ?? null,
    ...toMetricDomainField(row.metric_domain),
    duration_seconds: Number(row.duration_seconds),
    wpm: Number(row.wpm),
    accuracy: Number(row.accuracy),
    created_at: row.created_at
  };
}

function toSupabasePublicTypingResultRow(row: any): SupabaseAnalyticsTypingResultRow {
  return {
    id: row.id,
    passage_title: row.passage_title,
    passage_category: row.passage_category ?? null,
    ...toMetricDomainField(row.metric_domain),
    duration_seconds: Number(row.duration_seconds),
    wpm: Number(row.wpm),
    accuracy: Number(row.accuracy),
    correct_chars: Number(row.correct_chars ?? 0),
    created_at: row.created_at
  };
}

function applyLeaderboardDomainFilter(query: any, domain: AnalyticsDomain) {
  return query.eq("metric_domain", domain);
}

function toMetricDomainField(value: unknown): { metric_domain?: AnalyticsDomain } {
  return value === "english" || value === "chinese" || value === "code"
    ? { metric_domain: value }
    : {};
}

function isUuid(value?: string | null): value is string {
  return Boolean(
    value?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  );
}
