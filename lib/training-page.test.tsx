/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PREVIOUS_RESULTS_STORAGE_KEY, PreviousTypingResult } from "@/lib/app-storage";
import TrainingPage from "../pages/training";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
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

  it("renders content toggles and keeps at least one content type selected", () => {
    render(<TrainingPage />);
    const contentGroup = screen.getByRole("group", { name: "Content" });

    expect(screen.getAllByRole("heading", { level: 1, name: "Training" }).length).toBeGreaterThan(0);
    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(contentGroup).getByRole("button", { name: "Numbers" }).getAttribute("aria-pressed")).toBe("false");
    expect(within(contentGroup).getByRole("button", { name: "Symbols" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(within(contentGroup).getByRole("button", { name: "Words" }));

    expect(within(contentGroup).getByRole("button", { name: "Words" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("renders text-only controls without visible section labels or control chrome", () => {
    render(<TrainingPage />);

    expect(screen.getAllByRole("button", { name: "Words" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Numbers" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Symbols" })).toBeTruthy();

    expect(screen.queryByText("Content")).toBeNull();
    expect(screen.queryByText("Mode")).toBeNull();
    expect(screen.queryByText("Length")).toBeNull();
    expect(screen.queryByText("Difficulty")).toBeNull();

    const toolbar = screen.getByTestId("training-controls");
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
