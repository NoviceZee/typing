import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATEGORIES } from "./app-storage";
import { ENGLISH_PASSAGE_CATEGORIES } from "./passageCategories";

describe("Manage passages category contract", () => {
  it("offers the seven v2 English categories without Random or legacy genres", () => {
    expect(CATEGORIES.slice(0, 7)).toEqual(ENGLISH_PASSAGE_CATEGORIES);
    expect(CATEGORIES).not.toContain("Random paragraph");
    expect(CATEGORIES).not.toContain("Business email");
    expect(CATEGORIES).not.toContain("News article");
  });

  it("defaults new English passages to Business communication", () => {
    const source = readFileSync("pages/passages/manage.tsx", "utf8");
    expect(source).toContain('useState<PracticeCategory>("Business communication")');
  });
});
