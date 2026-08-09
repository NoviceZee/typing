import { describe, expect, it } from "vitest";
import {
  ENGLISH_PASSAGE_CATEGORIES,
  LEGACY_DEACTIVATED_PASSAGE_CATEGORIES,
  LEGACY_ENGLISH_CATEGORY_ALIASES,
  getCompatibleEnglishCategoryValues,
  getLegacyDeactivatedPassageCategory,
  normalizeCategoryFilter,
  normalizeEnglishPassageCategory,
  normalizePassageCategory
} from "./passageCategories";

describe("English Corpus v2 category compatibility", () => {
  it("exposes only the seven public v2 English categories", () => {
    expect(ENGLISH_PASSAGE_CATEGORIES).toEqual([
      "Articles",
      "Personal writing",
      "News",
      "Business communication",
      "Government & public information",
      "Proposals & tenders",
      "Legal & contracts"
    ]);
    expect(ENGLISH_PASSAGE_CATEGORIES).not.toContain("Random paragraph");
  });

  it("normalizes every legacy category to its v2 genre", () => {
    expect(LEGACY_ENGLISH_CATEGORY_ALIASES).toEqual({
      "Random paragraph": "Articles",
      "Casual writing": "Personal writing",
      "News article": "News",
      "Business email": "Business communication",
      "Government / formal English": "Government & public information",
      "Tender / proposal writing": "Proposals & tenders",
      "Legal / contract style": "Legal & contracts"
    });

    for (const [legacy, expected] of Object.entries(LEGACY_ENGLISH_CATEGORY_ALIASES)) {
      expect(normalizeEnglishPassageCategory(legacy)).toBe(expected);
    }
  });

  it("keeps v2 categories stable and preserves unrelated Chinese or historical values", () => {
    expect(normalizePassageCategory(" News ")).toBe("News");
    expect(normalizePassageCategory("生活")).toBe("生活");
    expect(normalizePassageCategory("Unknown historical category")).toBe("Unknown historical category");
    expect(normalizePassageCategory(null)).toBe("Uncategorised");
  });

  it("normalizes stored filters while keeping All and unknown safe", () => {
    expect(normalizeCategoryFilter("Business email")).toBe("Business communication");
    expect(normalizeCategoryFilter("Random paragraph")).toBe("Articles");
    expect(normalizeCategoryFilter("All")).toBe("All");
    expect(normalizeCategoryFilter("生活")).toBe("生活");
    expect(normalizeCategoryFilter(null)).toBe("All");
  });

  it("returns reverse aliases for history queries without changing passage-specific assignments", () => {
    expect(getCompatibleEnglishCategoryValues("Articles")).toEqual(["Articles", "Random paragraph"]);
    expect(getCompatibleEnglishCategoryValues("News article")).toEqual(["News", "News article"]);
    expect(getCompatibleEnglishCategoryValues("生活")).toEqual(["生活"]);
  });

  it("keeps an explicit category fallback for exactly the nine deactivated legacy passages", () => {
    expect(LEGACY_DEACTIVATED_PASSAGE_CATEGORIES).toEqual({
      "c13f0f8c-cefb-4d93-9b74-241d3229e448": "Legal & contracts",
      "443f564d-7b45-4008-a0b3-6ae275ca9f9f": "Articles",
      "a903c9e1-356c-4204-8091-f0ad3f308f4d": "Personal writing",
      "0179ca91-3532-45ad-97ac-ea9dae8bbc09": "Articles",
      "47c4994c-ef4e-47ec-9736-5e86916586cd": "Articles",
      "a5488771-cfb4-47c5-bec6-d71899c442aa": "News",
      "ef8eaa37-80eb-4c0e-be7d-8bbf0d9a06ae": "Personal writing",
      "04c16e3c-0f9c-4d38-80c0-2edbe57e4b5d": "Articles",
      "f0c7ba6a-07e9-4efb-8289-845f36f6f56f": "Articles"
    });
    expect(getLegacyDeactivatedPassageCategory("a5488771-cfb4-47c5-bec6-d71899c442aa")).toBe("News");
    expect(getLegacyDeactivatedPassageCategory("00000000-0000-0000-0000-000000000000")).toBeNull();
  });
});
