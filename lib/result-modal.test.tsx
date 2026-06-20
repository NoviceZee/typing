/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
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
        attemptTimeline={makeTimeline()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("History")).toBeNull();
    expect(screen.queryByText("Avg (last 10)")).toBeNull();
    expect(screen.getByTestId("result-sign-in-cta").textContent).toContain("Sign in to save your result");
  });

  it("shows the authenticated result layout without duplicated summary sections", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: "passage-1",
          passageTitle: "The Importance of Time Management",
          wpm: 35.8,
          rawWpm: 36.2,
          accuracy: 98.9,
          errors: 1,
          correctCharacters: 179,
          typedCharacters: 181,
          elapsedSeconds: 60,
          completedAt: "2026-06-18T00:00:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[
          makeRecentResult("older", 41, "2026-06-19T00:00:00.000Z"),
          makeRecentResult("newer", 46, "2026-06-19T00:01:00.000Z")
        ]}
        attemptTimeline={makeTimeline()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("This Result")).toBeTruthy();
    expect(screen.getByText("WPM Over Time")).toBeTruthy();
    expect(screen.getByText("Time (seconds)")).toBeTruthy();
    expect(screen.getAllByText("WPM").length).toBeGreaterThan(0);
    expect(screen.getByText("History")).toBeTruthy();
    expect(screen.getByText("Avg (last 10)")).toBeTruthy();
    expect(screen.getByText("Best (last 10)")).toBeTruthy();
    expect(screen.getByText("Attempts")).toBeTruthy();
    expect(screen.getByText("Previous Attempt")).toBeTruthy();
    expect(screen.getAllByText("Net WPM").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Session review")).toBeNull();
    expect(screen.queryByText("Highest")).toBeNull();
    expect(screen.queryByText("Lowest")).toBeNull();
    expect(screen.queryByTestId("result-sign-in-cta")).toBeNull();
  });

  it("shows the attempt graph tooltip with time, WPM, and accuracy", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        onClose={vi.fn()}
      />
    );

    fireEvent.mouseEnter(screen.getByTestId("attempt-graph-point-10"));

    expect(screen.getByText("10s")).toBeTruthy();
    expect(screen.getByText("WPM 48.0")).toBeTruthy();
    expect(screen.getByText("Accuracy 100.0%")).toBeTruthy();
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
    rawWpm: 50,
    timeUsedSeconds: 60,
    durationSeconds: 60,
    category: "Uncategorised",
    presetName: "General",
    completionReason: "time_up",
    completedAt: "2026-06-19T00:02:00.000Z",
    isRankable: true
  };
}

function makeTimeline() {
  return [
    { timeSeconds: 1, wpm: 30, accuracy: 96 },
    { timeSeconds: 5, wpm: 42, accuracy: 98 },
    { timeSeconds: 10, wpm: 48, accuracy: 100 }
  ];
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
