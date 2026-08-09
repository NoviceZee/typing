/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PassagesPage from "../pages/passages";
import type { LibraryPassage } from "@/lib/app-storage";

const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  query: {} as Record<string, string>
}));

const mockPassageStorage = vi.hoisted(() => ({
  activePassageId: null as string | null,
  selectionMode: "random" as "random" | "specific",
  selectedCategory: "All",
  selectedStyle: "All",
  selectedLanguage: "english" as "english" | "chinese",
  fallbackLibrary: [] as LibraryPassage[],
  setPassageSelectionMode: vi.fn((mode: "random" | "specific") => {
    mockPassageStorage.selectionMode = mode;
  }),
  setSelectedCategory: vi.fn((category: string) => {
    mockPassageStorage.selectedCategory = category;
  }),
  setSelectedStyle: vi.fn((style: string) => {
    mockPassageStorage.selectedStyle = style;
  }),
  setSelectedLanguage: vi.fn((language: "english" | "chinese") => {
    mockPassageStorage.selectedLanguage = language;
  }),
  setActivePassageId: vi.fn((id: string) => {
    mockPassageStorage.activePassageId = id;
  }),
  getSupabasePassageLibrary: vi.fn()
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => mockRouter
}));

vi.mock("@/lib/passageStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/passageStorage")>("@/lib/passageStorage");
  return {
    ...actual,
    getSupabasePassageLibrary: mockPassageStorage.getSupabasePassageLibrary,
    getPassageLibrary: () => [],
    getActivePassageLibrary: () => mockPassageStorage.fallbackLibrary,
    getActivePassageId: () => mockPassageStorage.activePassageId,
    getPassageSelectionMode: () => mockPassageStorage.selectionMode,
    getSelectedCategory: () => mockPassageStorage.selectedCategory,
    getSelectedStyle: () => mockPassageStorage.selectedStyle,
    getSelectedLanguage: () => mockPassageStorage.selectedLanguage,
    setPassageSelectionMode: mockPassageStorage.setPassageSelectionMode,
    setSelectedCategory: mockPassageStorage.setSelectedCategory,
    setSelectedStyle: mockPassageStorage.setSelectedStyle,
    setSelectedLanguage: mockPassageStorage.setSelectedLanguage,
    setActivePassageId: mockPassageStorage.setActivePassageId
  };
});

describe("PassagesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRouter.push.mockReset();
    mockRouter.query = {};
    mockPassageStorage.activePassageId = null;
    mockPassageStorage.selectionMode = "random";
    mockPassageStorage.selectedCategory = "All";
    mockPassageStorage.selectedStyle = "All";
    mockPassageStorage.selectedLanguage = "english";
    mockPassageStorage.fallbackLibrary = [];
    mockPassageStorage.setPassageSelectionMode.mockClear();
    mockPassageStorage.setSelectedCategory.mockClear();
    mockPassageStorage.setSelectedStyle.mockClear();
    mockPassageStorage.setSelectedLanguage.mockClear();
    mockPassageStorage.setActivePassageId.mockClear();
    mockPassageStorage.getSupabasePassageLibrary.mockResolvedValue([
      makePassage("email", "Email brief", "Business communication", "General", "english"),
      makePassage("news", "News clip", "News", "General", "english"),
      makePassage("chinese", "忙碌生活中的休息", "生活", "一般", "chinese", "現代城市生活節奏急速，休息能夠整理思緒。")
    ]);
  });

  it("keeps search, Language, and data-derived Category controls without public Style filtering", async () => {
    const { container } = render(<PassagesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Email brief").length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Category" })).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Search passages" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Style" })).toBeNull();
    expect(container.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "News category" }));
    expect(mockPassageStorage.setSelectedCategory).toHaveBeenCalledWith("News");
    expect(screen.getByRole("button", { name: "News category" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "News category" }).getAttribute("data-focus-ring")).toBe(
      "standard"
    );
    expect(screen.queryByText("Email brief")).toBeNull();
    expect(screen.getAllByText("News clip").length).toBeGreaterThan(0);
  });

  it("uses one semantic results surface without a permanent selector column or Random control", async () => {
    render(<PassagesPage />);

    await screen.findByText("Email brief");

    expect(screen.getByRole("region", { name: "Library setup" })).toBeTruthy();
    expect(screen.getAllByRole("region", { name: "Passage results" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Passage selection" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Random passage" })).toBeNull();
    expect(screen.queryByText("Article / Passage")).toBeNull();
  });

  it("exposes current passage semantics and one visible non-colour cue in the result row", async () => {
    mockPassageStorage.activePassageId = "email";
    mockPassageStorage.selectionMode = "specific";
    render(<PassagesPage />);

    const emailRow = await screen.findByRole("article", { name: "Email brief" });

    expect(emailRow.getAttribute("aria-current")).toBe("true");
    expect(within(emailRow).getByText("Selected")).toBeTruthy();
    expect(screen.getAllByTestId("selected-passage-cue")).toHaveLength(1);
    expect(screen.getByRole("article", { name: "News clip" }).getAttribute("aria-current")).toBeNull();
  });

  it("searches result titles and categories without changing passage metadata", async () => {
    render(<PassagesPage />);
    await screen.findByText("Email brief");

    const search = screen.getByRole("searchbox", { name: "Search passages" });
    fireEvent.change(search, { target: { value: "news" } });
    expect(screen.getByText("News clip")).toBeTruthy();
    expect(screen.queryByText("Email brief")).toBeNull();

    fireEvent.change(search, { target: { value: "business communication" } });
    expect(screen.getByText("Email brief")).toBeTruthy();
    expect(screen.queryByText("News clip")).toBeNull();
  });

  it("normalizes a legacy stored category before applying the Library filter", async () => {
    mockPassageStorage.selectedCategory = "News article";

    render(<PassagesPage />);

    expect(await screen.findByText("News clip")).toBeTruthy();
    expect(screen.queryByText("Email brief")).toBeNull();
    expect(screen.getByRole("button", { name: "News category" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("uses a shared semantic loading state while passages load", () => {
    mockPassageStorage.getSupabasePassageLibrary.mockReturnValue(new Promise(() => {}));

    render(<PassagesPage />);

    expect(screen.getByRole("status", { name: "Loading passage library" })).toBeTruthy();
    expect(screen.getByText("Loading passages...")).toBeTruthy();
  });

  it("shows a non-blocking refresh warning while retaining fallback passages", async () => {
    mockPassageStorage.fallbackLibrary = [
      makePassage("fallback", "Fallback passage", "Business email", "Formal", "english")
    ];
    mockPassageStorage.getSupabasePassageLibrary.mockRejectedValue(new Error("offline"));

    render(<PassagesPage />);

    expect((await screen.findByRole("status", { name: "Library refresh warning" })).textContent).toContain(
      "The library could not be refreshed. Showing available fallback passages."
    );
    expect(screen.getByText("Fallback passage")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Practice this passage" })).toBeTruthy();
  });

  it("uses shared empty states for an empty library and empty filtered results", async () => {
    mockPassageStorage.getSupabasePassageLibrary.mockResolvedValue([]);
    const view = render(<PassagesPage />);

    expect((await screen.findByRole("status", { name: "No passages available" })).textContent).toContain(
      "No passages are available yet."
    );

    mockPassageStorage.getSupabasePassageLibrary.mockResolvedValue([
      makePassage("email", "Email brief", "Business email", "Formal", "english")
    ]);
    view.unmount();
    render(<PassagesPage />);
    await screen.findByText("Email brief");

    fireEvent.change(screen.getByRole("searchbox", { name: "Search passages" }), {
      target: { value: "missing passage" }
    });
    expect(screen.getByRole("status", { name: "No matching passages" }).textContent).toContain(
      "No passages match the current filters or search."
    );
  });

  it("preserves the passage Practice action and navigation", async () => {
    render(<PassagesPage />);

    await screen.findByText("Email brief");
    const practiceAction = screen.getAllByRole("button", { name: "Practice this passage" })[0];
    expect(practiceAction.getAttribute("data-focus-ring")).toBe("standard");
    expect(practiceAction.getAttribute("data-touch-target")).toBe("44");
    fireEvent.click(practiceAction);

    expect(mockPassageStorage.setPassageSelectionMode).toHaveBeenCalledWith("specific");
    expect(mockPassageStorage.setActivePassageId).toHaveBeenCalledWith("email");
    expect(mockRouter.push).toHaveBeenCalledWith("/practice");
  });

  it("filters the Passage Library by explicit language and honors Practice query language", async () => {
    render(<PassagesPage />);

    await waitFor(() => {
      expect(screen.getByText("Email brief")).toBeTruthy();
    });

    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.queryByText("忙碌生活中的休息")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Chinese language" }));

    expect(screen.getAllByText("忙碌生活中的休息").length).toBeGreaterThan(0);
    expect(screen.queryByText("Email brief")).toBeNull();
    expect(screen.getByText(/32 chars$/).textContent).not.toContain("words");
  });

  it("has no fixed/minimum-width or horizontal-scroll-only mobile layout contract", () => {
    const source = readFileSync("pages/passages.tsx", "utf8");

    expect(source).not.toMatch(/(?:^|\s)(?:min-w|w)-\[(?:\d+(?:px|rem)|min-content|max-content)/);
    expect(source).not.toContain("overflow-x-auto");
  });
});

function makePassage(
  id: string,
  title: string,
  category: LibraryPassage["category"],
  style: string,
  language: LibraryPassage["language"],
  content = `${title} body text for typing.`
): LibraryPassage {
  return {
    id,
    title,
    category,
    style,
    language,
    content,
    source: "uploaded",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    wordCount: 6,
    characterCount: 32,
    isActive: true
  };
}
