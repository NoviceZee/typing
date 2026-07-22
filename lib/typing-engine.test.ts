import { describe, expect, it } from "vitest";
import {
  DEFAULT_RULES,
  buildPracticePassage,
  calculateResult,
  enforceBackspacePolicy,
  getRequiredWordCount,
  isTypedTextComplete,
  normalizeTargetForRules,
  shouldFinishCompletedText,
  validateTypedText
} from "./typing-engine";

describe("typing rule comparison", () => {
  it("exposes validateTypedText with characterStatuses for rendering", () => {
    const validation = validateTypedText({
      targetText: "Hello.  World",
      typedText: "hello. World",
      rules: {
        ...DEFAULT_RULES,
        caseSensitive: true,
        requireTwoSpacesAfterPeriod: true
      }
    });

    expect(validation.characterStatuses[0]).toMatchObject({ expected: "H", actual: "h", status: "wrong" });
    expect(validation.missedCharacters).toBe(1);
    expect(validation.incorrectCharacters).toBe(2);
  });

  it("treats case as an error when case-sensitive mode is enabled", () => {
    const comparison = validateTypedText({
      targetText: "Dear Sir",
      typedText: "dear Sir",
      rules: {
        ...DEFAULT_RULES,
        caseSensitive: true
      }
    });

    expect(comparison.incorrectCharacters).toBe(1);
    expect(comparison.correctCharacters).toBe(7);
    expect(comparison.characterStatuses[0]).toMatchObject({ expected: "D", actual: "d", status: "wrong" });
  });

  it("does not report visually identical IME text as wrong because of Unicode variants", () => {
    const comparison = validateTypedText({
      targetText: "願以十五城請易璧。",
      typedText: "願以十五城請易璧\uFE0F。",
      rules: DEFAULT_RULES
    });

    expect(comparison.incorrectCharacters).toBe(0);
    expect(comparison.correctCharacters).toBe(9);
  });

  it("preserves authored full-width Chinese punctuation during comparison", () => {
    const comparison = validateTypedText({
      targetText: "今天，天氣很好！",
      typedText: "今天，天氣很好！",
      rules: DEFAULT_RULES
    });

    expect(comparison.incorrectCharacters).toBe(0);
    expect(comparison.characters.map((character) => character.expected).join("")).toBe("今天，天氣很好！");
  });

  it("treats keyboard and typographic English punctuation as equivalent", () => {
    const comparison = validateTypedText({
      targetText: "A person’s notes—marked “private”",
      typedText: "A person's notes-marked \"private\"",
      rules: DEFAULT_RULES
    });

    expect(comparison.incorrectCharacters).toBe(0);
    expect(comparison.correctCharacters).toBe(comparison.characters.length);
  });

  it("does not treat ASCII punctuation as Chinese full-width punctuation", () => {
    const comparison = validateTypedText({
      targetText: "中文，句號。",
      typedText: "中文,句號。",
      rules: DEFAULT_RULES
    });

    expect(comparison.incorrectCharacters).toBeGreaterThan(0);
  });

  it("ignores case differences when case-sensitive mode is disabled", () => {
    const comparison = validateTypedText({
      targetText: "Dear Sir",
      typedText: "dear sir",
      rules: {
        ...DEFAULT_RULES,
        caseSensitive: false
      }
    });

    expect(comparison.incorrectCharacters).toBe(0);
    expect(comparison.correctCharacters).toBe(8);
  });

  it("ignores punctuation differences when punctuation-sensitive mode is disabled", () => {
    const comparison = validateTypedText({
      targetText: "Please review, sign, and return.",
      typedText: "Please review sign and return",
      rules: {
        ...DEFAULT_RULES,
        punctuationSensitive: false
      }
    });

    expect(comparison.incorrectCharacters).toBe(0);
    expect(comparison.correctCharacters).toBe(29);
  });

  it("requires two spaces after periods when the rule is enabled", () => {
    const target = normalizeTargetForRules("The tender closes. Submit before noon.", {
      ...DEFAULT_RULES,
      requireTwoSpacesAfterPeriod: true
    });

    const comparison = validateTypedText({
      targetText: target,
      typedText: "The tender closes. Submit before noon.",
      rules: {
        ...DEFAULT_RULES,
        requireTwoSpacesAfterPeriod: true,
        enforceMissingSpaces: true
      }
    });

    expect(target).toBe("The tender closes.  Submit before noon.");
    expect(comparison.incorrectCharacters).toBe(1);
    expect(comparison.missedCharacters).toBe(1);
  });

  it("keeps code training WPM normalized by characters per five", () => {
    const result = calculateResult({
      target: "const total = price * quantity;",
      typed: "const total = price * quantity;",
      elapsedSeconds: 60,
      durationSeconds: 60,
      category: "training_code",
      rules: DEFAULT_RULES,
      completionReason: "time_up"
    });

    expect(result.wpm).toBeCloseTo(result.correctCharacters / 5, 5);
    expect(result.category).toBe("training_code");
  });

  it("calculates Chinese training pace as characters per minute", () => {
    const result = calculateResult({
      target: "今天工作時間朋友香港",
      typed: "今天工作時間朋友香港",
      elapsedSeconds: 60,
      durationSeconds: 60,
      category: "training_chinese",
      rules: DEFAULT_RULES,
      completionReason: "time_up"
    });

    expect(result.wpm).toBe(result.correctCharacters);
    expect(result.rawWpm).toBe(result.correctCharacters);
    expect(result.category).toBe("training_chinese");
  });

  it("calculates Chinese WPM as one correct Chinese character per WPM unit", () => {
    const result = calculateResult({
      target: "今天工作時間朋友香港",
      typed: "今天工作時間",
      elapsedSeconds: 30,
      durationSeconds: 60,
      category: "training_chinese",
      rules: DEFAULT_RULES,
      completionReason: "manual"
    });

    expect(result.correctCharacters).toBe(6);
    expect(result.wpm).toBe(12);
    expect(result.rawWpm).toBe(12);
  });

  it("does not count extra spaces when that rule is disabled", () => {
    const comparison = validateTypedText({
      targetText: "Kind regards",
      typedText: "Kind  regards",
      rules: {
        ...DEFAULT_RULES,
        enforceExtraSpaces: false
      }
    });

    expect(comparison.extraCharacters).toBe(0);
    expect(comparison.incorrectCharacters).toBe(0);
  });

  it("keeps a bounded active target index after an extra space", () => {
    const comparison = validateTypedText({
      targetText: "alpha beta",
      typedText: "alpha  ",
      rules: DEFAULT_RULES
    });

    expect(comparison.activeTargetIndex).toBe(6);
    expect(comparison.characters.find((character) => character.status === "current")).toMatchObject({
      expected: "b",
      index: 6
    });
  });

  it("keeps a local active target index after a wrong key", () => {
    const comparison = validateTypedText({
      targetText: "alpha beta",
      typedText: "alpha x",
      rules: DEFAULT_RULES
    });

    expect(comparison.activeTargetIndex).toBe(7);
    expect(comparison.activeTargetIndex).toBeLessThan(comparison.comparableTargetLength - 1);
  });

  it("tracks target progress rather than raw input length after an omitted character", () => {
    const comparison = validateTypedText({
      targetText: "alpha beta",
      typedText: "alpha et",
      rules: DEFAULT_RULES
    });

    expect(comparison.activeTargetIndex).toBe(9);
    expect(comparison.characters.find((character) => character.status === "current")).toMatchObject({
      expected: "a",
      index: 9
    });
  });

  it("counts missing spaces only when that rule is enabled", () => {
    const enforced = validateTypedText({
      targetText: "Kind regards",
      typedText: "Kindregards",
      rules: { ...DEFAULT_RULES, enforceMissingSpaces: true }
    });
    const tolerated = validateTypedText({
      targetText: "Kind regards",
      typedText: "Kindregards",
      rules: { ...DEFAULT_RULES, enforceMissingSpaces: false }
    });

    expect(enforced.missedCharacters).toBe(1);
    expect(enforced.incorrectCharacters).toBe(1);
    expect(tolerated.missedCharacters).toBe(0);
    expect(tolerated.incorrectCharacters).toBe(0);
  });

  it("counts missed paragraph breaks without consuming the next paragraph text", () => {
    const comparison = validateTypedText({
      targetText: "First paragraph.\n\nSecond paragraph.",
      typedText: "First paragraph.Second paragraph.",
      rules: DEFAULT_RULES
    });

    const missedBreaks = comparison.characterStatuses.filter(
      (character) => character.expected === "\n" && character.status === "wrong"
    );
    const secondParagraphStart = comparison.characterStatuses.find(
      (character) => character.expected === "S" && character.actual === "S"
    );

    expect(missedBreaks).toHaveLength(2);
    expect(comparison.missedCharacters).toBe(2);
    expect(comparison.incorrectCharacters).toBe(2);
    expect(secondParagraphStart).toMatchObject({ status: "correct" });
  });

  it("prevents backspace changes when backspace is disabled", () => {
    expect(enforceBackspacePolicy("abc", "ab", false)).toBe("abc");
    expect(enforceBackspacePolicy("abc", "abcd", false)).toBe("abcd");
  });

  it("uses normalised comparable length for text completion", () => {
    expect(isTypedTextComplete("Hello. World", "Hello. World", { ...DEFAULT_RULES })).toBe(true);
    expect(
      isTypedTextComplete("Hello. World", "Hello. World", {
        ...DEFAULT_RULES,
        requireTwoSpacesAfterPeriod: true
      })
    ).toBe(false);
    expect(
      isTypedTextComplete("Hello, World.", "Hello World", {
        ...DEFAULT_RULES,
        punctuationSensitive: false
      })
    ).toBe(true);
  });

  it("finishes completed Practice and word drills at the input boundary, but not timed Training", () => {
    expect(shouldFinishCompletedText(undefined, "客戶測試", "客戶測試", DEFAULT_RULES)).toBe(true);
    expect(shouldFinishCompletedText("words", "Complete this", "Complete this", DEFAULT_RULES)).toBe(true);
    expect(shouldFinishCompletedText("time", "12345", "12345", DEFAULT_RULES)).toBe(false);
    expect(shouldFinishCompletedText(undefined, "客戶測試", "客戶測", DEFAULT_RULES)).toBe(false);
  });
});

describe("result calculation", () => {
  it("calculates gross WPM, raw WPM, accuracy, and character counts", () => {
    const result = calculateResult({
      target: "Formal filing notice.",
      typed: "Formal filling notice.",
      elapsedSeconds: 60,
      durationSeconds: 60,
      category: "Government / formal English",
      rules: DEFAULT_RULES,
      completionReason: "text_completed"
    });

    expect(result.wpm).toBe(4.2);
    expect(result.rawWpm).toBe(4.4);
    expect(result.accuracy).toBe(95.45);
    expect(result.totalCharacters).toBe(21);
    expect(result.correctCharacters).toBe(21);
    expect(result.incorrectCharacters).toBe(1);
    expect(result.timeUsedSeconds).toBe(60);
    expect(result.completionReason).toBe("text_completed");
    expect(result.isRankable).toBe(true);
  });

  it("marks very low accuracy attempts as not rankable", () => {
    const result = calculateResult({
      target: "A formal response is required.",
      typed: "xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      elapsedSeconds: 60,
      durationSeconds: 60,
      category: "Legal / contract style",
      rules: DEFAULT_RULES,
      completionReason: "time_up"
    });

    expect(result.accuracy).toBeLessThan(70);
    expect(result.isRankable).toBe(false);
  });

  it("uses actual elapsed time when text is completed before the timer ends", () => {
    const result = calculateResult({
      target: "Hello world",
      typed: "Hello world",
      elapsedSeconds: 12,
      durationSeconds: 60,
      category: "Business email",
      rules: DEFAULT_RULES,
      completionReason: "text_completed"
    });

    expect(result.timeUsedSeconds).toBe(12);
    expect(result.completionReason).toBe("text_completed");
    expect(result.wpm).toBe(11);
  });
});

describe("passage length generation", () => {
  it("returns expected word count targets for timed tests", () => {
    expect(getRequiredWordCount(60)).toBe(300);
    expect(getRequiredWordCount(300)).toBe(1100);
    expect(getRequiredWordCount(600)).toBe(2200);
  });

  it("builds enough local passage text for five-minute practice", () => {
    const passage = buildPracticePassage("Business email", 300);
    expect(passage.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(1100);
  });

  it("does not include the removed Dear Ms. Chan fallback passage", () => {
    const passage = buildPracticePassage("Business email", 60);

    expect(passage).not.toContain("Dear Ms. Chan");
    expect(passage).not.toContain("Please review the attached schedule");
    expect(passage).not.toContain("thank you for your prompt response");
  });
});
