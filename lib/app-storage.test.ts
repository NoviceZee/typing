import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_PASSAGE_ID_STORAGE_KEY,
  LibraryPassage,
  PASSAGE_LIBRARY_STORAGE_KEY,
  PREVIOUS_RESULTS_STORAGE_KEY,
  extractPassageTitle,
  filterLibraryPassages,
  mergeImportedPassages,
  readPreviousResult,
  readPracticePassageFromLibrary,
  splitTextIntoPassages,
  toStoredPassage,
  writePreviousResult
} from "./app-storage";
import type { StoredPassage } from "./app-storage";
import type { TypingResult } from "./typing-engine";

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

describe("splitTextIntoPassages", () => {
  it("splits text on supported separator lines", () => {
    expect(splitTextIntoPassages("Passage one\n\n---\n\nPassage two\n\n###\n\nPassage three")).toEqual([
      "Passage one",
      "Passage two",
      "Passage three"
    ]);
  });

  it("returns one passage when there are no separators", () => {
    expect(splitTextIntoPassages("One single passage without separators")).toEqual([
      "One single passage without separators"
    ]);
  });

  it("normalises Windows line endings before splitting", () => {
    expect(splitTextIntoPassages("First\r\n\r\n---\r\n\r\nSecond")).toEqual(["First", "Second"]);
  });

  it("supports equals separators and uppercase new-passage markers", () => {
    expect(splitTextIntoPassages("First\n\n===\n\nSecond\n\n[NEW PASSAGE]\n\nThird")).toEqual([
      "First",
      "Second",
      "Third"
    ]);
  });

  it("does not split separator text inside a paragraph", () => {
    expect(splitTextIntoPassages("This paragraph mentions --- inside a sentence.")).toEqual([
      "This paragraph mentions --- inside a sentence."
    ]);
  });
});

describe("extractPassageTitle", () => {
  it("extracts a markdown h2 title and removes the heading from content", () => {
    expect(
      extractPassageTitle(
        "## The Importance of Time Management\nTime management is an essential skill...",
        "Articles - Part 1"
      )
    ).toEqual({
      title: "The Importance of Time Management",
      content: "Time management is an essential skill..."
    });
  });

  it("supports h2 headings without a following space and leading blank lines", () => {
    expect(extractPassageTitle("\n\n  ##Reading Every Day\r\nReading improves focus.", "Fallback")).toEqual({
      title: "Reading Every Day",
      content: "Reading improves focus."
    });
  });

  it("uses the fallback title when no heading exists", () => {
    expect(extractPassageTitle("Plain passage content.", "Articles - Part 2")).toEqual({
      title: "Articles - Part 2",
      content: "Plain passage content."
    });
  });

  it("uses the fallback title when the heading is empty", () => {
    expect(extractPassageTitle("##   \nBody text.", "Articles - Part 3")).toEqual({
      title: "Articles - Part 3",
      content: "Body text."
    });
  });
});

describe("filterLibraryPassages", () => {
  const library: LibraryPassage[] = [
    makePassage("1", "News simple", "News article", "Simple"),
    makePassage("2", "News formal", "News article", "Formal"),
    makePassage("3", "Tender simple", "Tender / proposal writing", "Simple")
  ];

  it("returns all passages when both filters are All", () => {
    expect(filterLibraryPassages(library, "All", "All").map((passage) => passage.id)).toEqual(["1", "2", "3"]);
  });

  it("filters by category with any style", () => {
    expect(filterLibraryPassages(library, "News article", "All").map((passage) => passage.id)).toEqual(["1", "2"]);
  });

  it("filters by category and style together", () => {
    expect(filterLibraryPassages(library, "News article", "Simple").map((passage) => passage.id)).toEqual(["1"]);
  });

  it("does not hide inactive passages by itself so manage views can show all statuses", () => {
    const hiddenPassage = { ...library[0], id: "hidden", isActive: false };
    expect(filterLibraryPassages([hiddenPassage], "All", "All").map((passage) => passage.id)).toEqual(["hidden"]);
  });
});

describe("toStoredPassage", () => {
  it("keeps the selected passage unexpanded when single-passage text is requested", () => {
    const passage = makePassage("1", "Selected", "Business email", "Formal");
    const support = makePassage("2", "Support", "Business email", "Formal");

    const timedPassage = toStoredPassage(passage, 60, [passage, support]);
    const singlePassage = toStoredPassage(passage, 60, [passage, support], "single");

    expect(timedPassage.text).toContain("Support body text");
    expect(singlePassage.text).toBe("Selected body text");
  });
});

describe("readPracticePassageFromLibrary", () => {
  it("replaces a missing active passage id with a selectable active passage", () => {
    const activePassage = makePassage("active", "Active", "Business email", "Formal");
    const inactivePassage = { ...makePassage("inactive", "Inactive", "Business email", "Formal"), isActive: false };
    storage.set(PASSAGE_LIBRARY_STORAGE_KEY, JSON.stringify([inactivePassage, activePassage]));
    storage.set(ACTIVE_PASSAGE_ID_STORAGE_KEY, "deleted");

    const selected = readPracticePassageFromLibrary(60);

    expect(selected?.id).toBe("active");
    expect(selected?.text).toContain("Active body text");
    expect(storage.get(ACTIVE_PASSAGE_ID_STORAGE_KEY)).toBe("active");
  });

  it("clears the active passage id when no active passage can be selected", () => {
    const inactivePassage = { ...makePassage("inactive", "Inactive", "Business email", "Formal"), isActive: false };
    storage.set(PASSAGE_LIBRARY_STORAGE_KEY, JSON.stringify([inactivePassage]));
    storage.set(ACTIVE_PASSAGE_ID_STORAGE_KEY, "inactive");

    const selected = readPracticePassageFromLibrary(60);

    expect(selected).toBeNull();
    expect(storage.get(ACTIVE_PASSAGE_ID_STORAGE_KEY)).toBeUndefined();
  });
});

describe("previous result storage", () => {
  it("scopes previous results by passage and duration", () => {
    const passage = makeStoredPassage("passage-1");

    writePreviousResult(passage, makeResult({ durationSeconds: 60, wpm: 42 }), 210);
    writePreviousResult(passage, makeResult({ durationSeconds: 300, wpm: 55 }), 275);

    expect(readPreviousResult("passage-1", 60)?.wpm).toBe(42);
    expect(readPreviousResult("passage-1", 300)?.wpm).toBe(55);
  });

  it("falls back to legacy passage-only previous results", () => {
    storage.set(
      PREVIOUS_RESULTS_STORAGE_KEY,
      JSON.stringify({
        "passage-1": makePreviousResult({ wpm: 39 })
      })
    );

    expect(readPreviousResult("passage-1", 60)?.wpm).toBe(39);
  });

  it("does not let different durations overwrite each other", () => {
    const passage = makeStoredPassage("passage-1");

    writePreviousResult(passage, makeResult({ durationSeconds: 60, wpm: 44 }), 220);
    writePreviousResult(passage, makeResult({ durationSeconds: 600, wpm: 61 }), 305);

    expect(readPreviousResult("passage-1", 60)?.wpm).toBe(44);
    expect(readPreviousResult("passage-1", 600)?.wpm).toBe(61);
  });
});

describe("mergeImportedPassages", () => {
  it("merges imported passages and skips duplicate ids", () => {
    const existing = [makePassage("existing", "Existing", "News article", "Simple")];
    const imported = [
      makePassage("new", "Imported", "Business email", "Formal"),
      makePassage("existing", "Duplicate existing", "Business email", "Formal"),
      makePassage("new", "Duplicate imported", "Business email", "Formal"),
      { title: "Invalid missing content" }
    ];

    const result = mergeImportedPassages(existing, imported, false);

    expect(result.summary).toEqual({
      imported: 1,
      skippedDuplicates: 2,
      failedInvalidItems: 1
    });
    expect(result.library.map((passage) => passage.id)).toEqual(["new", "existing"]);
  });

  it("replaces the existing library when requested", () => {
    const existing = [makePassage("existing", "Existing", "News article", "Simple")];
    const imported = [makePassage("new", "Imported", "Business email", "Formal")];

    const result = mergeImportedPassages(existing, imported, true);

    expect(result.summary.imported).toBe(1);
    expect(result.library.map((passage) => passage.id)).toEqual(["new"]);
  });

  it("normalises imported passages with missing optional fields", () => {
    const result = mergeImportedPassages(
      [],
      [
        {
          id: "partial",
          title: "Partial",
          content: "Imported passage body text."
        }
      ],
      false
    );

    expect(result.summary.imported).toBe(1);
    expect(result.library[0]).toMatchObject({
      id: "partial",
      title: "Partial",
      category: "Uncategorised",
      style: "General",
      source: "uploaded",
      isActive: true
    });
  });
});

function makePassage(id: string, title: string, category: LibraryPassage["category"], style: string): LibraryPassage {
  return {
    id,
    title,
    category,
    style,
    content: `${title} body text`,
    source: "uploaded",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    wordCount: 4,
    characterCount: 20,
    isActive: true
  };
}

function makeStoredPassage(id: string): StoredPassage {
  return {
    id,
    title: "Stored passage",
    category: "Business email",
    style: "Formal",
    source: "uploaded",
    text: "Stored passage body text",
    updatedAt: "2026-06-19T00:00:00.000Z"
  };
}

function makeResult({ durationSeconds, wpm }: { durationSeconds: number; wpm: number }): TypingResult {
  return {
    characters: [],
    characterStatuses: [],
    correctCharacters: wpm * 5,
    incorrectCharacters: 0,
    missedCharacters: 0,
    extraCharacters: 0,
    totalCharacters: wpm * 5,
    comparableTargetLength: wpm * 5,
    comparableTypedLength: wpm * 5,
    accuracy: 100,
    wpm,
    rawWpm: wpm,
    timeUsedSeconds: durationSeconds,
    durationSeconds,
    category: "Business email",
    presetName: "General",
    completionReason: "time_up",
    completedAt: "2026-06-19T00:00:00.000Z",
    isRankable: true
  };
}

function makePreviousResult({ wpm }: { wpm: number }) {
  return {
    passageId: "passage-1",
    passageTitle: "Legacy passage",
    wpm,
    rawWpm: wpm,
    accuracy: 100,
    errors: 0,
    correctCharacters: wpm * 5,
    typedCharacters: wpm * 5,
    elapsedSeconds: 60,
    completedAt: "2026-06-18T00:00:00.000Z",
    completionReason: "time_up"
  };
}
