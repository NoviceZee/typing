import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPassage, PASSAGE_LIBRARY_STORAGE_KEY, ACTIVE_PASSAGE_ID_STORAGE_KEY } from "./app-storage";
import {
  addPassage,
  deletePassage,
  filterLibraryPassagesByLanguage,
  exportPassageLibrary,
  getActivePassageId,
  getPassageLibrary,
  importPassageLibrary,
  setActivePassageId,
  updatePassage,
  updateSupabasePassage
} from "./passageStorage";

describe("passageStorage", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads and writes the existing passage library key", () => {
    addPassage(makePassage("one", "First passage"));

    expect(getPassageLibrary().map((passage) => passage.id)).toEqual(["one"]);
    expect(JSON.parse(storage.get(PASSAGE_LIBRARY_STORAGE_KEY) ?? "[]")[0].title).toBe("First passage");
  });

  it("updates and deletes passages without changing the storage key", () => {
    addPassage(makePassage("one", "First passage"));
    updatePassage("one", { title: "Updated passage", content: "Updated body text." });

    expect(getPassageLibrary()[0]).toMatchObject({
      id: "one",
      title: "Updated passage",
      content: "Updated body text."
    });

    deletePassage("one");
    expect(getPassageLibrary()).toEqual([]);
  });

  it("keeps the active passage id key compatible", () => {
    setActivePassageId("one");

    expect(getActivePassageId()).toBe("one");
    expect(storage.get(ACTIVE_PASSAGE_ID_STORAGE_KEY)).toBe("one");
  });

  it("imports arrays and exports the Typing Station library payload", () => {
    const summary = importPassageLibrary([makePassage("one", "Imported passage")]);
    const exported = exportPassageLibrary();

    expect(summary.imported).toBe(1);
    expect(exported.passages).toHaveLength(1);
    expect(exported.passages[0]).toMatchObject({ id: "one", title: "Imported passage" });
  });

  it("backfills existing passages to English and preserves explicit Chinese language", () => {
    storage.set(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("legacy", "Legacy English"),
        { ...makePassage("chinese", "中文短文"), language: "chinese", category: "生活", content: "今天的天氣很好。" }
      ])
    );

    expect(getPassageLibrary().map((passage) => [passage.id, passage.language])).toEqual([
      ["legacy", "english"],
      ["chinese", "chinese"]
    ]);
  });

  it("filters random passage pools by explicit language", () => {
    const english = makePassage("english", "English passage");
    const chinese = { ...makePassage("chinese", "中文短文"), language: "chinese" as const, content: "今天的天氣很好。" };

    expect(filterLibraryPassagesByLanguage([english, chinese], "english").map((passage) => passage.id)).toEqual(["english"]);
    expect(filterLibraryPassagesByLanguage([english, chinese], "chinese").map((passage) => passage.id)).toEqual(["chinese"]);
  });

  it("updates a Supabase passage and returns the refreshed row", async () => {
    const row = {
      id: "11111111-1111-4111-8111-111111111111",
      title: "Updated title",
      category: "News article",
      style: "General",
      language: "english",
      content: "Updated passage body text.",
      is_active: true,
      is_public: true,
      created_at: "2026-07-11T00:00:00.000Z",
      updated_at: "2026-07-11T00:01:00.000Z",
      created_by: "user-1"
    };
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn(() => ({ single }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));

    await expect(
      updateSupabasePassage(row.id, { title: row.title, content: row.content, isActive: true }, { from })
    ).resolves.toMatchObject({ id: row.id, title: row.title, content: row.content });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      title: row.title,
      content: row.content,
      is_active: true,
      is_public: true
    }));
    expect(eq).toHaveBeenCalledWith("id", row.id);
  });
});

function makePassage(id: string, title: string): LibraryPassage {
  return {
    id,
    title,
    category: "News article",
    style: "Simple",
    content: `${title} body text`,
    source: "uploaded",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    wordCount: 4,
    characterCount: 20,
    isActive: true
  };
}
