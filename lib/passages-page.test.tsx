/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PassagesPage from "../pages/passages";
import type { LibraryPassage } from "@/lib/app-storage";

const mockRouter = vi.hoisted(() => ({
  push: vi.fn()
}));

const mockPassageStorage = vi.hoisted(() => ({
  activePassageId: null as string | null,
  selectionMode: "random" as "random" | "specific",
  selectedCategory: "All",
  selectedStyle: "All",
  setPassageSelectionMode: vi.fn((mode: "random" | "specific") => {
    mockPassageStorage.selectionMode = mode;
  }),
  setSelectedCategory: vi.fn((category: string) => {
    mockPassageStorage.selectedCategory = category;
  }),
  setSelectedStyle: vi.fn((style: string) => {
    mockPassageStorage.selectedStyle = style;
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
    getActivePassageId: () => mockPassageStorage.activePassageId,
    getPassageSelectionMode: () => mockPassageStorage.selectionMode,
    getSelectedCategory: () => mockPassageStorage.selectedCategory,
    getSelectedStyle: () => mockPassageStorage.selectedStyle,
    setPassageSelectionMode: mockPassageStorage.setPassageSelectionMode,
    setSelectedCategory: mockPassageStorage.setSelectedCategory,
    setSelectedStyle: mockPassageStorage.setSelectedStyle,
    setActivePassageId: mockPassageStorage.setActivePassageId
  };
});

describe("PassagesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockRouter.push.mockReset();
    mockPassageStorage.activePassageId = null;
    mockPassageStorage.selectionMode = "random";
    mockPassageStorage.selectedCategory = "All";
    mockPassageStorage.selectedStyle = "All";
    mockPassageStorage.setPassageSelectionMode.mockClear();
    mockPassageStorage.setSelectedCategory.mockClear();
    mockPassageStorage.setSelectedStyle.mockClear();
    mockPassageStorage.setActivePassageId.mockClear();
    mockPassageStorage.getSupabasePassageLibrary.mockResolvedValue([
      makePassage("email", "Email brief", "Business email", "Formal"),
      makePassage("news", "News clip", "News article", "Simple")
    ]);
  });

  it("uses sticky visible filters instead of native category and style dropdowns", async () => {
    const { container } = render(<PassagesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Email brief").length).toBeGreaterThan(0);
    });

    expect(screen.getByTestId("passages-setup-panel").className).toContain("sticky");
    expect(screen.getByRole("group", { name: "Category" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Style" })).toBeTruthy();
    expect(container.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "News article category" }));
    expect(mockPassageStorage.setSelectedCategory).toHaveBeenCalledWith("News article");
    expect(screen.queryByText("Email brief")).toBeNull();
    expect(screen.getAllByText("News clip").length).toBeGreaterThan(0);
  });

  it("keeps passage selection usable with random and article buttons", async () => {
    render(<PassagesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Email brief").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: "Random passage" }));
    expect(mockPassageStorage.setPassageSelectionMode).toHaveBeenCalledWith("random");

    fireEvent.click(screen.getByRole("button", { name: "Select Email brief" }));
    expect(mockPassageStorage.setPassageSelectionMode).toHaveBeenCalledWith("specific");
    expect(mockPassageStorage.setActivePassageId).toHaveBeenCalledWith("email");
  });
});

function makePassage(id: string, title: string, category: LibraryPassage["category"], style: string): LibraryPassage {
  return {
    id,
    title,
    category,
    style,
    content: `${title} body text for typing.`,
    source: "uploaded",
    createdAt: "2026-05-31T00:00:00.000Z",
    updatedAt: "2026-05-31T00:00:00.000Z",
    wordCount: 6,
    characterCount: 32,
    isActive: true
  };
}
