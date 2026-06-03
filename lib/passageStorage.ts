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
import { supabase } from "@/lib/supabaseClient";
import {
  SupabasePassageInsert,
  SupabasePassageUpdate,
  libraryPassageToSupabaseInsert,
  supabasePassageRowToLibraryPassage
} from "@/lib/supabasePassageTypes";

export type PassageUpdates = Partial<Omit<LibraryPassage, "id" | "createdAt">>;

// Active backend for FormalType today: localStorage.
// Future Supabase migration should replace the implementations below at this
// boundary so /passages, /practice, and /passages/manage do not need to learn a
// second storage API.
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

// Supabase-ready helpers. These are intentionally not used by the UI yet, so
// localStorage remains the default and fallback passage backend for now.
export async function getSupabasePassageLibrary(): Promise<LibraryPassage[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("passages")
    .select("*")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(supabasePassageRowToLibraryPassage);
}

export async function addSupabasePassage(passage: LibraryPassage, createdBy: string | null): Promise<LibraryPassage> {
  const insertPayload: SupabasePassageInsert = libraryPassageToSupabaseInsert(passage, createdBy);

  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  const { data, error } = await supabase.from("passages").insert(insertPayload).select("*").single();

  if (error) {
    throw error;
  }

  return supabasePassageRowToLibraryPassage(data);
}

export async function updateSupabasePassage(id: string, updates: PassageUpdates): Promise<LibraryPassage> {
  const updatePayload: SupabasePassageUpdate = {
    title: updates.title,
    category: updates.category,
    style: updates.style,
    content: updates.content,
    is_active: updates.isActive,
    is_public: true
  };

  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  const { data, error } = await supabase.from("passages").update(updatePayload).eq("id", id).select("*").single();

  if (error) {
    throw error;
  }

  return supabasePassageRowToLibraryPassage(data);
}

export async function deleteSupabasePassage(id: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  const { error } = await supabase.from("passages").delete().eq("id", id);

  if (error) {
    throw error;
  }
}

export async function exportSupabasePassageLibrary(): Promise<LibraryPassage[]> {
  return getSupabasePassageLibrary();
}

export async function importSupabasePassageLibrary(
  passages: LibraryPassage[],
  createdBy: string | null
): Promise<LibraryPassage[]> {
  if (!supabase) {
    throw new Error("Supabase is not configured yet.");
  }

  const insertPayload = passages.map((passage) => libraryPassageToSupabaseInsert(passage, createdBy));
  const { data, error } = await supabase.from("passages").insert(insertPayload).select("*");

  if (error) {
    throw error;
  }

  return (data ?? []).map(supabasePassageRowToLibraryPassage);
}
