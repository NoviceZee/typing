import { describe, expect, it } from "vitest";
import { buildNumbersTrainingPassage, buildNumbersTrainingText } from "./numbersTraining";

describe("numbersTraining", () => {
  it("generates long mixed numeric drills", () => {
    const drillText = buildNumbersTrainingText(60);
    const tokens = drillText.split(/\s+/).filter(Boolean);

    expect(tokens.length).toBeGreaterThanOrEqual(300);
    expect(tokens.length).toBeLessThanOrEqual(600);
    expect(drillText).toMatch(/\b\d{4,}\b/);
    expect(drillText).toMatch(/\b\d+\.\d{2}\b/);
    expect(drillText).toMatch(/\b\d{1,3},\d{3}\.\d{2}\b/);
    expect(drillText).toMatch(/\$\d{1,3},\d{3}\.\d{2}\b/);
    expect(drillText).toMatch(/\b\d+\.\d{2}%/);
  });

  it("does not always generate identical numbers passages", () => {
    const passages = Array.from({ length: 6 }, () => buildNumbersTrainingPassage(60).text);

    expect(new Set(passages).size).toBeGreaterThan(1);
  });
});
