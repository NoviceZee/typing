/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TrainingSymbolsPage from "../pages/training/symbols";
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
      id: "symbols-result",
      created_at: "2026-06-24T00:00:00.000Z"
    })
  };
});

const mockedSaveSupabaseTypingResult = vi.mocked(saveSupabaseTypingResult);

describe("TrainingSymbolsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    authState.user = null;
    mockedSaveSupabaseTypingResult.mockClear();
  });

  it("renders a symbols typing test", () => {
    render(<TrainingSymbolsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Symbols Training" })).toBeTruthy();
    expect(screen.getByTestId("practice-passage-metadata").textContent).toContain(
      "Training · Symbols · Symbol drills · 60s"
    );
    expect(screen.getByLabelText("Typing input")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Choose in Passages" })).toBeNull();
  });

  it("generates symbol group drills", () => {
    render(<TrainingSymbolsPage />);

    const drillText = screen.getByTestId("typing-character-layer").textContent ?? "";

    expect(drillText).toMatch(/\(\)|\[\]|\{\}|<>/);
    expect(drillText).toMatch(/""|''|``/);
    expect(drillText).toMatch(/[.,;:]/);
    expect(drillText).toMatch(/\+=|-=|\*=|\/=|==|!=|>=|<=|[+\-*/=]/);
    expect(drillText).toMatch(/[!@#$%^&*]/);
  });

  it("saves completed symbols results with a safe symbols category", async () => {
    authState.user = { id: "user-1" };
    render(<TrainingSymbolsPage />);

    const targetText = screen.getByTestId("typing-character-layer").textContent ?? "";

    fireEvent.keyDown(window, { key: "Tab" });
    typeIncrementally(screen.getByLabelText("Typing input"), targetText.slice(0, 12));
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(mockedSaveSupabaseTypingResult).toHaveBeenCalled();
    });

    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].passage.category).toBe("training_symbols");
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].result.category).toBe("training_symbols");
    expect(mockedSaveSupabaseTypingResult.mock.calls[0][0].supabasePassageId).toBe("training-symbols");
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
