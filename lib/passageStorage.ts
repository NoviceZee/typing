import {
  CategoryFilter,
  LibraryPassage,
  PassageLibraryImportSummary,
  PassageSelectionMode,
  StyleFilter,
  addPassagesToLibrary,
  createPassageLibraryExport,
  deleteLibraryPassage,
  importPassageLibraryExport,
  readActivePassageId,
  readActivePassageLibrary,
  readPassageLibrary,
  readPassageSelectionMode,
  readSelectedCategory,
  readSelectedStyle,
  updateLibraryPassage,
  writeActivePassageId,
  writePassageLibrary,
  writePassageSelectionMode,
  writeSelectedCategory,
  writeSelectedStyle
} from "@/lib/app-storage";

export type PassageUpdates = Partial<Omit<LibraryPassage, "id" | "createdAt">>;

export function getPassageLibrary(): LibraryPassage[] {
  return readPassageLibrary();
}

export function savePassageLibrary(passages: LibraryPassage[]) {
  writePassageLibrary(passages);
}

export function getActivePassageLibrary(): LibraryPassage[] {
  return readActivePassageLibrary();
}

export function getActivePassageId(): string | null {
  return readActivePassageId();
}

export function setActivePassageId(id: string) {
  writeActivePassageId(id);
}

export function getPassageSelectionMode(): PassageSelectionMode {
  return readPassageSelectionMode();
}

export function setPassageSelectionMode(mode: PassageSelectionMode) {
  writePassageSelectionMode(mode);
}

export function getSelectedCategory(): CategoryFilter {
  return readSelectedCategory();
}

export function setSelectedCategory(category: CategoryFilter) {
  writeSelectedCategory(category);
}

export function getSelectedStyle(): StyleFilter {
  return readSelectedStyle();
}

export function setSelectedStyle(style: StyleFilter) {
  writeSelectedStyle(style);
}

export function exportPassageLibrary() {
  return createPassageLibraryExport();
}

export function importPassageLibrary(payload: unknown, replaceExisting = false): PassageLibraryImportSummary {
  const importPayload = Array.isArray(payload) ? { passages: payload } : payload;
  return importPassageLibraryExport(importPayload, replaceExisting);
}

export function addPassage(passage: LibraryPassage) {
  addPassagesToLibrary([passage]);
}

export function addPassages(passages: LibraryPassage[]) {
  addPassagesToLibrary(passages);
}

export function updatePassage(id: string, updates: PassageUpdates): LibraryPassage | null {
  const currentPassage = getPassageLibrary().find((passage) => passage.id === id);

  if (!currentPassage) {
    return null;
  }

  const nextPassage = {
    ...currentPassage,
    ...updates,
    id: currentPassage.id,
    createdAt: currentPassage.createdAt
  };

  updateLibraryPassage(nextPassage);
  return nextPassage;
}

export function deletePassage(id: string) {
  deleteLibraryPassage(id);
}
