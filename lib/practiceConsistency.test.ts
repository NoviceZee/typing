import { describe, expect, it } from "vitest";
import {
  buildAttemptConsistencySummary,
  buildConsistencySeries,
  calculateTimelineConsistency,
  getConsistencyScorePath,
  getConsistencySummary,
  getSparklinePath
} from "./practiceConsistency";

describe("practiceConsistency", () => {
  it("keeps the last 10 attempts in chronological order and includes the current result", () => {
    const savedResults = Array.from({ length: 12 }, (_, index) => ({
      id: `saved-${index}`,
      wpm: 30 + index,
      created_at: `2026-06-19T00:${String(index).padStart(2, "0")}:00.000Z`
    })).reverse();

    const series = buildConsistencySeries(savedResults, {
      wpm: 48,
      completedAt: "2026-06-19T00:12:30.000Z"
    });

    expect(series.map((point) => point.wpm)).toEqual([33, 34, 35, 36, 37, 38, 39, 40, 41, 48]);
  });

  it("deduplicates a saved result that appears to be the just-finished result", () => {
    const series = buildConsistencySeries(
      [
        { id: "current-from-db", wpm: 50, created_at: "2026-06-19T00:00:04.000Z" },
        { id: "older", wpm: 42, created_at: "2026-06-18T00:00:00.000Z" }
      ],
      { wpm: 50, completedAt: "2026-06-19T00:00:00.000Z" }
    );

    expect(series.map((point) => point.wpm)).toEqual([42, 50]);
  });

  it("calculates current, recent average, and personal best WPM", () => {
    expect(getConsistencySummary([{ wpm: 42 }, { wpm: 45 }, { wpm: 48 }])).toEqual({
      currentWpm: 48,
      averageWpm: 45,
      bestWpm: 48
    });
  });

  it("creates a compact sparkline path", () => {
    expect(getSparklinePath([{ wpm: 40 }, { wpm: 50 }, { wpm: 45 }], 100, 40)).toBe("M 0 36 L 50 4 L 100 20");
  });

  it("calculates attempt stability from WPM variation", () => {
    expect(calculateTimelineConsistency([
      { timeSeconds: 10, wpm: 60 },
      { timeSeconds: 20, wpm: 60 },
      { timeSeconds: 30, wpm: 60 }
    ])).toBe(100);

    expect(calculateTimelineConsistency([
      { timeSeconds: 10, wpm: 40 },
      { timeSeconds: 20, wpm: 60 },
      { timeSeconds: 30, wpm: 80 }
    ])).toBeLessThan(100);
  });

  it("builds a domain-scoped consistency summary and trend", () => {
    const summary = buildAttemptConsistencySummary([
      makeAttempt("english-1", "Business email", [50, 60, 55], "2026-07-09T00:00:00Z"),
      makeAttempt("chinese", "training_chinese", [20, 20, 20], "2026-07-10T00:00:00Z"),
      makeAttempt("english-2", "News article", [60, 60, 60], "2026-07-11T00:00:00Z")
    ], (category) => category !== "training_chinese");

    expect(summary.points.map((point) => point.id)).toEqual(["english-1", "english-2"]);
    expect(summary.latest).toBe(100);
    expect(summary.average).not.toBeNull();
    expect(summary.recentChange).toBeGreaterThan(0);
    expect(getConsistencyScorePath(summary.points, 100, 40)).toMatch(/^M /);
  });
});

function makeAttempt(id: string, category: string, wpms: number[], completedAt: string) {
  return {
    id,
    category,
    completedAt,
    timeline: wpms.map((wpm, index) => ({ timeSeconds: (index + 1) * 10, wpm }))
  };
}
