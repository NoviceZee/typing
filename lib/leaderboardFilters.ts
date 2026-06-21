export type LeaderboardTimeRange = "today" | "yesterday" | "this_week" | "this_month" | "this_year" | "all_time";

export const LEADERBOARD_TIME_RANGE_OPTIONS: Array<{ label: string; value: LeaderboardTimeRange }> = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "This week", value: "this_week" },
  { label: "This month", value: "this_month" },
  { label: "This year", value: "this_year" },
  { label: "All time", value: "all_time" }
];

export const DEFAULT_LEADERBOARD_TIME_RANGE: LeaderboardTimeRange = "this_week";

export function getLeaderboardDateRange(range: LeaderboardTimeRange, now = new Date()) {
  if (range === "all_time") {
    return null;
  }

  const today = startOfLocalDay(now);

  if (range === "today") {
    return { start: today, end: addDays(today, 1) };
  }

  if (range === "yesterday") {
    const start = addDays(today, -1);
    return { start, end: today };
  }

  if (range === "this_week") {
    const day = today.getDay();
    const daysSinceMonday = day === 0 ? 6 : day - 1;
    const start = addDays(today, -daysSinceMonday);
    return { start, end: addDays(start, 7) };
  }

  if (range === "this_month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start, end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
  }

  const start = new Date(today.getFullYear(), 0, 1);
  return { start, end: new Date(today.getFullYear() + 1, 0, 1) };
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
