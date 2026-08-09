export const ENGLISH_PASSAGE_CATEGORIES = [
  "Articles",
  "Personal writing",
  "News",
  "Business communication",
  "Government & public information",
  "Proposals & tenders",
  "Legal & contracts"
] as const;

export type EnglishPassageCategory = (typeof ENGLISH_PASSAGE_CATEGORIES)[number];

export const LEGACY_ENGLISH_CATEGORY_ALIASES = {
  "Random paragraph": "Articles",
  "Casual writing": "Personal writing",
  "News article": "News",
  "Business email": "Business communication",
  "Government / formal English": "Government & public information",
  "Tender / proposal writing": "Proposals & tenders",
  "Legal / contract style": "Legal & contracts"
} as const satisfies Record<string, EnglishPassageCategory>;

const LEGACY_DEACTIVATED_PASSAGE_CATEGORY_IDENTITIES = {
  "c13f0f8c-cefb-4d93-9b74-241d3229e448": "Legal / contract style",
  "443f564d-7b45-4008-a0b3-6ae275ca9f9f": "Random paragraph",
  "a903c9e1-356c-4204-8091-f0ad3f308f4d": "Casual writing",
  "0179ca91-3532-45ad-97ac-ea9dae8bbc09": "Random paragraph",
  "47c4994c-ef4e-47ec-9736-5e86916586cd": "Random paragraph",
  "a5488771-cfb4-47c5-bec6-d71899c442aa": "News article",
  "ef8eaa37-80eb-4c0e-be7d-8bbf0d9a06ae": "Casual writing",
  "04c16e3c-0f9c-4d38-80c0-2edbe57e4b5d": "Random paragraph",
  "f0c7ba6a-07e9-4efb-8289-845f36f6f56f": "Random paragraph"
} as const;

export function normalizeEnglishPassageCategory(value: string | null | undefined): EnglishPassageCategory | null {
  const category = value?.trim();
  if (!category) return null;

  if ((ENGLISH_PASSAGE_CATEGORIES as readonly string[]).includes(category)) {
    return category as EnglishPassageCategory;
  }

  return LEGACY_ENGLISH_CATEGORY_ALIASES[category as keyof typeof LEGACY_ENGLISH_CATEGORY_ALIASES] ?? null;
}

export const LEGACY_DEACTIVATED_PASSAGE_CATEGORIES = Object.freeze(
  Object.fromEntries(
    Object.entries(LEGACY_DEACTIVATED_PASSAGE_CATEGORY_IDENTITIES).map(([id, category]) => [
      id,
      normalizeEnglishPassageCategory(category)
    ])
  )
) as Readonly<Record<keyof typeof LEGACY_DEACTIVATED_PASSAGE_CATEGORY_IDENTITIES, EnglishPassageCategory>>;

export function getLegacyDeactivatedPassageCategory(passageId: string | null | undefined): EnglishPassageCategory | null {
  const id = passageId?.trim().toLowerCase();
  if (!id) return null;
  return LEGACY_DEACTIVATED_PASSAGE_CATEGORIES[id as keyof typeof LEGACY_DEACTIVATED_PASSAGE_CATEGORIES] ?? null;
}

export function normalizePassageCategory(value: string | null | undefined, fallback = "Uncategorised"): string {
  const category = value?.trim();
  if (!category) return fallback;
  return normalizeEnglishPassageCategory(category) ?? category;
}

export function normalizeCategoryFilter(value: string | null | undefined): string {
  const category = value?.trim();
  if (!category || category === "All") return "All";
  return normalizePassageCategory(category);
}

export function getCompatibleEnglishCategoryValues(value: string): string[] {
  const normalized = normalizeEnglishPassageCategory(value);
  if (!normalized) return [normalizePassageCategory(value)];

  const legacyAliases = Object.entries(LEGACY_ENGLISH_CATEGORY_ALIASES)
    .filter(([, category]) => category === normalized)
    .map(([legacy]) => legacy);
  return [normalized, ...legacyAliases];
}
