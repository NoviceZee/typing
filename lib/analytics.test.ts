import { describe, expect, it } from "vitest";
import { buildProgressAnalytics } from "./analytics";
import type { SupabaseAnalyticsTypingResultRow } from "./typingResultStorage";

describe("buildProgressAnalytics", () => {
  it("summarizes results, personal records, and category breakdowns", () => {
    const analytics = buildProgressAnalytics([
      makeResult("one-minute-fast", 60, 72, 98.2, "Business email", "2026-06-19T00:03:00.000Z"),
      makeResult("one-minute-slow", 60, 58, 99.4, "Business email", "2026-06-19T00:02:00.000Z"),
      makeResult("five-minute", 300, 64, 97.5, "Legal / contract style", "2026-06-19T00:01:00.000Z"),
      makeResult("uncategorised", 120, 55, 100, null, "2026-06-19T00:00:00.000Z")
    ]);

    expect(analytics.summary).toEqual({
      bestWpm: 72,
      averageWpm: 62.3,
      averageWpmLast10: 62.3,
      averageWpmLast100: 62.3,
      bestAccuracy: 100,
      totalTests: 4,
      totalPracticeSeconds: 540
    });
    expect(analytics.records.fastestOneMinute?.id).toBe("one-minute-fast");
    expect(analytics.records.fastestFiveMinute?.id).toBe("five-minute");
    expect(analytics.records.highestAccuracy?.id).toBe("uncategorised");
    expect(analytics.categoryBreakdown).toEqual([
      {
        category: "Business email",
        averageWpm: 65,
        averageAccuracy: 98.8,
        tests: 2
      },
      {
        category: "Legal / contract style",
        averageWpm: 64,
        averageAccuracy: 97.5,
        tests: 1
      },
      {
        category: "Uncategorised",
        averageWpm: 55,
        averageAccuracy: 100,
        tests: 1
      }
    ]);
    expect(analytics.weakestCategory?.category).toBe("Uncategorised");
  });

  it("keeps only the most recent 30 results for trend charts in chronological order", () => {
    const newestFirst = Array.from({ length: 35 }, (_, index) =>
      makeResult(`result-${index}`, 60, 50 + index, 95, "Business email", new Date(Date.UTC(2026, 5, 19, 0, 35 - index)).toISOString())
    );

    const analytics = buildProgressAnalytics(newestFirst);

    expect(analytics.recentTrend).toHaveLength(30);
    expect(analytics.recentTrend[0].id).toBe("result-29");
    expect(analytics.recentTrend[29].id).toBe("result-0");
  });

  it("calculates all-time, last-10, and last-100 average WPM", () => {
    const results = Array.from({ length: 120 }, (_, index) =>
      makeResult(
        `result-${index}`,
        60,
        index + 1,
        95,
        "Business email",
        new Date(Date.UTC(2026, 5, 19, 0, index)).toISOString()
      )
    ).reverse();

    const analytics = buildProgressAnalytics(results);

    expect(analytics.summary.averageWpm).toBe(60.5);
    expect(analytics.summary.averageWpmLast10).toBe(115.5);
    expect(analytics.summary.averageWpmLast100).toBe(70.5);
  });

  it("calculates the current activity streak from saved result dates", () => {
    const analytics = buildProgressAnalytics([
      makeResult("latest", 60, 70, 98, "Business email", "2026-06-21T10:00:00.000Z"),
      makeResult("same-day", 60, 68, 98, "Business email", "2026-06-21T08:00:00.000Z"),
      makeResult("yesterday", 60, 65, 98, "Business email", "2026-06-20T10:00:00.000Z"),
      makeResult("gap", 60, 62, 98, "Business email", "2026-06-18T10:00:00.000Z")
    ]);

    expect(analytics.activity.currentStreakDays).toBe(2);
    expect(analytics.activity.activeDays).toBe(3);
  });

  it("calculates achievement unlocks from saved results", () => {
    const results = Array.from({ length: 10 }, (_, index) =>
      makeResult(
        `result-${index}`,
        60,
        index === 0 ? 55 : 42,
        index === 1 ? 99.4 : 96,
        "Business email",
        new Date(Date.UTC(2026, 5, 1 + index * 2)).toISOString()
      )
    );

    const analytics = buildProgressAnalytics(results);
    const achievements = new Map(analytics.achievements.items.map((achievement) => [achievement.id, achievement.isUnlocked]));

    expect(analytics.achievements.totalCount).toBe(12);
    expect(analytics.achievements.unlockedCount).toBe(6);
    expect(achievements.get("first-test")).toBe(true);
    expect(achievements.get("getting-started")).toBe(true);
    expect(achievements.get("dedicated-typist")).toBe(false);
    expect(achievements.get("speed-40")).toBe(true);
    expect(achievements.get("speed-50")).toBe(true);
    expect(achievements.get("speed-60")).toBe(false);
    expect(achievements.get("accuracy-95")).toBe(true);
    expect(achievements.get("accuracy-99")).toBe(true);
    expect(achievements.get("perfect-accuracy")).toBe(false);
  });

  it("unlocks streak achievements from consecutive practice days", () => {
    const threeDayStreak = buildProgressAnalytics([
      makeResult("day-3", 60, 70, 98, "Business email", "2026-06-21T10:00:00.000Z"),
      makeResult("day-2", 60, 70, 98, "Business email", "2026-06-20T10:00:00.000Z"),
      makeResult("day-1", 60, 70, 98, "Business email", "2026-06-19T10:00:00.000Z")
    ]);
    const threeDayAchievements = new Map(
      threeDayStreak.achievements.items.map((achievement) => [achievement.id, achievement.isUnlocked])
    );

    expect(threeDayAchievements.get("three-day-streak")).toBe(true);
    expect(threeDayAchievements.get("seven-day-streak")).toBe(false);

    const sevenDayStreak = buildProgressAnalytics(
      Array.from({ length: 7 }, (_, index) =>
        makeResult(
          `day-${index}`,
          60,
          70,
          98,
          "Business email",
          new Date(Date.UTC(2026, 5, 15 + index)).toISOString()
        )
      )
    );
    const sevenDayAchievements = new Map(
      sevenDayStreak.achievements.items.map((achievement) => [achievement.id, achievement.isUnlocked])
    );

    expect(sevenDayAchievements.get("seven-day-streak")).toBe(true);
  });

  it("keeps every achievement locked when there are no saved results", () => {
    const analytics = buildProgressAnalytics([]);

    expect(analytics.achievements.totalCount).toBe(12);
    expect(analytics.achievements.unlockedCount).toBe(0);
    expect(analytics.achievements.items.every((achievement) => !achievement.isUnlocked)).toBe(true);
  });
});

function makeResult(
  id: string,
  durationSeconds: number,
  wpm: number,
  accuracy: number,
  category: string | null,
  createdAt: string
): SupabaseAnalyticsTypingResultRow {
  return {
    id,
    passage_title: `Passage ${id}`,
    passage_category: category,
    duration_seconds: durationSeconds,
    wpm,
    accuracy,
    created_at: createdAt
  };
}
