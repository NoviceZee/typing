import { describe, expect, it } from "vitest";
import { buildSymbolsTrainingPassage, buildSymbolsTrainingText } from "./symbolsTraining";

describe("symbolsTraining", () => {
  it("generates long mixed symbol drills from realistic groups", () => {
    const drillText = buildSymbolsTrainingText(60);
    const tokens = drillText.split(/\s+/).filter(Boolean);

    expect(tokens.length).toBeGreaterThanOrEqual(300);
    expect(tokens.length).toBeLessThanOrEqual(600);
    expect(drillText).toMatch(/\(\)|\[\]|\{\}|<>/);
    expect(drillText).toMatch(/""|''|``/);
    expect(drillText).toMatch(/[.,;:]/);
    expect(drillText).toMatch(/\+=|-=|\*=|\/=|==|!=|>=|<=|[+\-*/=]/);
    expect(drillText).toMatch(/[!@#$%^&*]/);
  });

  it("does not always generate identical symbols passages", () => {
    const passages = Array.from({ length: 6 }, () => buildSymbolsTrainingPassage(60).text);

    expect(new Set(passages).size).toBeGreaterThan(1);
  });
});
