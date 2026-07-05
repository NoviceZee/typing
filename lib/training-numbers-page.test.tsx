/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingNumbersPage from "../pages/training/numbers";
import { saveSupabaseTypingResult } from "@/lib/typingResultStorage";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AdPlaceholder: () => <div>Ad space</div>
}));

const authState: { user: { id: string } | null } = { user: null };

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: authState.user })
}));

vi.mock("@/lib/typingResultStorage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/typingResultStorage")>("@/lib/typingResultStorage");

  return {
    ...actual,
    getSupabaseAnalyticsTypingResults: vi.fn().mockResolvedValue([]),
    getSupabaseOwnTypingResults: vi.fn().mockResolvedValue([]),
    saveSupabaseTypingResult: vi.fn().mockResolvedValue({
      id: "numbers-result",
      created_at: "2026-06-24T00:00:00.000Z"
    })
  };
});

const mockedSaveSupabaseTypingResult = vi.mocked(saveSupabaseTypingResult);

describe("TrainingNumbersPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    authState.user = null;
    mockedSaveSupabaseTypingResult.mockClear();
  });

  it("renders a numbers typing test", () => {
    render(<TrainingNumbersPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Numbers Training" })).toBeTruthy();
    expect(screen.getByTestId("practice-passage-metadata").textContent).toContain(
      "Training · Numbers · Numeric drills · 60s"
    );
    expect(screen.getByLabelText("Typing input")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Choose in Passages" })).toBeNull();
  });

  it("generates numeric-style tokens for the drill text", () => {
    render(<TrainingNumbersPage />);

    const drillText = screen.getByTestId("typing-character-layer").textContent ?? "";

    expect(drillText).toMatch(/\b\d{4,}\b/);
    expect(drillText).toMatch(/\b\d+\.\d{2}\b/);
    expect(drillText).toMatch(/\b\d{1,3},\d{3}\.\d{2}\b/);
    expect(drillText).toMatch(/\$\d{1,3},\d{3}\.\d{2}\b/);
    expect(drillText).toMatch(/\b\d+\.\d{2}%/);
  });

  it("saves completed numbers results with a safe numbers category", async () => {
    authState.user = { id: "user-1" };
    render(<TrainingNumbersPage />);

    const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), targetText.slice(0, 12));
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(mockedSaveSupabaseTypingResult).toHaveBeenCalled();
    });

    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].passage.category).toBe("training_numbers");
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].result.category).toBe("training_numbers");
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].supabasePassageId).toBe("training-numbers");
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
