/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PracticePage from "../pages/practice";
import type { LibraryPassage } from "@/lib/app-storage";
import { PASSAGE_LIBRARY_STORAGE_KEY, readPreviousResult } from "@/lib/app-storage";
import { getSupabasePassageLibrary } from "@/lib/passageStorage";
import { saveSupabaseTypingResult } from "@/lib/typingResultStorage";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const authState: { user: { id: string } | null } = { user: null };

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: authState.user })
}));

vi.mock("@/lib/passageStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/passageStorage")>("@/lib/passageStorage");

  return {
    ...actual,
    getSupabasePassageLibrary: vi.fn()
  };
});

const mockedGetSupabasePassageLibrary = vi.mocked(getSupabasePassageLibrary);

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([]),
    saveSupabaseTypingResult: vi.fn().mockResolvedValue({
      id: "saved-result",
      created_at: "2026-06-19T00:00:00.000Z"
    })
  };
});

const mockedSaveSupabaseTypingResult = vi.mocked(saveSupabaseTypingResult);

describe("PracticePage passage loading", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    authState.user = null;
    mockedGetSupabasePassageLibrary.mockReset();
    mockedSaveSupabaseTypingResult.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows a quiet reserved placeholder until Supabase passage resolution finishes", async () => {
    let resolveSupabaseLibrary: (library: LibraryPassage[]) => void = () => {};
    mockedGetSupabasePassageLibrary.mockReturnValue(
      new Promise((resolve) => {
        resolveSupabaseLibrary = resolve;
      })
    );

    const { container } = render(<PracticePage />);

    expect(screen.getByTestId("passage-loading-placeholder")).toBeTruthy();
    expect(screen.queryByText("Loading passage...")).toBeNull();
    expect(container.textContent).not.toContain("Please review");
    expect(container.textContent).not.toContain("Local fallback body text");

    resolveSupabaseLibrary([makePassage("supabase", "Supabase active", "Supabase final body text.")]);

    await waitFor(() => {
      expect(container.textContent).toContain("Supabase final body text.");
    });
    expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
  });

  it("uses local fallback only after Supabase returns no active public passages", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    expect(screen.getByTestId("passage-loading-placeholder")).toBeTruthy();
    expect(screen.queryByText("Loading passage...")).toBeNull();
    expect(container.textContent).not.toContain("Local fallback body text.");

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text.");
    });
    expect(screen.queryByTestId("passage-loading-placeholder")).toBeNull();
  });

  it("shows the just-finished previous pace after restarting the same passage", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(justFinishedResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });
    expect(screen.queryByText("WPM Over Time")).toBeNull();
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps previous pace visible after starting the restarted same-passage attempt", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
  });

  it("shows previous pace after a time-up finish and same-passage restart", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
  });

  it("renders the in-text previous pace marker after a time-up same-passage restart", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 60);

    expect(justFinishedResult).toBeTruthy();
    expect(justFinishedResult?.timeline?.some((point) => point.timeSeconds === 10)).toBe(true);

    fireEvent.keyDown(window, { key: "Tab" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    const marker = screen.getByTestId("previous-pace-marker");
    expect(marker).toBeTruthy();
    expect(marker.getAttribute("data-character-index")).toBe(String("Local fallback body text".length));

    typeIncrementally(screen.getByLabelText("Typing input"), "L");

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();
  });

  it("removes the in-text previous pace marker when switching passages", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("local", "Local active", "Local fallback body text for typing."),
        makePassage("other", "Other active", "Other passage body text for typing.")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-21T12:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_250);
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    fireEvent.keyDown(window, { key: "Tab" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId("previous-pace-marker")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.keyDown(window, { key: "Enter" });
    fireEvent.keyUp(window, { key: "Tab" });
    vi.useRealTimers();

    fireEvent.change(screen.getByLabelText("Passage"), {
      target: { value: "other" }
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Other passage body text for typing");
    });
    expect(screen.queryByTestId("previous-pace-marker")).toBeNull();
  });

  it("preserves 5-minute previous pace after restarting the same passage", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for five minute typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for five minute typing");
    });

    fireEvent.click(screen.getByRole("button", { name: "5m" }));

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for five minute typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const justFinishedResult = readPreviousResult("local", 300);

    await waitFor(() => {
      expect(justFinishedResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });
    expect(readPreviousResult("local", 60)).toBeNull();
    expect(screen.queryByText("WPM Over Time")).toBeNull();
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
  });

  it("keeps previous comparison after closing the result modal and restarting", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Restart" }));
    const justFinishedResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(justFinishedResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${justFinishedResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });
  });

  it("shows the restarted same-passage attempt as the previous comparison in the next result modal", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const firstResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(firstResult).toBeTruthy();
      expect(screen.getByText(`Previous pace: ${firstResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("Previous Attempt")).toBeTruthy();
      expect(screen.getAllByText(`previous ${firstResult?.wpm.toFixed(1)}`).length).toBeGreaterThan(0);
    });
  });

  it("changes the previous pace comparison when selecting a different passage", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([
        makePassage("local", "Local active", "Local fallback body text for typing."),
        makePassage("other", "Other active", "Other passage body text for typing.")
      ])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), "Local fallback body text");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Restart same passage" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Restart same passage" }));
    const localResult = readPreviousResult("local", 60);

    await waitFor(() => {
      expect(screen.getByText(`Previous pace: ${localResult?.wpm.toFixed(1)} WPM`)).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Passage"), {
      target: { value: "other" }
    });

    await waitFor(() => {
      expect(container.textContent).toContain("Other passage body text for typing");
    });
    expect(screen.queryByText(`Previous pace: ${localResult?.wpm.toFixed(1)} WPM`)).toBeNull();
  });

  it("prevents pasted text without showing a paste warning", async () => {
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    const input = screen.getByLabelText("Typing input");
    const pasteEvent = fireEvent.paste(input);

    expect(pasteEvent).toBe(false);
    expect(screen.queryByText("Pasting is disabled for fair results.")).toBeNull();
    expect((input as HTMLTextAreaElement).value).toBe("");
  });

  it("flags suspicious bursts and does not save or update previous pace", async () => {
    authState.user = { id: "user-1" };
    window.localStorage.setItem(
      PASSAGE_LIBRARY_STORAGE_KEY,
      JSON.stringify([makePassage("local", "Local active", "Local fallback body text for typing.")])
    );
    mockedGetSupabasePassageLibrary.mockResolvedValue([]);

    const { container } = render(<PracticePage />);

    await waitFor(() => {
      expect(container.textContent).toContain("Local fallback body text for typing");
    });

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Typing input"), {
      target: { value: "Local " }
    });
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.getByText("This result was not saved because suspicious input was detected.")).toBeTruthy();
    });

    expect(mockedSaveSupabaseTypingResult).not.toHaveBeenCalled();
    expect(readPreviousResult("local", 60)).toBeNull();
  });
});

function makePassage(id: string, title: string, content: string): LibraryPassage {
  return {
    id,
    title,
    category: "Business email",
    style: "Formal",
    content,
    source: "uploaded",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
    wordCount: content.split(/\s+/).filter(Boolean).length,
    characterCount: content.length,
    isActive: true
  };
}

function typeIncrementally(input: HTMLElement, value: string) {
  let currentValue = "";

  for (const character of value) {
    currentValue += character;
    fireEvent.change(input, {
      target: { value: currentValue }
    });
  }
}
