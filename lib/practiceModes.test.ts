import { describe, expect, it } from "vitest";
import {
  PRACTICE_MODE_OPTIONS,
  getComparableDurationSeconds,
  getPracticeMode,
  isManualFinishShortcut,
  isTimedPracticeMode,
} from "./practiceModes";

describe("practice modes", () => {
  it("offers timed and infinite modes with compact labels", () => {
    expect(PRACTICE_MODE_OPTIONS).toEqual([
      { id: "1m", label: "1m", kind: "timed", seconds: 60 },
      { id: "5m", label: "5m", kind: "timed", seconds: 300 },
      { id: "10m", label: "10m", kind: "timed", seconds: 600 },
      { id: "infinite", label: "Infinite", kind: "infinite" }
    ]);
  });

  it("identifies timed modes and their leaderboard-compatible durations", () => {
    const fiveMinutes = getPracticeMode("5m");

    expect(isTimedPracticeMode(fiveMinutes)).toBe(true);
    expect(getComparableDurationSeconds(fiveMinutes, 47)).toBe(300);
  });

  it("uses elapsed time for non-timed result duration", () => {
    expect(getComparableDurationSeconds(getPracticeMode("infinite"), 82)).toBe(82);
  });

  it("uses Escape as the manual finish shortcut in every mode", () => {
    expect(isManualFinishShortcut("Escape")).toBe(true);
    expect(isManualFinishShortcut("Enter")).toBe(false);
  });
});
