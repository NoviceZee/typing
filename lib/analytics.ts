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
    totalWordsTyped: number;
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
  progression: {
    totalXp: number;
    currentLevel: number;
    currentLevelXp: number;
    xpForNextLevel: number;
    xpToNextLevel: number;
    progressPercent: number;
  };
  improvement: {
    averageWpmGain: number;
  };
  challenges: {
    daily: ChallengeGroup;
    weekly: ChallengeGroup;
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

export type ChallengeGroup = {
  title: string;
  items: ChallengeItem[];
};

export type ChallengeItem = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  unit: string;
  isComplete: boolean;
};

type BuildProgressAnalyticsOptions = {
  now?: Date;
};

const RECENT_TREND_LIMIT = 30;
const ONE_MINUTE_SECONDS = 60;
const FIVE_MINUTE_SECONDS = 300;
const LEVEL_XP = 100;

export function buildProgressAnalytics(
  results: SupabaseAnalyticsTypingResultRow[],
  options: BuildProgressAnalyticsOptions = {}
): ProgressAnalytics {
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
    totalPracticeSeconds: normalizedResults.reduce((total, result) => total + result.duration_seconds, 0),
    totalWordsTyped: Math.floor(normalizedResults.reduce((total, result) => total + Math.max(0, result.correct_chars), 0) / 5)
  };
  const activity = getActivitySummary(normalizedResults);
  const progression = getProgression(normalizedResults, activity);
  const improvement = getImprovement(normalizedResults);
  const challenges = getChallenges(normalizedResults, options.now ?? new Date());

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
    progression,
    improvement,
    challenges,
    achievements: getAchievements(summary, activity, categoryBreakdown, improvement)
  };
}

function getAchievements(
  summary: ProgressAnalytics["summary"],
  activity: ProgressAnalytics["activity"],
  categoryBreakdown: ProgressAnalytics["categoryBreakdown"],
  improvement: ProgressAnalytics["improvement"]
): ProgressAnalytics["achievements"] {
  const bestCategoryCount = maxOrZero(categoryBreakdown.map((category) => category.tests));
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
    },
    {
      id: "fourteen-day-streak",
      title: "14-Day Streak",
      description: "Practice on 14 consecutive days.",
      isUnlocked: activity.currentStreakDays >= 14
    },
    {
      id: "thirty-day-streak",
      title: "30-Day Streak",
      description: "Practice on 30 consecutive days.",
      isUnlocked: activity.currentStreakDays >= 30
    },
    {
      id: "hundred-day-streak",
      title: "100-Day Streak",
      description: "Practice on 100 consecutive days.",
      isUnlocked: activity.currentStreakDays >= 100
    },
    {
      id: "words-1000",
      title: "1,000 Words",
      description: "Type 1,000 saved words.",
      isUnlocked: summary.totalWordsTyped >= 1000
    },
    {
      id: "words-10000",
      title: "10,000 Words",
      description: "Type 10,000 saved words.",
      isUnlocked: summary.totalWordsTyped >= 10000
    },
    {
      id: "words-50000",
      title: "50,000 Words",
      description: "Type 50,000 saved words.",
      isUnlocked: summary.totalWordsTyped >= 50000
    },
    {
      id: "words-100000",
      title: "100,000 Words",
      description: "Type 100,000 saved words.",
      isUnlocked: summary.totalWordsTyped >= 100000
    },
    {
      id: "category-25",
      title: "Category Regular",
      description: "Complete 25 passages in one category.",
      isUnlocked: bestCategoryCount >= 25
    },
    {
      id: "category-100",
      title: "Category Specialist",
      description: "Complete 100 passages in one category.",
      isUnlocked: bestCategoryCount >= 100
    },
    {
      id: "improvement-10",
      title: "Plus 10 WPM",
      description: "Improve your recent average WPM by 10.",
      isUnlocked: improvement.averageWpmGain >= 10
    },
    {
      id: "improvement-20",
      title: "Plus 20 WPM",
      description: "Improve your recent average WPM by 20.",
      isUnlocked: improvement.averageWpmGain >= 20
    }
  ];

  return {
    unlockedCount: items.filter((item) => item.isUnlocked).length,
    totalCount: items.length,
    items
  };
}

function getProgression(
  results: SupabaseAnalyticsTypingResultRow[],
  activity: ProgressAnalytics["activity"]
): ProgressAnalytics["progression"] {
  const totalXp =
    results.length * 10 +
    results.filter((result) => result.accuracy === 100).length * 10 +
    getPersonalBestCount(results) * 25 +
    activity.currentStreakDays * 5;
  const currentLevel = Math.floor(totalXp / LEVEL_XP) + 1;
  const currentLevelXp = totalXp % LEVEL_XP;
  const xpToNextLevel = LEVEL_XP - currentLevelXp;

  return {
    totalXp,
    currentLevel,
    currentLevelXp,
    xpForNextLevel: LEVEL_XP,
    xpToNextLevel,
    progressPercent: Math.round((currentLevelXp / LEVEL_XP) * 100)
  };
}

function getPersonalBestCount(results: SupabaseAnalyticsTypingResultRow[]) {
  let bestWpm = Number.NEGATIVE_INFINITY;
  let bestCount = 0;

  for (const result of [...results].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at))) {
    if (result.wpm > bestWpm) {
      bestWpm = result.wpm;
      bestCount += 1;
    }
  }

  return bestCount;
}

function getImprovement(results: SupabaseAnalyticsTypingResultRow[]): ProgressAnalytics["improvement"] {
  if (results.length < 10) {
    return { averageWpmGain: 0 };
  }

  const oldestFirst = [...results].sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
  const earlyAverage = average(oldestFirst.slice(0, 5).map((result) => result.wpm));
  const recentAverage = average(oldestFirst.slice(-5).map((result) => result.wpm));

  return {
    averageWpmGain: roundOne(Math.max(0, recentAverage - earlyAverage))
  };
}

function getChallenges(results: SupabaseAnalyticsTypingResultRow[], now: Date): ProgressAnalytics["challenges"] {
  const todayKey = toDateKey(now);
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const todayResults = results.filter((result) => toDateKey(result.created_at) === todayKey);
  const weekResults = results.filter((result) => isWithinDateRange(new Date(result.created_at), weekStart, weekEnd));
  const dailyMinutes = Math.floor(sumPracticeSeconds(todayResults) / 60);
  const weeklyMinutes = Math.floor(sumPracticeSeconds(weekResults) / 60);
  const dailyBestAccuracy = roundOne(maxOrZero(todayResults.map((result) => result.accuracy)));
  const weeklyBusinessPassages = weekResults.filter((result) => isBusinessCategory(result.passage_category)).length;

  return {
    daily: {
      title: "Daily Challenge",
      items: [
        toChallengeItem("daily-tests", "Complete 3 tests", "Finish 3 saved tests today.", todayResults.length, 3, "tests"),
        toChallengeItem("daily-minutes", "Type for 10 minutes", "Practice for 10 saved minutes today.", dailyMinutes, 10, "minutes"),
        toChallengeItem("daily-accuracy", "Achieve 98% accuracy", "Reach 98% accuracy in a saved result today.", dailyBestAccuracy, 98, "%")
      ]
    },
    weekly: {
      title: "Weekly Challenge",
      items: [
        toChallengeItem("weekly-minutes", "Complete 30 minutes", "Practice for 30 saved minutes this week.", weeklyMinutes, 30, "minutes"),
        toChallengeItem("weekly-tests", "Complete 20 tests", "Finish 20 saved tests this week.", weekResults.length, 20, "tests"),
        toChallengeItem(
          "weekly-business",
          "Complete 10 business passages",
          "Finish 10 saved business passages this week.",
          weeklyBusinessPassages,
          10,
          "passages"
        )
      ]
    }
  };
}

function toChallengeItem(
  id: string,
  title: string,
  description: string,
  progress: number,
  target: number,
  unit: string
): ChallengeItem {
  return {
    id,
    title,
    description,
    progress,
    target,
    unit,
    isComplete: progress >= target
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
  const categories = new Map<string, { label: string; results: SupabaseAnalyticsTypingResultRow[] }>();

  for (const result of results) {
    const category = normalizeCategory(result.passage_category);
    const categoryKey = category.toLowerCase();
    const existingCategory = categories.get(categoryKey);
    categories.set(categoryKey, {
      label: existingCategory?.label ?? category,
      results: [...(existingCategory?.results ?? []), result]
    });
  }

  return Array.from(categories.values())
    .map((category) => ({
      category: category.label,
      averageWpm: roundOne(average(category.results.map((result) => result.wpm))),
      averageAccuracy: roundOne(average(category.results.map((result) => result.accuracy))),
      tests: category.results.length
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

  while (activeDateSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
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

function sumPracticeSeconds(results: SupabaseAnalyticsTypingResultRow[]) {
  return results.reduce((total, result) => total + result.duration_seconds, 0);
}

function isBusinessCategory(category: string | null) {
  return Boolean(category?.toLowerCase().includes("business"));
}

function isWithinDateRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() < end.getTime();
}

function getWeekStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date;
}

function toDateKey(value: string | Date) {
  const date = value instanceof Date ? new Date(value) : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
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
