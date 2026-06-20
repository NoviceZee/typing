/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ResultModal } from "../pages/practice";
import type { StoredPassage } from "@/lib/app-storage";
import type { TypingResult } from "@/lib/typing-engine";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

describe("ResultModal", () => {
  it("hides saved-result history for logged-out users and shows the sign-in CTA at the bottom", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={null}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("History")).toBeNull();
    expect(screen.queryByText("Consistency")).toBeNull();
    expect(screen.getByTestId("result-sign-in-cta").textContent).toContain("Sign in to save your result");
  });

  it("shows saved-result history for authenticated users and hides the sign-in CTA", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[
          makeRecentResult("older", 41, "2026-06-19T00:00:00.000Z"),
          makeRecentResult("newer", 46, "2026-06-19T00:01:00.000Z")
        ]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.queryByTestId("result-sign-in-cta")).toBeNull();
  });
});

function makeResult(): TypingResult {
  return {
    characters: [],
    characterStatuses: [],
    correctCharacters: 240,
    incorrectCharacters: 0,
    missedCharacters: 0,
    extraCharacters: 0,
    totalCharacters: 240,
    comparableTargetLength: 240,
    comparableTypedLength: 240,
    accuracy: 100,
    wpm: 48,
    rawWpm: 48,
    timeUsedSeconds: 60,
    durationSeconds: 60,
    category: "Uncategorised",
    presetName: "General",
    completionReason: "time_up",
    completedAt: "2026-06-19T00:02:00.000Z",
    isRankable: true
  };
}

function makePassage(): StoredPassage {
  return {
    id: "passage-1",
    title: "The Importance of Time Management",
    category: "Uncategorised",
    style: "General",
    source: "uploaded",
    text: "Time management keeps formal work moving clearly.",
    updatedAt: "2026-06-19T00:00:00.000Z"
  };
}

function makeRecentResult(id: string, wpm: number, created_at: string) {
  return {
    id,
    passage_title: "The Importance of Time Management",
    duration_seconds: 60,
    wpm,
    accuracy: 99,
    created_at
  };
}
