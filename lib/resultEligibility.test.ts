import { describe, expect, it } from "vitest";
import { isProgressionEligibleResult } from "./resultEligibility";

describe("isProgressionEligibleResult", () => {
  it("accepts accurate completed English and Chinese scoring results", () => {
    expect(
      isProgressionEligibleResult({
        accuracy: 98,
        wpm: 56,
        timeUsedSeconds: 60,
        completionReason: "time_up",
        isRankable: true
      })
    ).toBe(true);
    expect(
      isProgressionEligibleResult({
        accuracy: 100,
        wpm: 35,
        elapsed_seconds: 60,
        completion_reason: "time_up",
        is_rankable: true
      })
    ).toBe(true);
    expect(
      isProgressionEligibleResult({
        accuracy: 100,
        wpm: 42,
        elapsed_seconds: 60,
        completion_reason: "text_completed",
        is_rankable: true
      })
    ).toBe(true);
  });

  it("rejects low-accuracy, server-ineligible, too-short, and manual attempts", () => {
    expect(
      isProgressionEligibleResult({ accuracy: 5, wpm: 200, elapsed_seconds: 60, completion_reason: "time_up" })
    ).toBe(false);
    expect(
      isProgressionEligibleResult({
        accuracy: 100,
        wpm: 200,
        elapsed_seconds: 60,
        completion_reason: "time_up",
        is_rankable: false
      })
    ).toBe(false);
    expect(
      isProgressionEligibleResult({ accuracy: 100, wpm: 80, elapsed_seconds: 10, completion_reason: "text_completed" })
    ).toBe(false);
    expect(
      isProgressionEligibleResult({
        accuracy: 100,
        wpm: 80,
        elapsed_seconds: 60,
        completion_reason: "manual",
        is_rankable: true
      })
    ).toBe(false);
  });
});
