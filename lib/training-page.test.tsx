/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIOUS_RESULTS_STORAGE_KEY, PreviousTypingResult } from "@/lib/app-storage";
import TrainingPage from "../pages/training";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({
    children,
    sideAd,
    topAd
  }: {
    children: React.ReactNode;
    sideAd?: boolean;
    topAd?: boolean;
  }) => (
    <div data-testid="app-shell" data-side-ad={String(sideAd)} data-top-ad={String(topAd)}>
      {topAd && <div data-testid="top-ad-slot">Top ad</div>}
      {sideAd && <div data-testid="side-ad-slot">Side ad</div>}
      {children}
    </div>
  ),
  AdPlaceholder: () => <div>Ad space</div>
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: null })
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseAnalyticsTypingResults: vi.fn().mockResolvedValue([]),
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([]),
    saveSupabaseTypingResult: vi.fn()
  };
});

describe("TrainingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders content toggles and keeps at least one content type selected", () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    expect(screen.getAllByRole("heading", { level: 1, name: "Training" }).length).toBeGreaterThan(0);
    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(contentGroup).getByRole("button", { name: "Numbers" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Symbols" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Chinese" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("renders text-only controls without visible section labels or control chrome", () => {
    render(<TrainingPage />);

    expect(screen.getAllByRole("button", { name: "Words" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Numbers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Symbols" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Code" })).toBeTruthy();

    expect(screen.queryByText("Content")).toBeNull();
    expect(screen.queryByText("Mode")).toBeNull();
    expect(screen.queryByText("Length")).toBeNull();
    expect(screen.queryByText("Difficulty")).toBeNull();

    const toolbar = screen.getByTestId("training-controls");
    expect(toolbar.className).toContain("justify-center");
    expect(toolbar.className).toContain("mx-auto");
    expect(toolbar.className).not.toContain("justify-between");
    expect(toolbar.className).not.toMatch(/rounded|border|bg-|shadow/);

    for (const button of within(toolbar).getAllByRole("button")) {
      expect(button.className).not.toMatch(/rounded|border|bg-/);
    }
  });

  it("allows multiple content types to be selected", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Numbers" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Symbols" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(contentGroup).getByRole("button", { name: "Numbers" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(contentGroup).getByRole("button", { name: "Symbols" }).getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      const drillText = screen.getByTestId("typing-character-layer").textContent ?? "";
      expect(drillText).toMatch(/[a-z]{3,}/);
      expect(drillText).toMatch(/\$?\d[\d,.]*%?/);
      expect(drillText).toMatch(/\+=|-=|\*=|\/=|==|!=|>=|<=|[()[\]{}<>!@#$%^&*;:]/);
    });
  });

  it("keeps Code exclusive from words, numbers, and symbols", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Numbers" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Symbols" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Numbers" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Symbols" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Code" }).getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/\b(const|let|function|if|for|return)\b/);
    });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(contentGroup).getByRole("button", { name: "Code" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("keeps Chinese exclusive and switches back to other content types", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Numbers" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Symbols" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Numbers" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Symbols" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Code" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Chinese" }).getAttribute("aria-pressed")).toBe("true");

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(contentGroup).getByRole("button", { name: "Chinese" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("shows Chinese Time and Words controls with word counts", () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));

    const modeGroup = screen.getByRole("group", { name: "Mode" });
    const lengthGroup = screen.getByRole("group", { name: "Length" });
    expect(within(modeGroup).getByRole("button", { name: "Time" })).toBeTruthy();
    expect(within(modeGroup).getByRole("button", { name: "Words" })).toBeTruthy();
    expect(within(modeGroup).queryByRole("button", { name: "Characters" })).toBeNull();
    for (const duration of ["15", "30", "60", "120"]) {
      expect(within(lengthGroup).getByRole("button", { name: duration })).toBeTruthy();
    }

    fireEvent.click(within(modeGroup).getByRole("button", { name: "Words" }));

    for (const count of ["10", "25", "50", "100"]) {
      expect(within(lengthGroup).getByRole("button", { name: count })).toBeTruthy();
    }
    expect(within(lengthGroup).queryByRole("button", { name: "25 words" })).toBeNull();
    expect(within(lengthGroup).queryByRole("button", { name: "200" })).toBeNull();
  });

  it("forces Code into time mode with only duration lengths", () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });
    const modeGroup = screen.getByRole("group", { name: "Mode" });
    const lengthGroup = screen.getByRole("group", { name: "Length" });

    fireEvent.click(within(modeGroup).getByRole("button", { name: "Words" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));

    expect(within(modeGroup).getByRole("button", { name: "Time" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(modeGroup).queryByRole("button", { name: "Words" })).toBeNull();
    for (const duration of ["15", "30", "60", "120"]) {
      expect(within(lengthGroup).getByRole("button", { name: duration })).toBeTruthy();
    }
    expect(within(lengthGroup).queryByRole("button", { name: "10" })).toBeNull();
  });

  it("shows time durations in time mode and word counts in words mode", () => {
    render(<TrainingPage />);
    const modeGroup = screen.getByRole("group", { name: "Mode" });
    const optionGroup = screen.getByRole("group", { name: "Length" });

    expect(within(modeGroup).getByRole("button", { name: "Time" }).getAttribute("aria-pressed")).toBe("true");
    for (const duration of ["15", "30", "60", "120"]) {
      expect(within(optionGroup).getByRole("button", { name: duration })).toBeTruthy();
    }
    expect(within(optionGroup).queryByRole("button", { name: "15s" })).toBeNull();

    fireEvent.click(within(modeGroup).getByRole("button", { name: "Words" }));

    expect(within(modeGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
    for (const count of ["10", "25", "50", "100"]) {
      expect(within(optionGroup).getByRole("button", { name: count })).toBeTruthy();
    }
    expect(within(optionGroup).queryByRole("button", { name: "10 words" })).toBeNull();
  });

  it("finishes words mode as soon as the generated target text is completed", async () => {
    render(<TrainingPage />);
    const modeGroup = screen.getByRole("group", { name: "Mode" });

    fireEvent.click(within(modeGroup).getByRole("button", { name: "Words" }));

    const lengthGroup = screen.getByRole("group", { name: "Length" });
    fireEvent.click(within(lengthGroup).getByRole("button", { name: "10" }));

    await waitFor(() => {
      const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";
      expect(targetText.trim().split(/\s+/)).toHaveLength(10);
    });

    const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";
    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), targetText);

    await waitFor(() => {
      expect(screen.getAllByText("Session ended").length).toBeGreaterThan(0);
    });
  });

  it("does not finish Code mode when the generated snippet text is completed before time expires", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[{}()[\];=]/);
    });

    const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";
    const firstSnippet = targetText.split("\n\n")[0] ?? targetText;
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Typing input"), { target: { value: firstSnippet } });

    expect(screen.queryByText("Session ended")).toBeNull();
    expect(screen.queryByText("Time up")).toBeNull();
  });

  it("focuses Words input with Tab without starting the timer", async () => {
    render(<TrainingPage />);
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;

    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Tab = start")).toBeTruthy();
    expect(input.disabled).toBe(false);

    const typedPrefix = (screen.getByTestId("typing-character-layer").textContent ?? "").slice(0, 3);
    fireEvent.change(input, { target: { value: typedPrefix } });

    await waitFor(() => {
      expect(screen.queryByText("Tab = start")).toBeNull();
    });
    expect(getCurrentCharacterIndex()).toBe(3);
  });

  it("focuses Code input with Tab without starting the timer", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[{}()[\];=]/);
    });

    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Tab = start")).toBeTruthy();
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: "c" } });

    await waitFor(() => {
      expect(screen.queryByText("Tab = start")).toBeNull();
    });
  });

  it("resets a running Training session when content changes", async () => {
    render(<TrainingPage />);
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const contentGroup = screen.getByRole("group", { name: "Content" });

    const initialTarget = screen.getByTestId("typing-character-layer").textContent ?? "";
    const typedPrefix = initialTarget.slice(0, 6);
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(input, { target: { value: typedPrefix } });

    expect(getCurrentCharacterIndex()).toBeGreaterThan(0);
    expect(screen.queryByText("Tab = start")).toBeNull();

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[{}()[\];=]/);
    });
    expect(getCurrentCharacterIndex()).toBe(0);
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("Tab = start")).toBeTruthy();
  });

  it("resets a running Training session when duration changes", async () => {
    render(<TrainingPage />);
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const contentGroup = screen.getByRole("group", { name: "Content" });
    const lengthGroup = screen.getByRole("group", { name: "Length" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));
    fireEvent.click(within(lengthGroup).getByRole("button", { name: "60" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[{}()[\];=]/);
    });

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(input, { target: { value: "c" } });
    expect(screen.queryByText("Tab = start")).toBeNull();

    fireEvent.click(within(lengthGroup).getByRole("button", { name: "30" }));

    await waitFor(() => {
      expect(screen.getByText("Tab = start")).toBeTruthy();
    });
    expect(getCurrentCharacterIndex()).toBe(0);
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Typing input"), { target: { value: "c" } });

    await waitFor(() => {
      expect(screen.getByText("0:30")).toBeTruthy();
    });
  });

  it("resets a running Training session when difficulty changes", async () => {
    render(<TrainingPage />);
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const difficultyGroup = screen.getByRole("group", { name: "Difficulty" });

    fireEvent.click(within(difficultyGroup).getByRole("button", { name: "Basic" }));
    await waitFor(() => {
      expect(within(difficultyGroup).getByRole("button", { name: "Basic" }).getAttribute("aria-pressed")).toBe("true");
    });

    const initialTarget = screen.getByTestId("typing-character-layer").textContent ?? "";
    const typedPrefix = initialTarget.slice(0, 3);
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(input, { target: { value: typedPrefix } });
    expect(getCurrentCharacterIndex()).toBeGreaterThan(0);

    fireEvent.click(within(difficultyGroup).getByRole("button", { name: "Advanced" }));

    await waitFor(() => {
      expect(within(difficultyGroup).getByRole("button", { name: "Advanced" }).getAttribute("aria-pressed")).toBe("true");
    });
    expect(getCurrentCharacterIndex()).toBe(0);
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("Tab = start")).toBeTruthy();
  });

  it("does not reset when clicking an already-selected Training option", async () => {
    render(<TrainingPage />);
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const contentGroup = screen.getByRole("group", { name: "Content" });

    const initialTarget = screen.getByTestId("typing-character-layer").textContent ?? "";
    const typedPrefix = initialTarget.slice(0, 3);
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(input, { target: { value: typedPrefix } });
    expect(getCurrentCharacterIndex()).toBe(3);

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));

    expect(getCurrentCharacterIndex()).toBe(3);
    expect((screen.getByLabelText("Typing input") as HTMLTextAreaElement).value).toBe(typedPrefix);
    expect(screen.queryByText("Tab = start")).toBeNull();
  });

  it("finishes Code mode when the selected timer expires", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });
    const lengthGroup = screen.getByRole("group", { name: "Length" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));
    fireEvent.click(within(lengthGroup).getByRole("button", { name: "15" }));

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[{}()[\];=]/);
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T00:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.change(screen.getByLabelText("Typing input"), { target: { value: "c" } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_250);
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
  });

  it("does not compare unfinished Chinese IME composition and commits once on compositionend", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(2);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.compositionUpdate(input, { data: "jin tian" });
    fireEvent.input(input, { target: { value: "jin tian" }, data: "jin tian", inputType: "insertCompositionText" });

    expect(input.value).toBe("jin tian");
    expect(screen.queryByText("Session ended")).toBeNull();
    expect(getCurrentCharacterIndex()).toBe(0);

    fireEvent.compositionEnd(input, { data: commit, target: { value: commit } });
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(2);
  });

  it("accepts an IME commit when committed input fires after compositionend", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "daap" }, data: "daap", inputType: "insertCompositionText" });
    fireEvent.compositionUpdate(input, { data: "daap" });
    expect(input.value).toBe("daap");

    fireEvent.compositionEnd(input, { data: commit });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getCurrentCharacterIndex()).toBe(0);

    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("waits for non-composing input before processing a Safari-style Chinese commit", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "daap" }, data: "daap", inputType: "insertCompositionText" });
    fireEvent.compositionEnd(input, { data: "", target: { value: commit } });

    await act(async () => {
      await Promise.resolve();
    });

    expect(getCurrentCharacterIndex()).toBe(0);

    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("does not consume a post-composition transaction when the first follow-up input is empty", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "ab" }, data: "ab", inputType: "insertCompositionText" });
    fireEvent.compositionEnd(input, { data: "", target: { value: "" } });
    fireEvent.input(input, { target: { value: "" }, data: null, inputType: "insertText" });

    expect(getCurrentCharacterIndex()).toBe(0);

    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("does not flush Chinese input while explicit composition remains active even when input reports non-composing", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(0);
    expect(screen.getByText("Tab = start")).toBeTruthy();

    fireEvent.compositionEnd(input, { data: "", target: { value: commit } });
    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("keeps Cangjie-style intermediate composition values inside the IME transaction", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "a" }, data: "a", inputType: "insertCompositionText" });
    fireEvent.compositionUpdate(input, { data: "a" });
    fireEvent.input(input, { target: { value: "日" }, data: "日", inputType: "insertText" });
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.input(input, { target: { value: "" }, inputType: "deleteContentBackward" });
    fireEvent.compositionUpdate(input, { data: "" });
    fireEvent.input(input, { target: { value: "ab" }, data: "ab", inputType: "insertCompositionText" });
    fireEvent.compositionUpdate(input, { data: "ab" });
    fireEvent.input(input, { target: { value: "日月" }, data: "日月", inputType: "insertText" });

    expect(getCurrentCharacterIndex()).toBe(0);
    expect(screen.getByText("Tab = start")).toBeTruthy();

    fireEvent.compositionEnd(input, { data: "", target: { value: commit } });
    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("uses the delayed Chinese fallback only when no committed input arrives first", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(2);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: "", target: { value: commit } });

    await act(async () => {
      await Promise.resolve();
    });
    expect(getCurrentCharacterIndex()).toBe(0);

    await waitFor(() => {
      expect(input.value).toBe(commit);
      expect(getCurrentCharacterIndex()).toBe(2);
    });
  });

  it("does not let a stale Chinese fallback affect a new Training configuration", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const staleCommit = getTargetPrefix(2);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: "", target: { value: staleCommit } });
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Code" }));

    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[{}()[\];=]/);
    });
    expect(getCurrentCharacterIndex()).toBe(0);
    expect(screen.getByText("Tab = start")).toBeTruthy();
  });

  it("accepts a multi-character IME commit exactly once and accepts a follow-up commit", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const firstCommit = getTargetPrefix(2);
    const secondCommit = getTargetPrefix(4).slice(2);
    const fullCommit = `${firstCommit}${secondCommit}`;

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: "daan" }, data: "daan", inputType: "insertCompositionText" });
    fireEvent.compositionEnd(input, { data: firstCommit });
    fireEvent.input(input, { target: { value: firstCommit }, data: firstCommit, inputType: "insertText" });
    fireEvent.input(input, { target: { value: firstCommit }, data: firstCommit, inputType: "insertText" });

    expect(input.value).toBe(firstCommit);
    expect(getCurrentCharacterIndex()).toBe(2);

    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: "", target: { value: fullCommit } });
    fireEvent.input(input, { target: { value: fullCommit }, data: secondCommit, inputType: "insertText" });

    expect(input.value).toBe(fullCommit);
    expect(getCurrentCharacterIndex()).toBe(4);
  });

  it("accepts two legitimate identical Chinese commits", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);
    const repeatedValue = `${commit}${commit}`;

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: "", target: { value: commit } });
    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });
    fireEvent.compositionStart(input);
    fireEvent.compositionEnd(input, { data: "", target: { value: repeatedValue } });
    fireEvent.input(input, { target: { value: repeatedValue }, data: commit, inputType: "insertText" });

    expect(input.value).toBe(repeatedValue);
    expect(getCurrentCharacterIndex()).toBeGreaterThanOrEqual(1);
  });

  it("does not start the Chinese timer until committed Chinese text flushes", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const commit = getTargetPrefix(1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.compositionStart(input);
    fireEvent.compositionUpdate(input, { data: "ha" });
    fireEvent.input(input, { target: { value: "ha" }, data: "ha", inputType: "insertCompositionText" });

    expect(screen.queryByText("Time up")).toBeNull();
    expect(screen.getByText("Tab = start")).toBeTruthy();

    fireEvent.compositionEnd(input, { data: "" });
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("Tab = start")).toBeTruthy();

    fireEvent.input(input, { target: { value: commit }, data: commit, inputType: "insertText" });

    await waitFor(() => {
      expect(screen.queryByText("Tab = start")).toBeNull();
    });
    expect(input.value).toBe(commit);
    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("focuses the Chinese IME sink with Tab without starting the timer", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });

    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    fireEvent.keyDown(window, { key: "Tab" });

    expect(document.activeElement).toBe(input);
    expect(screen.getByText("Tab = start")).toBeTruthy();
  });

  it("keeps committed Chinese text intact while Backspace clears an active IME draft", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const committed = getTargetPrefix(2);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(input, { target: { value: committed }, data: committed, inputType: "insertText" });
    expect(getCurrentCharacterIndex()).toBe(2);

    fireEvent.compositionStart(input);
    fireEvent.compositionUpdate(input, { data: "qic" });
    fireEvent.input(input, { target: { value: `${committed}qic` }, data: "qic", inputType: "insertCompositionText" });

    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent(
      input,
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        inputType: "deleteContentBackward",
        data: null
      })
    );
    fireEvent.input(input, { target: { value: `${committed}qi` }, inputType: "deleteContentBackward" });
    fireEvent.compositionUpdate(input, { data: "qi" });
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.input(input, { target: { value: `${committed}q` }, inputType: "deleteContentBackward" });
    fireEvent.compositionUpdate(input, { data: "q" });
    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.input(input, { target: { value: committed }, inputType: "deleteContentBackward" });
    fireEvent.compositionUpdate(input, { data: "" });

    expect(input.value).toBe(committed);
    expect(getCurrentCharacterIndex()).toBe(2);
  });

  it("keeps browser textarea ownership when a Chinese draft is edited and continued", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const committed = getTargetPrefix(2);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(input, { target: { value: committed }, data: committed, inputType: "insertText" });
    expect(getCurrentCharacterIndex()).toBe(2);

    fireEvent.compositionStart(input);
    fireEvent.input(input, { target: { value: `${committed}ch` }, data: "ch", inputType: "insertCompositionText" });
    fireEvent.input(input, { target: { value: `${committed}c` }, inputType: "deleteContentBackward" });
    fireEvent.input(input, { target: { value: `${committed}ch` }, data: "h", inputType: "insertCompositionText" });

    expect(input.value).toBe(`${committed}ch`);
    expect(getCurrentCharacterIndex()).toBe(2);
  });

  it("resumes normal Chinese Backspace correction from the textarea value after composition ends", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    await waitFor(() => {
      expect(screen.getByTestId("typing-character-layer").textContent ?? "").toMatch(/[\u4e00-\u9fff]/);
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;
    const committed = getTargetPrefix(2);
    const corrected = committed.slice(0, 1);

    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(input, { target: { value: committed }, data: committed, inputType: "insertText" });
    expect(getCurrentCharacterIndex()).toBe(2);

    fireEvent.compositionStart(input);
    fireEvent.compositionUpdate(input, { data: "" });
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(getCurrentCharacterIndex()).toBe(2);

    fireEvent.compositionEnd(input, { data: "", target: { value: committed } });
    fireEvent.input(input, { target: { value: corrected }, inputType: "deleteContentBackward" });

    expect(getCurrentCharacterIndex()).toBe(1);
  });

  it("visually separates Chinese terms without requiring spaces and completes Words mode", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Mode" })).getByRole("button", { name: "Words" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Length" })).getByRole("button", { name: "10" }));

    await waitFor(() => {
      expect(screen.getAllByTestId("training-token")).toHaveLength(10);
    });

    const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";
    expect(targetText).toMatch(/^[\u4e00-\u9fff]+$/);
    expect(targetText).not.toContain(" ");

    const input = screen.getByLabelText("Typing input");
    fireEvent.keyDown(window, { key: "Tab" });
    fireEvent.input(input, { target: { value: targetText }, data: targetText, inputType: "insertText" });

    await waitFor(() => {
      expect(screen.getAllByText("Session ended").length).toBeGreaterThan(0);
    });
  });

  it("finishes Chinese Time mode when the selected timer expires", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });
    const lengthGroup = screen.getByRole("group", { name: "Length" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));
    fireEvent.click(within(lengthGroup).getByRole("button", { name: "15" }));

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-04T00:00:00.000Z"));
    fireEvent.keyDown(window, { key: "Tab" });
    const commit = getTargetPrefix(1);
    fireEvent.input(screen.getByLabelText("Typing input"), { target: { value: commit }, data: commit, inputType: "insertText" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_250);
    });

    expect(screen.getAllByText("Time up").length).toBeGreaterThan(0);
  });

  it("renders word difficulty options", () => {
    render(<TrainingPage />);
    const difficultyGroup = screen.getByRole("group", { name: "Difficulty" });

    for (const difficulty of ["Basic", "Intermediate", "Advanced", "Mixed"]) {
      expect(within(difficultyGroup).getByRole("button", { name: difficulty })).toBeTruthy();
    }

    expect(within(difficultyGroup).getByRole("button", { name: "Intermediate" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("hides training metadata while preserving previous pace", async () => {
    window.localStorage.setItem(
      PREVIOUS_RESULTS_STORAGE_KEY,
      JSON.stringify({
        "training-words::60s": makePreviousResult({ passageId: "training-words", passageTitle: "Training", wpm: 42.5 })
      })
    );

    render(<TrainingPage />);

    await waitFor(() => {
      expect(screen.getByTestId("previous-pace-display").textContent).toContain("Previous pace: 42.5 WPM");
    });
    expect(screen.queryByTestId("practice-passage-metadata")).toBeNull();
    expect(screen.queryByText(/Training · training_words/)).toBeNull();
  });

  it("renders a stable Chinese target viewport and exact Tab hint inside the input", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Chinese" }));

    await waitFor(() => {
      expect(screen.getByTestId("chinese-target-viewport")).toBeTruthy();
    });
    const input = screen.getByLabelText("Typing input") as HTMLTextAreaElement;

    expect(input.placeholder).toBe("請在此按 Tab 後開始輸入");
    expect(screen.getByTestId("chinese-input-area").contains(input)).toBe(true);
    expect(screen.getByTestId("chinese-input-area").className).toContain("mx-auto");
    expect(screen.getByTestId("chinese-input-area").className).toContain("max-w-");
    expect(screen.getByTestId("chinese-target-viewport").className).toContain("mx-auto");
    expect(screen.getByTestId("typing-text-container").className).toContain("w-fit");
    expect(screen.getByTestId("chinese-target-viewport").contains(input)).toBe(false);
  });

  it("keeps the Training typing stage centered with an overlay timer slot", async () => {
    render(<TrainingPage />);

    const stage = document.querySelector(".formaltype-practice-shell");
    const viewport = screen.getByTestId("typing-viewport");
    const timer = screen.getByTestId("typing-timer-overlay");

    expect(stage?.className).toContain("mx-auto");
    expect(stage?.className).toContain("max-w-");
    expect(viewport.className).toContain("mx-auto");
    expect(timer.className).toContain("absolute");
    expect(timer.className).toContain("right-");
    expect(timer.className).not.toContain("sticky");
    expect(timer.textContent).toBe("1:00");

    fireEvent.keyDown(stage as Element, { key: "Tab" });
    const input = screen.getByLabelText("Typing input");
    fireEvent.change(input, { target: { value: "a" } });

    await waitFor(() => {
      expect(screen.getByTestId("typing-timer-overlay").className).toContain("absolute");
    });
    expect(screen.getByTestId("typing-viewport").className).toBe(viewport.className);
  });

  it("places one Training banner ad below the typing experience and shortcut hints", () => {
    const { container } = render(<TrainingPage />);
    const controls = screen.getByTestId("training-controls");
    const typingShell = container.querySelector(".formaltype-practice-shell");
    const trainingAd = screen.getByTestId("training-ad-slot");

    expect(screen.getByTestId("app-shell").getAttribute("data-top-ad")).toBe("false");
    expect(screen.getByTestId("app-shell").getAttribute("data-side-ad")).toBe("false");
    expect(screen.queryByTestId("top-ad-slot")).toBeNull();
    expect(screen.queryByTestId("side-ad-slot")).toBeNull();
    expect(screen.getAllByText("Ad space")).toHaveLength(1);
    expect(trainingAd.textContent).toContain("Ad space");
    expect(controls.compareDocumentPosition(trainingAd) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect((typingShell?.compareDocumentPosition(trainingAd) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Esc = finish").compareDocumentPosition(trainingAd) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("generates text that matches the selected content types", async () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Numbers" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));

    await waitFor(() => {
      const numberOnlyText = screen.getByTestId("typing-character-layer").textContent ?? "";
      expect(numberOnlyText).toMatch(/\$?\d[\d,.]*%?/);
      expect(numberOnlyText).not.toMatch(/\bmarket\b|\binvoice\b|\bclient\b|\bstatus\b/);
      expect(numberOnlyText).not.toMatch(/\+=|-=|\*=|\/=|==|!=|>=|<=|[()[\]{}<>!@#^&*;:]/);
    });

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));
    fireEvent.click(within(contentGroup).getByRole("button", { name: "Symbols" }));

    await waitFor(() => {
      const mixedText = screen.getByTestId("typing-character-layer").textContent ?? "";
      expect(mixedText).toMatch(/[a-z]{3,}/);
      expect(mixedText).toMatch(/\$?\d[\d,.]*%?/);
      expect(mixedText).toMatch(/\+=|-=|\*=|\/=|==|!=|>=|<=|[()[\]{}<>!@#$%^&*;:]/);
    });
  });
});

function typeIncrementally(input: HTMLElement, value: string) {
  let currentValue = "";

  for (const character of value) {
    currentValue += character;
    fireEvent.change(input, {
      target: { value: currentValue }
    });
  }
}

function getCurrentCharacterIndex() {
  const currentCharacter = document.querySelector("[data-testid='typing-character-layer'] .formaltype-typed-current");
  return Number(currentCharacter?.getAttribute("data-index") ?? "0");
}

function getTargetPrefix(length: number) {
  return Array.from(screen.getByTestId("typing-character-layer").textContent ?? "")
    .filter((character) => /[\u4e00-\u9fff]/.test(character))
    .join("")
    .slice(0, length);
}

function makePreviousResult(overrides: Partial<PreviousTypingResult> = {}): PreviousTypingResult {
  return {
    passageId: "training-words",
    passageTitle: "Training",
    wpm: 42.5,
    rawWpm: 42.5,
    accuracy: 98,
    errors: 1,
    correctCharacters: 120,
    typedCharacters: 122,
    elapsedSeconds: 60,
    durationSeconds: 60,
    previousPaceTimeline: [],
    completedAt: "2026-07-04T00:00:00.000Z",
    completionReason: "time_up",
    ...overrides
  };
}
