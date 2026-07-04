import { describe, expect, it } from "vitest";
import { buildTrainingPassage, buildTrainingText, getTrainingCategory } from "./trainingText";

describe("trainingText", () => {
  it("builds safe category metadata for selected content types", () => {
    expect(getTrainingCategory(["words"])).toBe("training_words");
    expect(getTrainingCategory(["numbers"])).toBe("training_numbers");
    expect(getTrainingCategory(["symbols"])).toBe("training_symbols");
    expect(getTrainingCategory(["words", "numbers"])).toBe("training_words_numbers");
    expect(getTrainingCategory(["words", "symbols"])).toBe("training_words_symbols");
    expect(getTrainingCategory(["numbers", "symbols"])).toBe("training_numbers_symbols");
    expect(getTrainingCategory(["words", "numbers", "symbols"])).toBe("training_words_numbers_symbols");
  });

  it("interleaves selected content types into mixed drills", () => {
    const text = buildTrainingText({ contentTypes: ["words", "numbers", "symbols"], tokenCount: 90 });

    expect(text).toMatch(/[a-z]{3,}/);
    expect(text).toMatch(/\$?\d[\d,.]*%?/);
    expect(text).toMatch(/\+=|-=|\*=|\/=|==|!=|>=|<=|[()[\]{}<>!@#$%^&*;:]/);
  });

  it("builds word-count passages with the requested number of tokens", () => {
    const passage = buildTrainingPassage({
      contentTypes: ["words", "symbols"],
      mode: "words",
      wordCount: 25
    });

    expect(passage.text.split(/\s+/).filter(Boolean)).toHaveLength(25);
    expect(passage.category).toBe("training_words_symbols");
  });

  it("generates basic word drills from common short words", () => {
    const text = buildTrainingText({ contentTypes: ["words"], tokenCount: 60, wordDifficulty: "basic" });
    const tokens = text.split(/\s+/).filter(Boolean);

    expect(tokens.every((token) => /^[a-z]+$/.test(token))).toBe(true);
    expect(tokens.every((token) => token.length <= 5)).toBe(true);
  });

  it("generates advanced word drills from longer professional words", () => {
    const text = buildTrainingText({ contentTypes: ["words"], tokenCount: 60, wordDifficulty: "advanced" });
    const tokens = text.split(/\s+/).filter(Boolean);

    expect(tokens.every((token) => /^[a-z]+$/.test(token))).toBe(true);
    expect(tokens.every((token) => token.length >= 7)).toBe(true);
  });

  it("avoids repeating words before the selected pool is exhausted", () => {
    const text = buildTrainingText({ contentTypes: ["words"], tokenCount: 100, wordDifficulty: "intermediate" });
    const tokens = text.split(/\s+/).filter(Boolean);

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("samples mixed difficulty words from multiple difficulty bands", () => {
    const text = buildTrainingText({ contentTypes: ["words"], tokenCount: 100, wordDifficulty: "mixed" });
    const tokens = text.split(/\s+/).filter(Boolean);

    expect(tokens.some((token) => token.length <= 5)).toBe(true);
    expect(tokens.some((token) => token.length >= 7)).toBe(true);
  });
});
