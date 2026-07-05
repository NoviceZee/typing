import type { StoredPassage } from "./app-storage";
import type { PracticeCategory } from "./typing-engine";

const TRAINING_CATEGORY_LABELS: Partial<Record<PracticeCategory, string>> = {
  training_words: "Words",
  training_numbers: "Numbers",
  training_symbols: "Symbols",
  training_code: "Code",
  training_chinese: "Chinese",
  training_words_numbers: "Words + Numbers",
  training_words_symbols: "Words + Symbols",
  training_numbers_symbols: "Numbers + Symbols",
  training_words_numbers_symbols: "Words + Numbers + Symbols"
};

export function formatCategoryLabel(category: PracticeCategory): string {
  return TRAINING_CATEGORY_LABELS[category] ?? category;
}

export function formatPassageResultMetadata(passage: StoredPassage): string {
  return `${formatPassageTitle(passage)} · ${formatCategoryLabel(passage.category)} · ${passage.style}`;
}

function formatPassageTitle(passage: StoredPassage): string {
  const title = passage.title?.trim() || "Untitled passage";

  if (isTrainingCategory(passage.category) && (/^Training\b/i.test(title) || /\btraining$/i.test(title))) {
    return "Training";
  }

  return title;
}

function isTrainingCategory(category: PracticeCategory): boolean {
  return category.startsWith("training_");
}
