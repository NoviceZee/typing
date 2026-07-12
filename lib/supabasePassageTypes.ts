import type { LibraryPassage } from "./app-storage";
import type { PracticeCategory } from "./typing-engine";

const PRACTICE_CATEGORIES = [
  "Business email",
  "Tender / proposal writing",
  "Government / formal English",
  "News article",
  "Casual writing",
  "Legal / contract style",
  "Random paragraph",
  "生活",
  "工作",
  "教育",
  "科技",
  "文化",
  "社會",
  "環境",
  "健康",
  "香港",
  "房屋",
  "土地",
  "交通",
  "民生",
  "養老",
  "勞工",
  "財政",
  "醫療",
  "文言文",
  "詩詞",
  "training_code",
  "training_chinese",
  "Uncategorised"
];

export type SupabasePassageRow = {
  id: string;
  title: string;
  category: string | null;
  style: string | null;
  content: string;
  language?: string | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
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
    isActive: row.is_active
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
    is_active: passage.isActive,
    is_public: true,
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
    is_active: passage.isActive,
    is_public: true
  };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function toPracticeCategory(category: string | null): PracticeCategory {
  const cleanCategory = category?.trim();
  return (PRACTICE_CATEGORIES.find((knownCategory) => knownCategory === cleanCategory) ?? "Uncategorised") as PracticeCategory;
}
