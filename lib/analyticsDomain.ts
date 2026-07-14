export type AnalyticsDomain = "english" | "chinese" | "code";

export const ANALYTICS_DOMAIN_OPTIONS: Array<{ id: AnalyticsDomain; label: string }> = [
  { id: "english", label: "English" },
  { id: "chinese", label: "Chinese" },
  { id: "code", label: "Code" }
];

export function getResultAnalyticsDomain(result: {
  metric_domain?: string | null;
  passage_category?: string | null;
  category?: string | null;
  passage_title?: string | null;
  title?: string | null;
}): AnalyticsDomain {
  if (result.metric_domain === "english" || result.metric_domain === "chinese" || result.metric_domain === "code") {
    return result.metric_domain;
  }

  const categoryDomain = getCategoryAnalyticsDomain(result.passage_category ?? result.category ?? null);

  if (categoryDomain !== "english" || hasExplicitEnglishCategory(result.passage_category ?? result.category ?? null)) {
    return categoryDomain;
  }

  return getLegacyTitleAnalyticsDomain(result.passage_title ?? result.title ?? null) ?? categoryDomain;
}

export function getCategoryAnalyticsDomain(category: string | null | undefined): AnalyticsDomain {
  const normalizedCategory = category?.trim().toLowerCase() ?? "";

  if (normalizedCategory === "training_code") {
    return "code";
  }

  if (normalizedCategory === "training_chinese" || normalizedCategory === "chinese" || isChinesePracticeCategory(category)) {
    return "chinese";
  }

  return "english";
}

function hasExplicitEnglishCategory(category: string | null | undefined) {
  const normalizedCategory = category?.trim().toLowerCase() ?? "";

  return normalizedCategory.startsWith("training_") || Boolean(normalizedCategory);
}

function getLegacyTitleAnalyticsDomain(title: string | null | undefined): AnalyticsDomain | null {
  const normalizedTitle = title?.trim().toLowerCase() ?? "";

  if (!normalizedTitle) {
    return null;
  }

  if (/\btraining\s+chinese\b/.test(normalizedTitle) || /^chinese\b/.test(normalizedTitle)) {
    return "chinese";
  }

  if (/\btraining\s+code\b/.test(normalizedTitle)) {
    return "code";
  }

  return null;
}

export function getDomainEmptyState(domain: AnalyticsDomain): { title: string; action: string } {
  if (domain === "chinese") {
    return {
      title: "No Chinese results yet.",
      action: "Start a Chinese training session to build your stats."
    };
  }

  if (domain === "code") {
    return {
      title: "No Code results yet.",
      action: "Start a Code training session to build your stats."
    };
  }

  return {
    title: "No saved results yet.",
    action: "Start a practice or English training session to build your stats."
  };
}
import { isChinesePracticeCategory } from "./typing-engine";
