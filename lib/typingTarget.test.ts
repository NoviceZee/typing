import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, isTypingComparisonComplete, validateTypedText } from "./typing-engine";
import { createCanonicalTypingTarget } from "./typingTarget";

const REAL_POETRY_PASSAGES = [
  "空山新雨後，天氣晚來秋。明月松間照，清泉石上流。竹喧歸浣女，蓮動下漁舟。隨意春芳歇，王孫自可留。",
  "花近高樓傷客心，萬方多難此登臨。錦江春色來天地，玉壘浮雲變古今。北極朝廷終不改，西山寇盜莫相侵。可憐後主還祠廟，日暮聊為梁甫吟。"
] as const;

describe("canonical typing targets", () => {
  it.each(REAL_POETRY_PASSAGES)(
    "keeps the exact single-line production poem as the one comparable target",
    (text) => {
      const target = createCanonicalTypingTarget({ storedText: text });

      expect(target.displayText).toBe(text);
      expect(target.comparableText).toBe(text);
      expect(target.comparableText.at(-1)).toBe("。");
      expect(target.comparableText.lastIndexOf("。")).toBe(text.length - 1);
    }
  );

  it.each(REAL_POETRY_PASSAGES)(
    "maps multiline and trailing-newline production poem storage to the same comparable target",
    (text) => {
      const multiline = text.replaceAll("。", "。\r\n  ");
      const target = createCanonicalTypingTarget({ storedText: `${multiline}\n\n` });

      expect(target.displayText).toContain("\n");
      expect(target.comparableText).toBe(text);
      expect(target.comparableText.at(-1)).toBe("。");
      expect(target.comparableText.lastIndexOf("。")).toBe(text.length - 1);

      const comparison = validateTypedText({
        targetText: target.comparableText,
        typedText: text,
        rules: DEFAULT_RULES
      });
      const finalEntry = comparison.characters.find(
        (entry) => entry.index === target.comparableText.length - 1
      );
      expect(finalEntry).toMatchObject({
        expected: "。",
        actual: "。",
        status: "correct"
      });
      expect(comparison.activeTargetIndex).toBeNull();
      expect(isTypingComparisonComplete(comparison)).toBe(true);
    }
  );

  it.each(REAL_POETRY_PASSAGES)(
    "maps production Unicode line and paragraph separators to the same comparable target",
    (text) => {
      let separatorIndex = 0;
      const unicodeWrapped = text.replace(/。(?=.)/g, (separator) => {
        const lineBreak = separatorIndex % 2 === 0 ? "\u2028" : "\u2029";
        separatorIndex += 1;
        return `${separator}${lineBreak}`;
      });
      const target = createCanonicalTypingTarget({ storedText: unicodeWrapped });

      expect(unicodeWrapped.length).toBeGreaterThan(text.length);
      expect(target.comparableText).toBe(text);
      expect(target.comparableText.at(-1)).toBe("。");
    }
  );

  it("preserves authored full-width punctuation character-for-character", () => {
    const target = createCanonicalTypingTarget({
      storedText: "「『文字』」，王孫自可留。"
    });

    expect(target.comparableText).toBe("「『文字』」，王孫自可留。");
  });
});
