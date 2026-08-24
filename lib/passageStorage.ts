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
  applyPassageReviewUpdate,
  isPassageApprovalValid,
  sanitizePassagePublication
} from "./passageReviewPolicy";
import {
  SupabasePassageInsert,
  SupabasePassageUpdate,
  libraryPassageToSupabaseInsert,
  libraryPassageToSupabaseUpdate,
  supabasePublicPassageRowToLibraryPassage,
  supabasePassageRowToLibraryPassage
} from "./supabasePassageTypes";

export type PassageUpdates = Partial<Omit<LibraryPassage, "id" | "createdAt">>;
export { isPassageApprovalValid };

export const PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS = 60_000;
export const PUBLIC_PASSAGE_SELECT =
  "id,title,category,style,content,language,is_active,is_public,created_at,updated_at";

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
  const currentById = new Map(readPassageLibrary().map((passage) => [passage.id, passage]));
  const safePassages = passages.map((passage) => {
    const current = currentById.get(passage.id);
    if (!current) {
      return sanitizeNewLocalPassage(passage);
    }
    if (passagesHaveSameStoredState(current, passage)) {
      return passage;
    }
    return applyPassageReviewUpdate(current, {
      ...current,
      ...passage,
      id: current.id,
      createdAt: current.createdAt
    });
  });
  writePassageLibrary(safePassages);
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

  const requestedPassage = {
    ...currentPassage,
    ...updates,
    id: currentPassage.id,
    createdAt: currentPassage.createdAt
  };

  const nextPassage = applyPassageReviewUpdate(currentPassage, requestedPassage);

  updateLibraryPassage(nextPassage);
  invalidatePublicPassageLibraryCache();
  return nextPassage;
}

export function deletePassage(id: string) {
  deleteLibraryPassage(id);
  invalidatePublicPassageLibraryCache();
}

function sanitizeNewLocalPassage(passage: LibraryPassage): LibraryPassage {
  return sanitizePassagePublication(passage);
}

function passagesHaveSameStoredState(left: LibraryPassage, right: LibraryPassage): boolean {
  const keys: Array<keyof LibraryPassage> = [
    "id",
    "title",
    "category",
    "style",
    "language",
    "content",
    "source",
    "createdAt",
    "updatedAt",
    "wordCount",
    "characterCount",
    "riskClassification",
    "sourceType",
    "fictional",
    "reviewedAt",
    "reviewNotes",
    "reviewStatus",
    "isActive",
    "isPublic"
  ];
  return keys.every((key) => left[key] === right[key]);
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
    .from("public_passages")
    .select(PUBLIC_PASSAGE_SELECT)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((row: { is_public: boolean; is_active: boolean }) => row.is_public && row.is_active)
    .map(supabasePublicPassageRowToLibraryPassage);
}

export async function getSupabaseAdminPassageLibrary(client: any = supabase): Promise<LibraryPassage[]> {
  if (!client) {
    return [];
  }

  const { data, error } = await client.rpc("get_admin_passages");

  if (error) {
    throw error;
  }

  return (data ?? []).map(supabasePassageRowToLibraryPassage);
}

export async function getSupabasePassageById(id: string): Promise<LibraryPassage | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("public_passages")
    .select(PUBLIC_PASSAGE_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? supabasePublicPassageRowToLibraryPassage(data) : null;
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

  const { data, error } = await client.from("passages").insert(insertPayload).select("id").single();

  if (error) {
    throw error;
  }

  const addedPassage = await getSupabaseAdminPassageById(data.id, client);
  if (!addedPassage) {
    throw new Error("Inserted passage was not returned by the admin passage reader.");
  }
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
    risk_classification: updates.riskClassification,
    source_type: updates.sourceType,
    fictional: updates.fictional,
    review_notes: updates.reviewNotes
  };

  if (updates.reviewStatus === "approved" && updates.riskClassification !== "A") {
    Object.assign(updatePayload, {
      review_status: "pending_review",
      reviewed_at: null,
      is_active: false,
      is_public: false
    } satisfies SupabasePassageUpdate);
  }

  return mutateSupabasePassage(id, updatePayload, client);
}

export async function submitSupabasePassageForReview(
  id: string,
  passage: LibraryPassage,
  client: any = supabase
): Promise<LibraryPassage> {
  return mutateSupabasePassage(
    id,
    {
      ...libraryPassageToSupabaseUpdate(passage),
      review_status: "pending_review",
      reviewed_at: null,
      is_active: false,
      is_public: false
    },
    client
  );
}

export async function approveSupabasePassage(
  id: string,
  passage: LibraryPassage,
  client: any = supabase
): Promise<LibraryPassage> {
  if (passage.riskClassification !== "A") {
    throw new Error("Risk classification A is required before approval.");
  }

  return mutateSupabasePassage(
    id,
    {
      ...libraryPassageToSupabaseUpdate(passage),
      review_status: "approved",
      reviewed_at: new Date().toISOString(),
      is_active: true,
      is_public: true
    },
    client
  );
}

export async function rejectSupabasePassage(
  id: string,
  passage: LibraryPassage,
  client: any = supabase
): Promise<LibraryPassage> {
  return mutateSupabasePassage(
    id,
    {
      ...libraryPassageToSupabaseUpdate(passage),
      review_status: "rejected",
      reviewed_at: null,
      is_active: false,
      is_public: false
    },
    client
  );
}

async function mutateSupabasePassage(
  id: string,
  updatePayload: SupabasePassageUpdate,
  client: any
): Promise<LibraryPassage> {

  if (!client) {
    throw new Error("Supabase is not configured yet.");
  }

  const { error } = await client.from("passages").update(updatePayload).eq("id", id).select("id").single();

  if (error) {
    throw error;
  }

  const updatedPassage = await getSupabaseAdminPassageById(id, client);
  if (!updatedPassage) {
    throw new Error("Updated passage was not returned by the admin passage reader.");
  }
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
  const { data, error } = await client.from("passages").insert(insertPayload).select("id");

  if (error) {
    throw error;
  }

  const insertedIds = new Set((data ?? []).map((row: { id: string }) => row.id));
  const importedPassages = (await getSupabaseAdminPassageLibrary(client)).filter((passage) =>
    insertedIds.has(passage.id)
  );
  if (passages.length > 0) {
    invalidatePublicPassageLibraryCache();
  }
  return importedPassages;
}

async function getSupabaseAdminPassageById(
  id: string,
  client: any
): Promise<LibraryPassage | null> {
  const { data, error } = await client
    .rpc("get_admin_passage", { target_passage_id: id })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? supabasePassageRowToLibraryPassage(data) : null;
}
