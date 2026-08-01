import { describe, expect, it } from "vitest";
import { hasValidResultDuration, resolveResultDuration } from "./resultDuration";

describe("result duration contracts", () => {
  it("keeps a timed early completion in its configured mode bucket", () => {
    expect(resolveResultDuration({
      modeDurationSeconds: 60,
      elapsedSeconds: 23
    })).toEqual({
      modeDurationSeconds: 60,
      elapsedSeconds: 23
    });
  });

  it("keeps untimed attempts out of a configured mode bucket", () => {
    expect(resolveResultDuration({
      modeDurationSeconds: null,
      elapsedSeconds: 42
    })).toEqual({
      modeDurationSeconds: null,
      elapsedSeconds: 42
    });
  });

  it("reads existing rows that only contain the legacy duration field", () => {
    expect(resolveResultDuration({ duration_seconds: 60 })).toEqual({
      modeDurationSeconds: 60,
      elapsedSeconds: 60
    });
  });

  it("prefers separately stored elapsed time for existing rows", () => {
    expect(resolveResultDuration({
      duration_seconds: 60,
      elapsed_seconds: 23
    })).toEqual({
      modeDurationSeconds: 60,
      elapsedSeconds: 23
    });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects corrupt elapsed duration %s before compatibility normalization",
    (elapsedSeconds) => {
      expect(hasValidResultDuration({ mode_duration_seconds: 60, elapsed_seconds: elapsedSeconds })).toBe(false);
    }
  );

  it("accepts an explicit null mode for an untimed attempt", () => {
    expect(hasValidResultDuration({ mode_duration_seconds: null, elapsed_seconds: 23 })).toBe(true);
  });
});
