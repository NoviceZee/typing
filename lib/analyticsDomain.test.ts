import { describe, expect, it } from "vitest";
import { getCategoryAnalyticsDomain, getResultAnalyticsDomain } from "./analyticsDomain";

describe("analytics domain classification", () => {
  it("classifies practice and configurable Training categories into stable analytics domains", () => {
    expect(getCategoryAnalyticsDomain("Business email")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_words")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_numbers")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_symbols")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_words_numbers")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_words_symbols")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_numbers_symbols")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_words_numbers_symbols")).toBe("english");
    expect(getCategoryAnalyticsDomain("training_chinese")).toBe("chinese");
    expect(getCategoryAnalyticsDomain("Chinese")).toBe("chinese");
    expect(getCategoryAnalyticsDomain("生活")).toBe("chinese");
    expect(getCategoryAnalyticsDomain("工作")).toBe("chinese");
    expect(getCategoryAnalyticsDomain("香港")).toBe("chinese");
    expect(getCategoryAnalyticsDomain("training_code")).toBe("code");
  });

  it("classifies result-like rows by their category metadata", () => {
    expect(getResultAnalyticsDomain({ passage_category: "training_chinese" })).toBe("chinese");
    expect(getResultAnalyticsDomain({ passage_category: "training_code" })).toBe("code");
    expect(getResultAnalyticsDomain({ category: "training_words" })).toBe("english");
    expect(getResultAnalyticsDomain({ passage_category: null })).toBe("english");
  });

  it("classifies legacy Training titles when category metadata is missing", () => {
    expect(getResultAnalyticsDomain({ passage_category: null, passage_title: "Training Chinese" })).toBe("chinese");
    expect(getResultAnalyticsDomain({ category: null, title: "Training Chinese" })).toBe("chinese");
    expect(getResultAnalyticsDomain({ passage_category: null, passage_title: "Training Code" })).toBe("code");
    expect(getResultAnalyticsDomain({ passage_category: null, passage_title: "Training Words" })).toBe("english");
  });
});
