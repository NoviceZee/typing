import type {
  LibraryPassage,
  PassageReviewStatus,
  PassageRiskClassification,
  PassageSourceType
} from "./app-storage";
import type { PracticeCategory } from "./typing-engine";
import { normalizePassageCategory } from "./passageCategories";

export type SupabasePassageRow = {
  id: string;
  title: string;
  category: string | null;
  style: string | null;
  content: string;
  language?: string | null;
  is_active: boolean;
  is_public: boolean;
  risk_classification?: PassageRiskClassification;
  source_type?: PassageSourceType;
  fictional?: boolean;
  reviewed_at?: string | null;
  review_notes?: string | null;
  review_status?: PassageReviewStatus;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};

export type SupabasePassageInsert = {
  id?: string;
  title: string;
  category?: string | null;
  style?: string | null;
  content: string;
  language?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  risk_classification?: PassageRiskClassification;
  source_type?: PassageSourceType;
  fictional?: boolean;
  reviewed_at?: string | null;
  review_notes?: string | null;
  review_status?: PassageReviewStatus;
  created_by?: string | null;
};

export type SupabasePassageUpdate = Partial<Omit<SupabasePassageInsert, "id" | "created_by">>;

export function supabasePassageRowToLibraryPassage(row: SupabasePassageRow): LibraryPassage {
  const content = row.content.trim();

  return {
    id: row.id,
    title: row.title.trim() || "Untitled passage",
    category: toPracticeCategory(row.category),
    style: row.style?.trim() || "General",
    language: row.language === "chinese" ? "chinese" : "english",
    content,
    source: "uploaded",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    wordCount: countWords(content),
    characterCount: content.length,
    riskClassification: row.risk_classification ?? null,
    sourceType: row.source_type ?? "original",
    fictional: row.fictional ?? false,
    reviewedAt: row.reviewed_at ?? null,
    reviewNotes: row.review_notes ?? null,
    reviewStatus: row.review_status ?? "draft",
    isActive: row.is_active,
    isPublic: row.is_public
  };
}

export function supabasePublicPassageRowToLibraryPassage(row: SupabasePassageRow): LibraryPassage {
  return {
    ...supabasePassageRowToLibraryPassage(row),
    reviewNotes: null
  };
}

export function libraryPassageToSupabaseInsert(
  passage: LibraryPassage,
  createdBy: string | null
): SupabasePassageInsert {
  return {
    title: passage.title,
    category: passage.category,
    style: passage.style,
    language: passage.language ?? "english",
    content: passage.content,
    risk_classification: null,
    source_type: passage.sourceType,
    fictional: passage.fictional,
    reviewed_at: null,
    review_notes: passage.reviewNotes,
    review_status: "draft",
    is_active: false,
    is_public: false,
    created_by: createdBy
  };
}

export function libraryPassageToSupabaseUpdate(passage: LibraryPassage): SupabasePassageUpdate {
  return {
    title: passage.title,
    category: passage.category,
    style: passage.style,
    language: passage.language ?? "english",
    content: passage.content,
    risk_classification: passage.riskClassification,
    source_type: passage.sourceType,
    fictional: passage.fictional,
    review_notes: passage.reviewNotes
  };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function toPracticeCategory(category: string | null): PracticeCategory {
  return normalizePassageCategory(category) as PracticeCategory;
}
