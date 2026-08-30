import { describe, expect, it } from "vitest";
import { parsePracticeRoutePreset, parseTrainingRoutePreset } from "@/lib/routePresets";

describe("route presets", () => {
  it("accepts exact single Practice language and mode values", () => {
    expect(parsePracticeRoutePreset({ language: "chinese", mode: "infinite" })).toEqual({
      language: "chinese",
      mode: "infinite"
    });
    expect(parsePracticeRoutePreset({ language: "english", mode: "5m" })).toEqual({
      language: "english",
      mode: "5m"
    });
  });

  it("rejects invalid and repeated Practice values independently", () => {
    expect(parsePracticeRoutePreset({ language: "Chinese", mode: "60" })).toEqual({
      language: null,
      mode: "1m"
    });
    expect(parsePracticeRoutePreset({ language: ["chinese", "english"], mode: ["1m"] })).toEqual({
      language: null,
      mode: "1m"
    });
  });

  it("uses the existing Practice default when mode is missing", () => {
    expect(parsePracticeRoutePreset({ language: "chinese" })).toEqual({
      language: "chinese",
      mode: "1m"
    });
  });

  it("accepts only the exact single Chinese Training preset", () => {
    expect(parseTrainingRoutePreset({ content: "chinese" })).toBe("chinese");
    expect(parseTrainingRoutePreset({})).toBeNull();
    expect(parseTrainingRoutePreset({ content: "words" })).toBeNull();
    expect(parseTrainingRoutePreset({ content: ["chinese"] })).toBeNull();
  });
});
