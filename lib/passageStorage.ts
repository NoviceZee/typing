import {
  CategoryFilter,
  LibraryPassage,
  PassageLibraryImportSummary,
  PassageSelectionMode,
  StyleFilter,
  addPassagesToLibrary,
  createPassageLibraryExport,
  deleteLibraryPassage,
  filterLibraryPassagesByLanguage,
  importPassageLibraryExport,
  readActivePassageId,
  readActivePassageLibrary,
  readPassageLibrary,
  readPassageSelectionMode,
  readSelectedCategory,
  readSelectedStyle,
  readSelectedLanguage,
  updateLibraryPassage,
  writeActivePassageId,
  writePassageLibrary,
  writePassageSelectionMode,
  writeSelectedCategory,
  writeSelectedStyle,
  writeSelectedLanguage
} from "./app-storage";
import { supabase } from "./supabaseClient";
import {
  SupabasePassageInsert,
  SupabasePassageUpdate,
  libraryPassageToSupabaseInsert,
  supabasePassageRowToLibraryPassage
} from "./supabasePassageTypes";

export type PassageUpdates = Partial<Omit<LibraryPassage, "id" | "createdAt">>;

export const PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS = 60_000;

let publicPassageLibraryCache: { passages: LibraryPassage[]; fetchedAt: number } | null = null;
let publicPassageLibraryRequest: Promise<LibraryPassage[]> | null = null;
let publicPassageLibraryCacheGeneration = 0;

export function invalidatePublicPassageLibraryCache() {
  publicPassageLibraryCache = null;
  publicPassageLibraryRequest = null;
  publicPassageLibraryCacheGeneration += 1;
}

// localStorage remains the offline/unconfigured fallback. Supabase-backed
// screens should call the async helpers below and fall back here only when
// Supabase is unavailable.
export function getPassageLibrary(): LibraryPassage[] {
  return readPassageLibrary();
}

export function savePassageLibrary(passages: LibraryPassage[]) {
  writePassageLibrary(passages);
  invalidatePublicPassageLibraryCache();
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

export function getSelectedLanguage() {
  return readSelectedLanguage();
}

export function setSelectedLanguage(language: "english" | "chinese") {
  writeSelectedLanguage(language);
}

export { filterLibraryPassagesByLanguage };

export function exportPassageLibrary() {
  return createPassageLibraryExport();
}

export function importPassageLibrary(payload: unknown, replaceExisting = false): PassageLibraryImportSummary {
  const importPayload = Array.isArray(payload) ? { passages: payload } : payload;
  const summary = importPassageLibraryExport(importPayload, replaceExisting);
  invalidatePublicPassageLibraryCache();
  return summary;
}

export function addPassage(passage: LibraryPassage) {
  addPassagesToLibrary([passage]);
  invalidatePublicPassageLibraryCache();
}

export function addPassages(passages: LibraryPassage[]) {
  addPassagesToLibrary(passages);
  if (passages.length > 0) {
    invalidatePublicPassageLibraryCache();
  }
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
  invalidatePublicPassageLibraryCache();
  return nextPassage;
}

export function deletePassage(id: string) {
  deleteLibraryPassage(id);
  invalidatePublicPassageLibraryCache();
}

// Public screens share the active/public request and short-lived result here;
// admin/private reads remain separate and never populate this cache.
export function getSupabasePassageLibrary(client: any = supabase): Promise<LibraryPassage[]> {
  if (!client) {
    return Promise.resolve([]);
  }

  if (
    publicPassageLibraryCache &&
    Date.now() - publicPassageLibraryCache.fetchedAt < PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS
  ) {
    return Promise.resolve(publicPassageLibraryCache.passages);
  }

  if (publicPassageLibraryRequest) {
    return publicPassageLibraryRequest;
  }

  const requestGeneration = publicPassageLibraryCacheGeneration;
  const request = loadSupabasePublicPassageLibrary(client).then((passages) => {
    if (requestGeneration === publicPassageLibraryCacheGeneration) {
      publicPassageLibraryCache = { passages, fetchedAt: Date.now() };
    }
    return passages;
  });

  publicPassageLibraryRequest = request;
  void request.finally(() => {
    if (publicPassageLibraryRequest === request) {
      publicPassageLibraryRequest = null;
    }
  }).catch(() => undefined);

  return request;
}

async function loadSupabasePublicPassageLibrary(client: any): Promise<LibraryPassage[]> {
  const { data, error } = await client
    .from("passages")
    .select("*")
    .eq("is_public", true)
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row: { is_public: boolean; is_active: boolean }) => row.is_public && row.is_active)
    .map(supabasePassageRowToLibraryPassage);
}

export async function getSupabaseAdminPassageLibrary(client: any = supabase): Promise<LibraryPassage[]> {
  if (!client) {
    return [];
  }

  const { data, error } = await client.from("passages").select("*").order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map(supabasePassageRowToLibraryPassage);
}

export async function getSupabasePassageById(id: string): Promise<LibraryPassage | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.from("passages").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw error;
  }

  return data ? supabasePassageRowToLibraryPassage(data) : null;
}

export async function addSupabasePassage(
  passage: LibraryPassage,
  createdBy: string | null,
  client: any = supabase
): Promise<LibraryPassage> {
  const insertPayload: SupabasePassageInsert = libraryPassageToSupabaseInsert(passage, createdBy);

  if (!client) {
    throw new Error("Supabase is not configured yet.");
  }

  const { data, error } = await client.from("passages").insert(insertPayload).select("*").single();

  if (error) {
    throw error;
  }

  const addedPassage = supabasePassageRowToLibraryPassage(data);
  invalidatePublicPassageLibraryCache();
  return addedPassage;
}

export async function updateSupabasePassage(
  id: string,
  updates: PassageUpdates,
  client: any = supabase
): Promise<LibraryPassage> {
  const updatePayload: SupabasePassageUpdate = {
    title: updates.title,
    category: updates.category,
    style: updates.style,
    language: updates.language,
    content: updates.content,
    is_active: updates.isActive,
    is_public: true
  };

  if (!client) {
    throw new Error("Supabase is not configured yet.");
  }

  const { data, error } = await client.from("passages").update(updatePayload).eq("id", id).select("*").single();

  if (error) {
    throw error;
  }

  const updatedPassage = supabasePassageRowToLibraryPassage(data);
  invalidatePublicPassageLibraryCache();
  return updatedPassage;
}

export async function deleteSupabasePassage(id: string, client: any = supabase): Promise<void> {
  if (!client) {
    throw new Error("Supabase is not configured yet.");
  }

  const { error } = await client.from("passages").delete().eq("id", id);

  if (error) {
    throw error;
  }

  invalidatePublicPassageLibraryCache();
}

export async function exportSupabasePassageLibrary(): Promise<LibraryPassage[]> {
  return getSupabasePassageLibrary();
}

export async function importSupabasePassageLibrary(
  passages: LibraryPassage[],
  createdBy: string | null,
  client: any = supabase
): Promise<LibraryPassage[]> {
  if (!client) {
    throw new Error("Supabase is not configured yet.");
  }

  const insertPayload = passages.map((passage) => libraryPassageToSupabaseInsert(passage, createdBy));
  const { data, error } = await client.from("passages").insert(insertPayload).select("*");

  if (error) {
    throw error;
  }

  const importedPassages = (data ?? []).map(supabasePassageRowToLibraryPassage);
  if (passages.length > 0) {
    invalidatePublicPassageLibraryCache();
  }
  return importedPassages;
}
