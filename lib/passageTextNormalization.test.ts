import { describe, expect, it } from "vitest";
import { normalizeEnglishPassagePunctuation } from "./passageTextNormalization";

describe("passage text normalization", () => {
  it("normalizes English smart punctuation without changing Chinese punctuation", () => {
    expect(normalizeEnglishPassagePunctuation("A person’s “notes”—today… 中文，句號。")).toEqual({
      text: 'A person\'s "notes"-today... 中文，句號。',
      replacements: 5
    });
  });

  it("reports unchanged content without creating a false update", () => {
    expect(normalizeEnglishPassagePunctuation("Plain ASCII passage.")).toEqual({
      text: "Plain ASCII passage.",
      replacements: 0
    });
  });

  it("normalizes full-width punctuation copied into an English passage", () => {
    expect(normalizeEnglishPassagePunctuation("Hello， world！ Use ［quotes］： yes。")).toEqual({
      text: 'Hello, world! Use [quotes]: yes.',
      replacements: 6
    });
  });

  it("does not alter punctuation in a passage containing Han characters", () => {
    expect(normalizeEnglishPassagePunctuation("中文，句號。")).toEqual({
      text: "中文，句號。",
      replacements: 0
    });
  });
});
