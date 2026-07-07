import { describe, expect, it } from "vitest";
import { buildTrainingPassage, buildTrainingText, getChineseTrainingPool, getTrainingCategory } from "./trainingText";

describe("trainingText", () => {
  it("builds safe category metadata for selected content types", () => {
    expect(getTrainingCategory(["words"])).toBe("training_words");
    expect(getTrainingCategory(["numbers"])).toBe("training_numbers");
    expect(getTrainingCategory(["symbols"])).toBe("training_symbols");
    expect(getTrainingCategory(["words", "numbers"])).toBe("training_words_numbers");
    expect(getTrainingCategory(["words", "symbols"])).toBe("training_words_symbols");
    expect(getTrainingCategory(["numbers", "symbols"])).toBe("training_numbers_symbols");
    expect(getTrainingCategory(["words", "numbers", "symbols"])).toBe("training_words_numbers_symbols");
    expect(getTrainingCategory(["code"])).toBe("training_code");
    expect(getTrainingCategory(["chinese"])).toBe("training_chinese");
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

  it("generates realistic code drills with punctuation, indentation, and line breaks", () => {
    const passage = buildTrainingPassage({
      contentTypes: ["code"],
      mode: "time",
      durationSeconds: 60,
      wordDifficulty: "intermediate"
    });

    expect(passage.category).toBe("training_code");
    expect(passage.text).toMatch(/\b(const|let|function|if|for|return)\b/);
    expect(passage.text).toMatch(/[{}()[\];=]/);
    expect(passage.text).toMatch(/\n/);
  });

  it("maps code difficulty to different snippet complexity", () => {
    const basic = buildTrainingText({ contentTypes: ["code"], tokenCount: 8, wordDifficulty: "basic" });
    const advanced = buildTrainingText({ contentTypes: ["code"], tokenCount: 8, wordDifficulty: "advanced" });

    expect(basic).toMatch(/\b(const|let|return|console)\b/);
    expect(advanced).toMatch(/\b(async|try|catch|reduce|map|throw|for)\b/);
    expect(advanced.length).toBeGreaterThan(basic.length);
  });

  it("generates Chinese word-count passages as exact unsplit term counts without required spaces", () => {
    const passage = buildTrainingPassage({
      contentTypes: ["chinese"],
      mode: "words",
      wordCount: 10,
      wordDifficulty: "basic"
    });

    expect(passage.category).toBe("training_chinese");
    expect(passage.style).toBe("10 words");
    expect(passage.comparableText).toBe(passage.text);
    expect(passage.text).toMatch(/^[\u4e00-\u9fff]+$/);
    expect(passage.displayTokens).toHaveLength(10);
    expect(passage.displayTokens?.join("")).toBe(passage.text);
    expect(passage.displayTokens?.every((token) => /^[\u4e00-\u9fff]+$/.test(token))).toBe(true);
    expect(passage.displayTokens?.some((token) => token.length >= 2)).toBe(true);
  });

  it("counts advanced Chinese phrases and idioms as single generated terms", () => {
    const advancedPool = getChineseTrainingPool("advanced");
    const passage = buildTrainingPassage({
      contentTypes: ["chinese"],
      mode: "words",
      wordCount: 100,
      wordDifficulty: "advanced"
    });
    const tokens = passage.displayTokens ?? [];

    expect(tokens).toHaveLength(100);
    expect(tokens.every((token) => advancedPool.includes(token))).toBe(true);
    expect(tokens.every((token) => token.length >= 4)).toBe(true);
    expect(advancedPool).toEqual(expect.arrayContaining(["循序漸進", "精益求精", "行政管理", "資源分配"]));
    expect(tokens.join("")).toBe(passage.text);
  });

  it("generates Traditional Chinese pools by difficulty", () => {
    const basic = getChineseTrainingPool("basic");
    const intermediate = getChineseTrainingPool("intermediate");
    const advanced = getChineseTrainingPool("advanced");
    const mixed = getChineseTrainingPool("mixed");

    expect(basic).toEqual(expect.arrayContaining(["今天", "明天", "工作", "時間", "朋友", "香港"]));
    expect(intermediate).toEqual(expect.arrayContaining(["安排", "確認", "處理", "會議", "文件", "項目"]));
    expect(advanced).toEqual(expect.arrayContaining(["循序漸進", "精益求精", "一絲不苟", "全力以赴", "隨機應變", "事半功倍"]));
    expect(mixed).toEqual(expect.arrayContaining(["今天", "工作", "朋友", "公司"]));
    expect(mixed).toEqual(expect.arrayContaining(["安排", "確認", "處理", "會議"]));
    expect(mixed).toEqual(expect.arrayContaining(["行政管理", "循序漸進", "溝通協調", "策略規劃"]));
  });

  it("uses large semantically distinct Chinese difficulty pools", () => {
    const basicPool = getChineseTrainingPool("basic");
    const intermediatePool = getChineseTrainingPool("intermediate");
    const advancedPool = getChineseTrainingPool("advanced");

    expect(basicPool.length).toBeGreaterThanOrEqual(150);
    expect(intermediatePool.length).toBeGreaterThanOrEqual(150);
    expect(advancedPool.length).toBeGreaterThanOrEqual(120);
    expect(basicPool).toEqual(expect.arrayContaining(["我", "你", "家", "水", "飯", "今天", "回家"]));
    expect(intermediatePool).toEqual(expect.arrayContaining(["確認", "安排", "流程", "客戶", "預算"]));
    expect(advancedPool).toEqual(expect.arrayContaining(["資源整合", "統籌安排", "按部就班", "未雨綢繆"]));
    expect(basicPool.filter((term) => term.length <= 2).length).toBeGreaterThan(120);
    expect(advancedPool.filter((term) => term.length >= 4).length).toBeGreaterThan(80);
  });

  it("does not repeat Chinese terms before the selected pool is exhausted", () => {
    const poolSize = getChineseTrainingPool("basic").length;
    const passage = buildTrainingPassage({
      contentTypes: ["chinese"],
      mode: "words",
      wordCount: 100,
      wordDifficulty: "basic"
    });
    const tokens = passage.displayTokens ?? [];

    expect(poolSize).toBeGreaterThanOrEqual(tokens.length);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it("avoids immediate duplicate Chinese terms", () => {
    const passage = buildTrainingPassage({
      contentTypes: ["chinese"],
      mode: "time",
      durationSeconds: 60,
      wordDifficulty: "mixed"
    });
    const tokens = passage.displayTokens ?? [];

    expect(tokens.length).toBeGreaterThan(50);
    for (let index = 1; index < tokens.length; index += 1) {
      expect(tokens[index]).not.toBe(tokens[index - 1]);
    }
  });
});
