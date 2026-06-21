import type { SupabaseAnalyticsTypingResultRow } from "./typingResultStorage";

export type ProgressAnalytics = {
  summary: {
    bestWpm: number;
    averageWpm: number;
    averageWpmLast10: number;
    averageWpmLast100: number;
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
  weakestCategory: {
    category: string;
    averageWpm: number;
    averageAccuracy: number;
    tests: number;
  } | null;
  activity: {
    currentStreakDays: number;
    activeDays: number;
    activeDates: string[];
  };
  achievements: {
    unlockedCount: number;
    totalCount: number;
    items: Achievement[];
  };
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  isUnlocked: boolean;
};

const RECENT_TREND_LIMIT = 30;
const ONE_MINUTE_SECONDS = 60;
const FIVE_MINUTE_SECONDS = 300;

export function buildProgressAnalytics(results: SupabaseAnalyticsTypingResultRow[]): ProgressAnalytics {
  const normalizedResults = results.map((result) => ({
    ...result,
    passage_category: normalizeCategory(result.passage_category)
  }));
  const newestFirst = [...normalizedResults].sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
  const recentTrend = [...normalizedResults]
    .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at))
    .slice(0, RECENT_TREND_LIMIT)
    .reverse();
  const categoryBreakdown = getCategoryBreakdown(normalizedResults);
  const summary = {
    bestWpm: roundOne(maxOrZero(normalizedResults.map((result) => result.wpm))),
    averageWpm: roundOne(average(normalizedResults.map((result) => result.wpm))),
    averageWpmLast10: roundOne(average(newestFirst.slice(0, 10).map((result) => result.wpm))),
    averageWpmLast100: roundOne(average(newestFirst.slice(0, 100).map((result) => result.wpm))),
    bestAccuracy: roundOne(maxOrZero(normalizedResults.map((result) => result.accuracy))),
    totalTests: normalizedResults.length,
    totalPracticeSeconds: normalizedResults.reduce((total, result) => total + result.duration_seconds, 0)
  };
  const activity = getActivitySummary(normalizedResults);

  return {
    summary,
    recentTrend,
    records: {
      fastestOneMinute: getFastestForDuration(normalizedResults, ONE_MINUTE_SECONDS),
      fastestFiveMinute: getFastestForDuration(normalizedResults, FIVE_MINUTE_SECONDS),
      highestAccuracy: getHighestAccuracy(normalizedResults)
    },
    categoryBreakdown,
    weakestCategory: getWeakestCategory(categoryBreakdown),
    activity,
    achievements: getAchievements(summary, activity)
  };
}

function getAchievements(
  summary: ProgressAnalytics["summary"],
  activity: ProgressAnalytics["activity"]
): ProgressAnalytics["achievements"] {
  const items: Achievement[] = [
    {
      id: "first-test",
      title: "First Test",
      description: "Save your first typing result.",
      isUnlocked: summary.totalTests >= 1
    },
    {
      id: "getting-started",
      title: "Getting Started",
      description: "Save 10 typing results.",
      isUnlocked: summary.totalTests >= 10
    },
    {
      id: "dedicated-typist",
      title: "Dedicated Typist",
      description: "Save 50 typing results.",
      isUnlocked: summary.totalTests >= 50
    },
    {
      id: "century-club",
      title: "Century Club",
      description: "Save 100 typing results.",
      isUnlocked: summary.totalTests >= 100
    },
    {
      id: "speed-40",
      title: "Speed 40",
      description: "Reach 40 WPM in a saved result.",
      isUnlocked: summary.bestWpm >= 40
    },
    {
      id: "speed-50",
      title: "Speed 50",
      description: "Reach 50 WPM in a saved result.",
      isUnlocked: summary.bestWpm >= 50
    },
    {
      id: "speed-60",
      title: "Speed 60",
      description: "Reach 60 WPM in a saved result.",
      isUnlocked: summary.bestWpm >= 60
    },
    {
      id: "accuracy-95",
      title: "Accuracy 95",
      description: "Reach 95% accuracy in a saved result.",
      isUnlocked: summary.bestAccuracy >= 95
    },
    {
      id: "accuracy-99",
      title: "Accuracy 99",
      description: "Reach 99% accuracy in a saved result.",
      isUnlocked: summary.bestAccuracy >= 99
    },
    {
      id: "perfect-accuracy",
      title: "Perfect Accuracy",
      description: "Save a result with 100% accuracy.",
      isUnlocked: summary.bestAccuracy === 100
    },
    {
      id: "three-day-streak",
      title: "Three-Day Streak",
      description: "Practice on 3 consecutive days.",
      isUnlocked: activity.currentStreakDays >= 3
    },
    {
      id: "seven-day-streak",
      title: "Seven-Day Streak",
      description: "Practice on 7 consecutive days.",
      isUnlocked: activity.currentStreakDays >= 7
    }
  ];

  return {
    unlockedCount: items.filter((item) => item.isUnlocked).length,
    totalCount: items.length,
    items
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

function getWeakestCategory(categories: ProgressAnalytics["categoryBreakdown"]) {
  return [...categories].sort((left, right) => left.averageWpm - right.averageWpm || left.averageAccuracy - right.averageAccuracy)[0] ?? null;
}

function getActivitySummary(results: SupabaseAnalyticsTypingResultRow[]) {
  const activeDates = Array.from(new Set(results.map((result) => toDateKey(result.created_at)).filter(Boolean) as string[])).sort();

  return {
    currentStreakDays: getCurrentStreakDays(activeDates),
    activeDays: activeDates.length,
    activeDates
  };
}

function getCurrentStreakDays(activeDates: string[]) {
  if (activeDates.length === 0) {
    return 0;
  }

  const activeDateSet = new Set(activeDates);
  let streak = 0;
  let cursor = parseDateKey(activeDates[activeDates.length - 1]);

  while (activeDateSet.has(toDateKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
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

function toDateKey(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function parseDateKey(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
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
