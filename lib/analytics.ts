import type { SupabaseAnalyticsTypingResultRow } from "./typingResultStorage";

export type ProgressAnalytics = {
  summary: {
    bestWpm: number;
    averageWpm: number;
    bestAccuracy: number;
    totalTests: number;
    totalPracticeSeconds: number;
  };
  recentTrend: SupabaseAnalyticsTypingResultRow[];
  records: {
    fastestOneMinute: SupabaseAnalyticsTypingResultRow | null;
    fastestFiveMinute: SupabaseAnalyticsTypingResultRow | null;
    highestAccuracy: SupabaseAnalyticsTypingResultRow | null;
  };
  categoryBreakdown: Array<{
    category: string;
    averageWpm: number;
    averageAccuracy: number;
    tests: number;
  }>;
};

const RECENT_TREND_LIMIT = 30;
const ONE_MINUTE_SECONDS = 60;
const FIVE_MINUTE_SECONDS = 300;

export function buildProgressAnalytics(results: SupabaseAnalyticsTypingResultRow[]): ProgressAnalytics {
  const normalizedResults = results.map((result) => ({
    ...result,
    passage_category: normalizeCategory(result.passage_category)
  }));
  const recentTrend = [...normalizedResults]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, RECENT_TREND_LIMIT)
    .reverse();

  return {
    summary: {
      bestWpm: roundOne(maxOrZero(normalizedResults.map((result) => result.wpm))),
      averageWpm: roundOne(average(normalizedResults.map((result) => result.wpm))),
      bestAccuracy: roundOne(maxOrZero(normalizedResults.map((result) => result.accuracy))),
      totalTests: normalizedResults.length,
      totalPracticeSeconds: normalizedResults.reduce((total, result) => total + result.duration_seconds, 0)
    },
    recentTrend,
    records: {
      fastestOneMinute: getFastestForDuration(normalizedResults, ONE_MINUTE_SECONDS),
      fastestFiveMinute: getFastestForDuration(normalizedResults, FIVE_MINUTE_SECONDS),
      highestAccuracy: getHighestAccuracy(normalizedResults)
    },
    categoryBreakdown: getCategoryBreakdown(normalizedResults)
  };
}

function getFastestForDuration(results: SupabaseAnalyticsTypingResultRow[], durationSeconds: number) {
  return [...results]
    .filter((result) => result.duration_seconds === durationSeconds)
    .sort(compareByWpmAccuracyAndDate)[0] ?? null;
}

function getHighestAccuracy(results: SupabaseAnalyticsTypingResultRow[]) {
  return [...results]
    .sort((left, right) => {
      if (right.accuracy !== left.accuracy) {
        return right.accuracy - left.accuracy;
      }

      return compareByWpmAccuracyAndDate(left, right);
    })[0] ?? null;
}

function getCategoryBreakdown(results: SupabaseAnalyticsTypingResultRow[]) {
  const categories = new Map<string, SupabaseAnalyticsTypingResultRow[]>();

  for (const result of results) {
    const category = normalizeCategory(result.passage_category);
    categories.set(category, [...(categories.get(category) ?? []), result]);
  }

  return Array.from(categories.entries())
    .map(([category, categoryResults]) => ({
      category,
      averageWpm: roundOne(average(categoryResults.map((result) => result.wpm))),
      averageAccuracy: roundOne(average(categoryResults.map((result) => result.accuracy))),
      tests: categoryResults.length
    }))
    .sort((left, right) => right.tests - left.tests || left.category.localeCompare(right.category));
}

function compareByWpmAccuracyAndDate(left: SupabaseAnalyticsTypingResultRow, right: SupabaseAnalyticsTypingResultRow) {
  if (right.wpm !== left.wpm) {
    return right.wpm - left.wpm;
  }

  if (right.accuracy !== left.accuracy) {
    return right.accuracy - left.accuracy;
  }

  return Date.parse(right.created_at) - Date.parse(left.created_at);
}

function normalizeCategory(category: string | null) {
  return category?.trim() || "Uncategorised";
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function maxOrZero(values: number[]) {
  return values.length > 0 ? Math.max(...values) : 0;
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}
