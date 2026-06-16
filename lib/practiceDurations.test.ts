import { describe, expect, it } from "vitest";
import { PRACTICE_DURATIONS, getDurationFilterOptions } from "./practiceDurations";

describe("practice durations", () => {
  it("offers one, five, and ten minute practice sessions", () => {
    expect(PRACTICE_DURATIONS).toEqual([
      { label: "1 min", seconds: 60 },
      { label: "5 min", seconds: 300 },
      { label: "10 min", seconds: 600 }
    ]);
  });

  it("includes ten minutes in leaderboard duration filters", () => {
    expect(getDurationFilterOptions("All")).toEqual([
      { label: "All", value: "All" },
      { label: "1 min", value: "60" },
      { label: "5 min", value: "300" },
      { label: "10 min", value: "600" }
    ]);
  });
});
