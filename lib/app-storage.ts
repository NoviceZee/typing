import {
  CompletionReason,
  DEFAULT_RULES,
  PracticeCategory,
  TypingResult,
  TypingRules,
  buildPracticePassage,
  getRequiredWordCount
} from "./typing-engine";

export const RULES_STORAGE_KEY = "formaltype.rules.v1";
export const PASSAGE_STORAGE_KEY = "formaltype.passage.v1";
export const PASSAGE_LIBRARY_STORAGE_KEY = "formaltype_passage_library";
export const ACTIVE_PASSAGE_ID_STORAGE_KEY = "formaltype_active_passage_id";
export const CURRENT_PASSAGE_STORAGE_KEY = "formaltype_current_passage";
export const PASSAGE_SELECTION_MODE_STORAGE_KEY = "formaltype_passage_selection_mode";
export const SELECTED_CATEGORY_STORAGE_KEY = "formaltype_selected_category";
export const SELECTED_STYLE_STORAGE_KEY = "formaltype_selected_style";
export const PREVIOUS_RESULTS_STORAGE_KEY = "formaltype_previous_results";
export const THEME_SETTINGS_STORAGE_KEY = "formaltype.theme.v1";
export const ALL_FILTER = "All";

export const THEME_SETTING_CHANGE_EVENT = "formaltype-theme-settings-change";

export const CATEGORIES: PracticeCategory[] = [
  "Business email",
  "Tender / proposal writing",
  "Government / formal English",
  "News article",
  "Casual writing",
  "Legal / contract style",
  "Random paragraph",
  "Uncategorised"
];

export const STYLES = [
  "Simple",
  "Intermediate",
  "Advanced",
  "Formal",
  "Concise",
  "Long sentences",
  "Punctuation-heavy",
  "Mixed case practice"
];

export type StoredPassage = {
  id?: string;
  title?: string;
  category: PracticeCategory;
  style: string;
  text: string;
  source?: PassageSource;
  updatedAt: string;
};

export type PassageSource = "generated" | "pasted" | "uploaded";
export type PassageSelectionMode = "specific" | "random";
export type CategoryFilter = typeof ALL_FILTER | PracticeCategory;
export type StyleFilter = typeof ALL_FILTER | string;

export type LibraryPassage = {
  id: string;
  title: string;
  content: string;
  category: PracticeCategory;
  style: string;
  source: PassageSource;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  characterCount: number;
  isActive: boolean;
};

export type PreviousPaceTimelinePoint = {
  timeSeconds: number;
  characterIndex: number;
  wpm?: number;
};

export type PreviousTypingResult = {
  passageId: string;
  passageTitle: string;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  errors: number;
  correctCharacters: number;
  typedCharacters: number;
  elapsedSeconds: number;
  durationSeconds?: number;
  previousPaceTimeline?: PreviousPaceTimelinePoint[];
  completedAt: string;
  completionReason: CompletionReason;
};

export type PassageLibraryExport = {
  version: 1;
  exportedAt: string;
  passages: unknown[];
  settings: {
    activePassageId: string | null;
    selectedCategory: string | null;
    selectedStyle: string | null;
    passageSelectionMode: PassageSelectionMode | null;
  };
};

export type PassageLibraryImportSummary = {
  imported: number;
  skippedDuplicates: number;
  failedInvalidItems: number;
};

export type PassageLibraryImportResult = {
  library: LibraryPassage[];
  summary: PassageLibraryImportSummary;
};

export type ThemeMode = "dark" | "light" | "system";
export type AccentColor = "blue" | "purple" | "emerald" | "rose" | "amber";
export type TypingFont = "system" | "inter" | "jetbrains-mono" | "ibm-plex-mono";
export type TypingTextSize = "small" | "medium" | "large";
export type TypingWidth = "compact" | "comfortable" | "wide";

export type ThemeSettings = {
  mode: ThemeMode;
  accentColor: AccentColor;
  typingFont: TypingFont;
  typingTextSize: TypingTextSize;
  typingWidth: TypingWidth;
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mode: "dark",
  accentColor: "amber",
  typingFont: "system",
  typingTextSize: "medium",
  typingWidth: "comfortable"
};

export const THEME_MODE_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" }
];

export const ACCENT_COLOR_OPTIONS: Array<{ value: AccentColor; label: string }> = [
  { value: "blue", label: "Blue" },
  { value: "purple", label: "Purple" },
  { value: "emerald", label: "Emerald" },
  { value: "rose", label: "Rose" },
  { value: "amber", label: "Amber" }
];

export const TYPING_FONT_OPTIONS: Array<{ value: TypingFont; label: string }> = [
  { value: "system", label: "System" },
  { value: "inter", label: "Inter" },
  { value: "jetbrains-mono", label: "JetBrains Mono" },
  { value: "ibm-plex-mono", label: "IBM Plex Mono" }
];

export const TYPING_TEXT_SIZE_OPTIONS: Array<{ value: TypingTextSize; label: string }> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" }
];

export const TYPING_WIDTH_OPTIONS: Array<{ value: TypingWidth; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable" },
  { value: "wide", label: "Wide" }
];

export function readStoredRules(): TypingRules {
  if (typeof window === "undefined") {
    return DEFAULT_RULES;
  }

  try {
    const stored = window.localStorage.getItem(RULES_STORAGE_KEY);
    return stored ? { ...DEFAULT_RULES, ...JSON.parse(stored) } : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

export function writeStoredRules(rules: TypingRules) {
  window.localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

export function readThemeSettings(): ThemeSettings {
  if (typeof window === "undefined") {
    return DEFAULT_THEME_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(THEME_SETTINGS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : {};

    return normaliseThemeSettings(parsed);
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function writeThemeSettings(settings: ThemeSettings) {
  window.localStorage.setItem(THEME_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  if (typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_SETTING_CHANGE_EVENT, { detail: settings }));
  }
}

export function getDefaultPassage(durationSeconds = 60): StoredPassage {
  return {
    id: "default-generated",
    title: "Generated business email practice",
    category: "Business email",
    style: "Formal",
    text: buildPracticePassage("Business email", durationSeconds),
    source: "generated",
    updatedAt: new Date().toISOString()
  };
}

export function readStoredPassage(durationSeconds = 60): StoredPassage {
  if (typeof window === "undefined") {
    return getDefaultPassage(durationSeconds);
  }

  const libraryPassage = readPracticePassageFromLibrary(durationSeconds);
  if (libraryPassage) {
    writeStoredPassage(libraryPassage);
    return libraryPassage;
  }

  const fallback = getDefaultPassage(durationSeconds);
  writeStoredPassage(fallback);
  return fallback;
}

export function writeStoredPassage(passage: StoredPassage) {
  window.localStorage.setItem(CURRENT_PASSAGE_STORAGE_KEY, JSON.stringify(passage));
  window.localStorage.setItem(PASSAGE_STORAGE_KEY, JSON.stringify(passage));
}

export function readPassageLibrary(): LibraryPassage[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(PASSAGE_LIBRARY_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as LibraryPassage[]) : [];
    return Array.isArray(parsed) ? parsed.map(normaliseLibraryPassage).filter((passage) => passage.content?.trim()) : [];
  } catch {
    return [];
  }
}

export function writePassageLibrary(passages: LibraryPassage[]) {
  window.localStorage.setItem(PASSAGE_LIBRARY_STORAGE_KEY, JSON.stringify(passages));
}

export function createPassageLibraryExport(): PassageLibraryExport {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    passages: readPassageLibrary(),
    settings: {
      activePassageId: readLocalStorageValue(ACTIVE_PASSAGE_ID_STORAGE_KEY),
      selectedCategory: readLocalStorageValue(SELECTED_CATEGORY_STORAGE_KEY),
      selectedStyle: readLocalStorageValue(SELECTED_STYLE_STORAGE_KEY),
      passageSelectionMode: readPassageSelectionMode()
    }
  };
}

export function importPassageLibraryExport(payload: unknown, replaceExisting: boolean): PassageLibraryImportSummary {
  if (!isRecord(payload) || !Array.isArray(payload.passages)) {
    throw new Error("Import file must contain a passages array.");
  }

  const existingLibrary = replaceExisting ? [] : readPassageLibrary();
  const result = mergeImportedPassages(existingLibrary, payload.passages, replaceExisting);

  writePassageLibrary(result.library);
  restoreImportedSettings(payload.settings, result.library);

  return result.summary;
}

export function mergeImportedPassages(
  existingLibrary: LibraryPassage[],
  importedItems: unknown[],
  replaceExisting = false
): PassageLibraryImportResult {
  const importedLibrary: LibraryPassage[] = [];
  const existingIds = new Set(existingLibrary.map((passage) => passage.id));
  const importedIds = new Set<string>();
  const summary: PassageLibraryImportSummary = {
    imported: 0,
    skippedDuplicates: 0,
    failedInvalidItems: 0
  };

  for (const item of importedItems) {
    const passage = normaliseImportedLibraryPassage(item);

    if (!passage) {
      summary.failedInvalidItems += 1;
      continue;
    }

    if ((!replaceExisting && existingIds.has(passage.id)) || importedIds.has(passage.id)) {
      summary.skippedDuplicates += 1;
      continue;
    }

    importedIds.add(passage.id);
    importedLibrary.push(passage);
    summary.imported += 1;
  }

  return {
    library: replaceExisting ? importedLibrary : [...importedLibrary, ...existingLibrary],
    summary
  };
}

export function addPassagesToLibrary(passages: LibraryPassage[]) {
  const currentLibrary = readPassageLibrary();
  writePassageLibrary([...passages, ...currentLibrary]);
}

export function deleteLibraryPassage(id: string) {
  const nextLibrary = readPassageLibrary().filter((passage) => passage.id !== id);
  writePassageLibrary(nextLibrary);

  if (readActivePassageId() === id) {
    window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
  }
}

export function clearPassageLibrary() {
  window.localStorage.removeItem(PASSAGE_LIBRARY_STORAGE_KEY);
  window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
  window.localStorage.removeItem(PASSAGE_SELECTION_MODE_STORAGE_KEY);
}

export function readActivePassageId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
}

export function writeActivePassageId(id: string) {
  window.localStorage.setItem(ACTIVE_PASSAGE_ID_STORAGE_KEY, id);
}

export function readPassageSelectionMode(): PassageSelectionMode {
  if (typeof window === "undefined") {
    return "specific";
  }

  return window.localStorage.getItem(PASSAGE_SELECTION_MODE_STORAGE_KEY) === "random" ? "random" : "specific";
}

export function writePassageSelectionMode(mode: PassageSelectionMode) {
  window.localStorage.setItem(PASSAGE_SELECTION_MODE_STORAGE_KEY, mode);
}

export function readSelectedCategory(): CategoryFilter {
  if (typeof window === "undefined") {
    return ALL_FILTER;
  }

  return (window.localStorage.getItem(SELECTED_CATEGORY_STORAGE_KEY) || ALL_FILTER) as CategoryFilter;
}

export function writeSelectedCategory(category: CategoryFilter) {
  window.localStorage.setItem(SELECTED_CATEGORY_STORAGE_KEY, category);
}

export function readSelectedStyle(): StyleFilter {
  if (typeof window === "undefined") {
    return ALL_FILTER;
  }

  return window.localStorage.getItem(SELECTED_STYLE_STORAGE_KEY) || ALL_FILTER;
}

export function writeSelectedStyle(style: StyleFilter) {
  window.localStorage.setItem(SELECTED_STYLE_STORAGE_KEY, style);
}

export function createLibraryPassage({
  title,
  content,
  category,
  style,
  source
}: {
  title: string;
  content: string;
  category: PracticeCategory;
  style: string;
  source: PassageSource;
}): LibraryPassage {
  const cleanContent = content.trim();
  const now = new Date().toISOString();

  return {
    id: createId(),
    title: title.trim() || "Untitled passage",
    content: cleanContent,
    category,
    style,
    source,
    createdAt: now,
    updatedAt: now,
    wordCount: countWords(cleanContent),
    characterCount: cleanContent.length,
    isActive: true
  };
}

export type StoredPassageTextMode = "timed" | "single";

export function toStoredPassage(
  passage: LibraryPassage,
  durationSeconds = 60,
  library = readPassageLibrary(),
  textMode: StoredPassageTextMode = "timed"
): StoredPassage {
  return {
    id: passage.id,
    title: passage.title,
    category: passage.category,
    style: passage.style,
    source: passage.source,
    text: textMode === "single" ? passage.content : buildTimedPassageText(passage, library, durationSeconds),
    updatedAt: new Date().toISOString()
  };
}

export function readPracticePassageFromLibrary(durationSeconds = 60): StoredPassage | null {
  const library = readActivePassageLibrary();
  const filteredLibrary = filterLibraryPassages(library, readSelectedCategory(), readSelectedStyle());
  const selectableLibrary = filteredLibrary;

  if (selectableLibrary.length === 0) {
    window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
    return null;
  }

  const activeId = readActivePassageId();
  if (readPassageSelectionMode() === "random") {
    const randomPassage = selectRandomLibraryPassage(activeId ?? undefined, selectableLibrary) ?? selectableLibrary[0];
    writeActivePassageId(randomPassage.id);
    return toStoredPassage(randomPassage, durationSeconds, selectableLibrary);
  }

  const activePassage = activeId ? selectableLibrary.find((passage) => passage.id === activeId) : null;
  const selectedPassage = activePassage ?? selectableLibrary[0];

  if (selectedPassage.id !== activeId) {
    writeActivePassageId(selectedPassage.id);
  }

  return toStoredPassage(selectedPassage, durationSeconds, selectableLibrary);
}

export function selectDifferentLibraryPassage(currentId?: string, library = readPassageLibrary()): LibraryPassage | null {
  if (library.length === 0) {
    return null;
  }

  if (library.length === 1) {
    return library[0];
  }

  const currentIndex = currentId ? library.findIndex((passage) => passage.id === currentId) : -1;
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % library.length : 0;
  return library[nextIndex];
}

export function selectRandomLibraryPassage(currentId?: string, library = readPassageLibrary()): LibraryPassage | null {
  if (library.length === 0) {
    return null;
  }

  if (library.length === 1) {
    return library[0];
  }

  const choices = library.filter((passage) => passage.id !== currentId);
  return choices[Math.floor(Math.random() * choices.length)] ?? library[0];
}

export function filterLibraryPassages(
  library: LibraryPassage[],
  category: CategoryFilter = ALL_FILTER,
  style: StyleFilter = ALL_FILTER
): LibraryPassage[] {
  return library.filter((passage) => {
    const categoryMatches = category === ALL_FILTER || passage.category === category;
    const styleMatches = style === ALL_FILTER || passage.style === style;
    return categoryMatches && styleMatches;
  });
}

export function readActivePassageLibrary(): LibraryPassage[] {
  return readPassageLibrary().filter((passage) => passage.isActive);
}

export function readPreviousResults(): Record<string, PreviousTypingResult> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(PREVIOUS_RESULTS_STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as Record<string, PreviousTypingResult>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export type PreviousResultScope = number | string | null | undefined;

export function getPreviousResultStorageKey(passageId: string, scope?: PreviousResultScope) {
  if (typeof scope === "number") {
    return `${passageId}::${Math.round(scope)}s`;
  }

  if (typeof scope === "string" && scope.trim()) {
    return `${passageId}::${scope.trim()}`;
  }

  return passageId;
}

export function readPreviousResult(passageId?: string, scope?: PreviousResultScope): PreviousTypingResult | null {
  if (!passageId) {
    return null;
  }

  const previousResults = readPreviousResults();
  const scopedKey = getPreviousResultStorageKey(passageId, scope);
  return previousResults[scopedKey] ?? previousResults[passageId] ?? null;
}

export function writePreviousResult(
  passage: StoredPassage,
  result: TypingResult,
  typedCharacters: number,
  scope?: PreviousResultScope,
  previousPaceTimeline?: PreviousPaceTimelinePoint[]
) {
  if (!passage.id) {
    return;
  }

  const previousResults = readPreviousResults();
  previousResults[getPreviousResultStorageKey(passage.id, scope ?? result.durationSeconds)] = {
    passageId: passage.id,
    passageTitle: passage.title ?? "Untitled passage",
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    errors: result.incorrectCharacters,
    correctCharacters: result.correctCharacters,
    typedCharacters,
    elapsedSeconds: result.timeUsedSeconds,
    durationSeconds: result.durationSeconds,
    previousPaceTimeline,
    completedAt: result.completedAt,
    completionReason: result.completionReason
  };
  window.localStorage.setItem(PREVIOUS_RESULTS_STORAGE_KEY, JSON.stringify(previousResults));
}

export function updateLibraryPassage(updatedPassage: LibraryPassage) {
  const nextLibrary = readPassageLibrary().map((passage) =>
    passage.id === updatedPassage.id
      ? {
          ...updatedPassage,
          content: updatedPassage.content.trim(),
          title: updatedPassage.title.trim() || "Untitled passage",
          updatedAt: new Date().toISOString(),
          wordCount: countWords(updatedPassage.content),
          characterCount: updatedPassage.content.trim().length,
          isActive: updatedPassage.isActive
        }
      : passage
  );
  writePassageLibrary(nextLibrary);
}

export function splitTextIntoPassages(text: string): string[] {
  const normalisedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  return normalisedText
    .split(/^\s*(?:---|###|===|\[new passage\])\s*$/gim)
    .map((passage) => passage.trim())
    .filter(Boolean);
}

export function splitPastedPassages(text: string): string[] {
  return splitTextIntoPassages(text);
}

export function extractPassageTitle(content: string, fallbackTitle: string): { title: string; content: string } {
  const normalisedContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalisedContent.split("\n");
  const firstContentLineIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstContentLineIndex === -1) {
    return {
      title: fallbackTitle,
      content: ""
    };
  }

  const firstContentLine = lines[firstContentLineIndex];
  const headingMatch = firstContentLine.match(/^\s*##(?!#)\s*(.*)$/);

  if (!headingMatch) {
    return {
      title: fallbackTitle,
      content: normalisedContent.trim()
    };
  }

  const extractedTitle = headingMatch[1].trim();
  const remainingLines = [...lines.slice(0, firstContentLineIndex), ...lines.slice(firstContentLineIndex + 1)];

  return {
    title: extractedTitle || fallbackTitle,
    content: remainingLines.join("\n").trim()
  };
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildTimedPassageText(basePassage: LibraryPassage, library: LibraryPassage[], durationSeconds: number): string {
  const requiredWordCount = getRequiredWordCount(durationSeconds);
  const selected: LibraryPassage[] = [basePassage];
  let wordCount = basePassage.wordCount;

  if (wordCount >= requiredWordCount) {
    return basePassage.content;
  }

  const otherPassages = library.filter((passage) => passage.id !== basePassage.id);
  let index = 0;

  while (wordCount < requiredWordCount && otherPassages.length > 0) {
    const nextPassage = otherPassages[index % otherPassages.length];
    selected.push(nextPassage);
    wordCount += nextPassage.wordCount;
    index += 1;
  }

  while (wordCount < requiredWordCount && otherPassages.length === 0) {
    selected.push(basePassage);
    wordCount += basePassage.wordCount;
  }

  return selected.map((passage) => passage.content).join("\n\n");
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readLocalStorageValue(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function restoreImportedSettings(settings: unknown, library: LibraryPassage[]) {
  if (typeof window === "undefined" || !isRecord(settings)) {
    return;
  }

  if (typeof settings.selectedCategory === "string") {
    window.localStorage.setItem(SELECTED_CATEGORY_STORAGE_KEY, settings.selectedCategory);
  }

  if (typeof settings.selectedStyle === "string") {
    window.localStorage.setItem(SELECTED_STYLE_STORAGE_KEY, settings.selectedStyle);
  }

  if (settings.passageSelectionMode === "specific" || settings.passageSelectionMode === "random") {
    window.localStorage.setItem(PASSAGE_SELECTION_MODE_STORAGE_KEY, settings.passageSelectionMode);
  }

  if (typeof settings.activePassageId === "string") {
    if (library.some((passage) => passage.id === settings.activePassageId)) {
      window.localStorage.setItem(ACTIVE_PASSAGE_ID_STORAGE_KEY, settings.activePassageId);
    } else {
      window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
    }
  } else if (settings.activePassageId === null) {
    window.localStorage.removeItem(ACTIVE_PASSAGE_ID_STORAGE_KEY);
  }
}

function normaliseThemeSettings(settings: unknown): ThemeSettings {
  if (!isRecord(settings)) {
    return DEFAULT_THEME_SETTINGS;
  }

  return {
    mode: isThemeMode(settings.mode) ? settings.mode : DEFAULT_THEME_SETTINGS.mode,
    accentColor: isAccentColor(settings.accentColor) ? settings.accentColor : DEFAULT_THEME_SETTINGS.accentColor,
    typingFont: isTypingFont(settings.typingFont) ? settings.typingFont : DEFAULT_THEME_SETTINGS.typingFont,
    typingTextSize: isTypingTextSize(settings.typingTextSize)
      ? settings.typingTextSize
      : DEFAULT_THEME_SETTINGS.typingTextSize,
    typingWidth: isTypingWidth(settings.typingWidth) ? settings.typingWidth : DEFAULT_THEME_SETTINGS.typingWidth
  };
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === "dark" || value === "light" || value === "system";
}

function isAccentColor(value: unknown): value is AccentColor {
  return value === "blue" || value === "purple" || value === "emerald" || value === "rose" || value === "amber";
}

function isTypingFont(value: unknown): value is TypingFont {
  return value === "system" || value === "inter" || value === "jetbrains-mono" || value === "ibm-plex-mono";
}

function isTypingTextSize(value: unknown): value is TypingTextSize {
  return value === "small" || value === "medium" || value === "large";
}

function isTypingWidth(value: unknown): value is TypingWidth {
  return value === "compact" || value === "comfortable" || value === "wide";
}

function normaliseImportedLibraryPassage(item: unknown): LibraryPassage | null {
  if (!isRecord(item) || typeof item.content !== "string" || item.content.trim().length === 0) {
    return null;
  }

  const content = item.content.trim();
  const createdAt = typeof item.createdAt === "string" && item.createdAt.trim() ? item.createdAt : new Date().toISOString();
  const source = item.source === "generated" || item.source === "pasted" || item.source === "uploaded" ? item.source : "uploaded";

  return normaliseLibraryPassage({
    id: typeof item.id === "string" && item.id.trim() ? item.id : createId(),
    title: typeof item.title === "string" ? item.title : "Untitled passage",
    content,
    category: typeof item.category === "string" && item.category.trim() ? (item.category as PracticeCategory) : "Uncategorised",
    style: typeof item.style === "string" && item.style.trim() ? item.style : "General",
    source,
    createdAt,
    updatedAt: typeof item.updatedAt === "string" && item.updatedAt.trim() ? item.updatedAt : createdAt,
    wordCount: typeof item.wordCount === "number" ? item.wordCount : countWords(content),
    characterCount: typeof item.characterCount === "number" ? item.characterCount : content.length,
    isActive: typeof item.isActive === "boolean" ? item.isActive : true
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normaliseLibraryPassage(passage: LibraryPassage): LibraryPassage {
  const content = passage.content?.trim() ?? "";
  const createdAt = passage.createdAt ?? new Date().toISOString();

  return {
    ...passage,
    content,
    title: passage.title?.trim() || "Untitled passage",
    category: passage.category ?? "Uncategorised",
    style: passage.style || "General",
    createdAt,
    updatedAt: passage.updatedAt ?? createdAt,
    wordCount: typeof passage.wordCount === "number" ? passage.wordCount : countWords(content),
    characterCount: typeof passage.characterCount === "number" ? passage.characterCount : content.length,
    isActive: passage.isActive ?? true
  };
}
