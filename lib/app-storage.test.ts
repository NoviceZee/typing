import { describe, expect, it } from "vitest";
import {
  LibraryPassage,
  extractPassageTitle,
  filterLibraryPassages,
  mergeImportedPassages,
  splitTextIntoPassages
} from "./app-storage";

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
