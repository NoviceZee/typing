import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryPassage, PASSAGE_LIBRARY_STORAGE_KEY, ACTIVE_PASSAGE_ID_STORAGE_KEY } from "./app-storage";
vi.mock("./supabaseClient", () => ({ supabase: null }));

import {
  PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS,
  addSupabasePassage,
  addPassage,
  deleteSupabasePassage,
  getSupabaseAdminPassageLibrary,
  getSupabasePassageLibrary,
  deletePassage,
  filterLibraryPassagesByLanguage,
  exportPassageLibrary,
  getActivePassageId,
  getPassageLibrary,
  invalidatePublicPassageLibraryCache,
  importSupabasePassageLibrary,
  importPassageLibrary,
  setActivePassageId,
  updatePassage,
  updateSupabasePassage
} from "./passageStorage";

describe("passageStorage", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    invalidatePublicPassageLibraryCache();
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
    invalidatePublicPassageLibraryCache();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shares one in-flight public request between concurrent Practice and Library callers", async () => {
    const request = deferred<{ data: ReturnType<typeof makeSupabaseRow>[]; error: null }>();
    const client = makePublicQueryClient(request.promise);

    const practiceLoad = getSupabasePassageLibrary(client);
    const libraryLoad = getSupabasePassageLibrary(client);

    expect(client.from).toHaveBeenCalledTimes(1);
    request.resolve({ data: [makeSupabaseRow("one", "Shared corpus")], error: null });

    await expect(practiceLoad).resolves.toEqual(await libraryLoad);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("reuses a fresh public corpus from memory without a second request", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T00:00:00.000Z"));
    const client = makePublicQueryClient(
      Promise.resolve({ data: [makeSupabaseRow("one", "Cached corpus")], error: null })
    );

    const first = await getSupabasePassageLibrary(client);
    vi.advanceTimersByTime(PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS - 1);
    const second = await getSupabasePassageLibrary(client);

    expect(second).toBe(first);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it("fetches one fresh public corpus after the memory cache expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-09T00:00:00.000Z"));
    const client = makePublicQueryClient(
      Promise.resolve({ data: [makeSupabaseRow("one", "First corpus")], error: null })
    );

    await getSupabasePassageLibrary(client);
    vi.advanceTimersByTime(PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS);
    client.setResponse(Promise.resolve({ data: [makeSupabaseRow("two", "Fresh corpus")], error: null }));

    await expect(getSupabasePassageLibrary(client)).resolves.toMatchObject([{ id: "two" }]);
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it("keeps the last successful corpus when an expired refresh fails", async () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-08-09T00:00:00.000Z");
    vi.setSystemTime(startedAt);
    const client = makePublicQueryClient(
      Promise.resolve({ data: [makeSupabaseRow("one", "Last successful corpus")], error: null })
    );

    const successful = await getSupabasePassageLibrary(client);
    vi.advanceTimersByTime(PUBLIC_PASSAGE_LIBRARY_CACHE_TTL_MS);
    client.setResponse(Promise.resolve({ data: null, error: new Error("offline") }));
    await expect(getSupabasePassageLibrary(client)).rejects.toThrow("offline");

    vi.setSystemTime(new Date(startedAt.getTime() + 1));
    await expect(getSupabasePassageLibrary(client)).resolves.toBe(successful);
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  it("keeps private or inactive rows out of the public result and cache", async () => {
    const client = makePublicQueryClient(
      Promise.resolve({
        data: [
          makeSupabaseRow("public", "Public", { is_active: true, is_public: true }),
          makeSupabaseRow("private", "Private", { is_active: true, is_public: false }),
          makeSupabaseRow("inactive", "Inactive", { is_active: false, is_public: true })
        ],
        error: null
      })
    );

    await expect(getSupabasePassageLibrary(client)).resolves.toMatchObject([{ id: "public" }]);
    await expect(getSupabasePassageLibrary(client)).resolves.toMatchObject([{ id: "public" }]);
    expect(client.from).toHaveBeenCalledTimes(1);
    expect(client.publicEq).toHaveBeenCalledWith("is_public", true);
    expect(client.activeEq).toHaveBeenCalledWith("is_active", true);
  });

  it("does not populate the public cache from an admin/private read", async () => {
    const adminClient = makeAdminQueryClient([
      makeSupabaseRow("private", "Private", { is_active: true, is_public: false })
    ]);
    const publicClient = makePublicQueryClient(
      Promise.resolve({ data: [makeSupabaseRow("public", "Public")], error: null })
    );

    await expect(getSupabaseAdminPassageLibrary(adminClient)).resolves.toMatchObject([{ id: "private" }]);
    await expect(getSupabasePassageLibrary(publicClient)).resolves.toMatchObject([{ id: "public" }]);
    expect(publicClient.from).toHaveBeenCalledTimes(1);
  });

  it("invalidates the public cache after a successful admin mutation", async () => {
    const publicClient = makePublicQueryClient(
      Promise.resolve({ data: [makeSupabaseRow("one", "Before update")], error: null })
    );
    await getSupabasePassageLibrary(publicClient);

    const updatedRow = makeSupabaseRow("one", "After update");
    const mutationClient = makeUpdateClient(updatedRow);
    await updateSupabasePassage("one", { title: "After update" }, mutationClient);

    publicClient.setResponse(Promise.resolve({ data: [updatedRow], error: null }));
    await expect(getSupabasePassageLibrary(publicClient)).resolves.toMatchObject([{ title: "After update" }]);
    expect(publicClient.from).toHaveBeenCalledTimes(2);
  });

  it("invalidates the public cache after a successful admin create", async () => {
    const passage = makePassage("created", "Created passage");
    await expectMutationToInvalidatePublicCache(() =>
      addSupabasePassage(passage, "admin-1", makeInsertSingleClient(makeSupabaseRow("created", passage.title)))
    );
  });

  it("invalidates the public cache after a successful admin delete or deactivation", async () => {
    await expectMutationToInvalidatePublicCache(() =>
      deleteSupabasePassage("one", makeDeleteClient())
    );
  });

  it("invalidates the public cache after a successful admin import", async () => {
    const passage = makePassage("imported", "Imported passage");
    await expectMutationToInvalidatePublicCache(() =>
      importSupabasePassageLibrary(
        [passage],
        "admin-1",
        makeInsertManyClient([makeSupabaseRow("imported", passage.title)])
      )
    );
  });

  it("does not invalidate a fresh public cache when an admin mutation fails", async () => {
    const publicClient = makePublicQueryClient(
      Promise.resolve({ data: [makeSupabaseRow("one", "Unchanged corpus")], error: null })
    );
    await getSupabasePassageLibrary(publicClient);

    await expect(
      updateSupabasePassage("one", { title: "Rejected update" }, makeUpdateClient(null, new Error("denied")))
    ).rejects.toThrow("denied");
    await getSupabasePassageLibrary(publicClient);

    expect(publicClient.from).toHaveBeenCalledTimes(1);
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
    ).resolves.toMatchObject({ id: row.id, title: row.title, category: "News", content: row.content });

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

function makeSupabaseRow(
  id: string,
  title: string,
  overrides: Partial<{
    is_active: boolean;
    is_public: boolean;
  }> = {}
) {
  return {
    id,
    title,
    category: "Articles",
    style: "General",
    language: "english",
    content: `${title} body text.`,
    is_active: overrides.is_active ?? true,
    is_public: overrides.is_public ?? true,
    created_at: "2026-08-09T00:00:00.000Z",
    updated_at: "2026-08-09T00:00:00.000Z",
    created_by: null
  };
}

function makePublicQueryClient(initialResponse: Promise<{ data: ReturnType<typeof makeSupabaseRow>[] | null; error: Error | null }>) {
  let response = initialResponse;
  const order = vi.fn(() => response);
  const activeEq = vi.fn(() => ({ order }));
  const publicEq = vi.fn(() => ({ eq: activeEq }));
  const select = vi.fn(() => ({ eq: publicEq }));
  const from = vi.fn(() => ({ select }));

  return {
    from,
    publicEq,
    activeEq,
    setResponse(nextResponse: typeof initialResponse) {
      response = nextResponse;
    }
  };
}

function makeAdminQueryClient(rows: ReturnType<typeof makeSupabaseRow>[]) {
  const order = vi.fn().mockResolvedValue({ data: rows, error: null });
  const select = vi.fn(() => ({ order }));
  return { from: vi.fn(() => ({ select })) };
}

function makeUpdateClient(row: ReturnType<typeof makeSupabaseRow> | null, error: Error | null = null) {
  const single = vi.fn().mockResolvedValue({ data: row, error });
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ update })) };
}

function makeInsertSingleClient(row: ReturnType<typeof makeSupabaseRow>) {
  const single = vi.fn().mockResolvedValue({ data: row, error: null });
  const select = vi.fn(() => ({ single }));
  const insert = vi.fn(() => ({ select }));
  return { from: vi.fn(() => ({ insert })) };
}

function makeDeleteClient() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const deleteRows = vi.fn(() => ({ eq }));
  return { from: vi.fn(() => ({ delete: deleteRows })) };
}

function makeInsertManyClient(rows: ReturnType<typeof makeSupabaseRow>[]) {
  const select = vi.fn().mockResolvedValue({ data: rows, error: null });
  const insert = vi.fn(() => ({ select }));
  return { from: vi.fn(() => ({ insert })) };
}

async function expectMutationToInvalidatePublicCache(mutate: () => Promise<unknown>) {
  const publicClient = makePublicQueryClient(
    Promise.resolve({ data: [makeSupabaseRow("one", "Before mutation")], error: null })
  );
  await getSupabasePassageLibrary(publicClient);

  await mutate();
  publicClient.setResponse(Promise.resolve({ data: [makeSupabaseRow("two", "After mutation")], error: null }));
  await expect(getSupabasePassageLibrary(publicClient)).resolves.toMatchObject([{ id: "two" }]);
  expect(publicClient.from).toHaveBeenCalledTimes(2);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
