import { describe, expect, it } from "vitest";
import {
  buildConsistencySeries,
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
});
