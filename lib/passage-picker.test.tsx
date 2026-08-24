/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PassagePicker } from "@/components/PassagePicker";
import type { LibraryPassage, PassageLanguage } from "@/lib/app-storage";

const scrollIntoView = vi.fn();

describe("PassagePicker", () => {
  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it("autofocuses search and restricts compact options to the current language", () => {
    renderPicker();

    const search = screen.getByRole("searchbox", { name: "Search passages" });
    expect(document.activeElement).toBe(search);
    expect(search.closest("label")?.className).toContain("focus-within:ring-2");
    expect(search.closest("label")?.className).toContain("focus-within:ring-offset-2");
    expect(screen.getByRole("listbox", { name: "Passages" })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Email brief/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /中文短文/ })).toBeNull();
  });

  it("searches passage titles and categories", () => {
    renderPicker();

    const search = screen.getByRole("searchbox", { name: "Search passages" });
    fireEvent.change(search, { target: { value: "news" } });
    expect(screen.getByRole("option", { name: /News clip/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Email brief/ })).toBeNull();

    fireEvent.change(search, { target: { value: "business email" } });
    expect(screen.getByRole("option", { name: /Email brief/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /News clip/ })).toBeNull();
  });

  it("exposes one selected option with a visible non-colour cue", () => {
    renderPicker({ selectedPassageId: "email" });

    const selected = screen.getByRole("option", { name: /Email brief/ });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(within(selected).getByText("Selected")).toBeTruthy();
    expect(screen.getAllByText("Selected")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /News clip/ }).getAttribute("aria-selected")).toBe("false");
  });

  it("supports arrow, Home, End, and Enter selection and keeps the active option visible", () => {
    const onSelect = vi.fn();
    renderPicker({ onSelect });

    const search = screen.getByRole("searchbox", { name: "Search passages" });
    fireEvent.keyDown(search, { key: "End" });
    expect(search.getAttribute("aria-activedescendant")).toContain("news");
    fireEvent.keyDown(search, { key: "Home" });
    expect(search.getAttribute("aria-activedescendant")).toContain("email");
    fireEvent.keyDown(search, { key: "ArrowDown" });
    expect(search.getAttribute("aria-activedescendant")).toContain("news");
    fireEvent.keyDown(search, { key: "ArrowUp" });
    expect(search.getAttribute("aria-activedescendant")).toContain("email");
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onSelect).toHaveBeenCalledWith("email");
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("keeps options in the active-descendant flow and contains Tab navigation within the dialog", () => {
    renderPicker();

    expect(screen.getByRole("option", { name: /Email brief/ }).getAttribute("tabindex")).toBe("-1");
    const closeButton = screen.getByRole("button", { name: "Close passage picker" });
    const browseLibrary = screen.getByRole("link", { name: "Browse Library" });

    browseLibrary.focus();
    fireEvent.keyDown(browseLibrary, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    fireEvent.keyDown(closeButton, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(browseLibrary);
  });

  it("closes with Escape and retains a quiet full-Library route", () => {
    const onClose = vi.fn();
    renderPicker({ onClose });

    fireEvent.keyDown(screen.getByRole("searchbox", { name: "Search passages" }), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    const browseLibrary = screen.getByRole("link", { name: "Browse Library" });
    expect(browseLibrary.getAttribute("href")).toBe("/passages?language=english");
    fireEvent.keyDown(browseLibrary, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders nothing while closed", () => {
    renderPicker({ open: false });
    expect(screen.queryByRole("dialog", { name: "Choose a passage" })).toBeNull();
  });
});

function renderPicker({
  open = true,
  language = "english",
  selectedPassageId = null,
  onClose = vi.fn(),
  onSelect = vi.fn()
}: {
  open?: boolean;
  language?: PassageLanguage;
  selectedPassageId?: string | null;
  onClose?: () => void;
  onSelect?: (passageId: string) => void;
} = {}) {
  return render(
    <PassagePicker
      open={open}
      passages={[
        makePassage("email", "Email brief", "Business email", "Formal", "english"),
        makePassage("news", "News clip", "News article", "English longform v1", "english"),
        makePassage("chinese", "中文短文", "生活", "Modern essay", "chinese")
      ]}
      language={language}
      selectedPassageId={selectedPassageId}
      libraryHref={`/passages?language=${language}`}
      onClose={onClose}
      onSelect={onSelect}
    />
  );
}

function makePassage(
  id: string,
  title: string,
  category: LibraryPassage["category"],
  style: string,
  language: PassageLanguage
): LibraryPassage {
  return {
    id,
    title,
    category,
    style,
    language,
    content: `${title} body text`,
    source: "uploaded",
    createdAt: "2026-08-08T00:00:00.000Z",
    updatedAt: "2026-08-08T00:00:00.000Z",
    wordCount: 4,
    characterCount: 24,
    riskClassification: "A",
    sourceType: "original",
    fictional: false,
    reviewedAt: "2026-08-08T00:00:00.000Z",
    reviewNotes: null,
    reviewStatus: "approved",
    isActive: true,
    isPublic: true
  };
}
