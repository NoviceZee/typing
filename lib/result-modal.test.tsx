/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ResultModal,
  addAttemptTimelinePoint,
  getAttemptGraphLayout,
  getInterpolatedPreviousPaceIndex,
  getPreviousPaceIndex,
  getResultConsistency
} from "../pages/practice";
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
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("History")).toBeNull();
    expect(screen.queryByText("Avg (last 10)")).toBeNull();
    expect(screen.getByTestId("result-sign-in-cta").textContent).toContain(
      "Sign in to save your result and see long-term progress."
    );
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
        modeLabel="1m"
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
    expect(screen.getByText("previous 36.2")).toBeTruthy();
    expect(screen.queryByText("36.2 → 48.0")).toBeNull();
    expect(screen.queryByText("36.2 → 50.0")).toBeNull();
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
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    fireEvent.mouseEnter(screen.getByTestId("attempt-graph-point-10"));

    expect(screen.getByText("10s")).toBeTruthy();
    expect(screen.getByText("WPM 48.0")).toBeTruthy();
    expect(screen.getByText("Accuracy 100.0%")).toBeTruthy();
  });

  it("keeps early WPM spikes from dominating graph scaling", () => {
    const layout = getAttemptGraphLayout(
      [
        { timeSeconds: 1, wpm: 120, accuracy: 100 },
        { timeSeconds: 5, wpm: 44, accuracy: 98 },
        { timeSeconds: 20, wpm: 47, accuracy: 99 },
        { timeSeconds: 60, wpm: 48, accuracy: 100 }
      ],
      makeResult()
    );

    expect(layout.maxWpm).toBeLessThan(90);
  });

  it("keeps 5-minute WPM graph samples on elapsed seconds from 0 to 300", () => {
    const result = { ...makeResult(), timeUsedSeconds: 300, durationSeconds: 300 };
    const timeline = Array.from({ length: 301 }, (_, timeSeconds) => ({
      timeSeconds,
      wpm: timeSeconds === 0 ? 0 : 48,
      accuracy: 100
    })).reduce(addAttemptTimelinePoint, [] as Array<{ timeSeconds: number; wpm: number; accuracy?: number }>);
    const layout = getAttemptGraphLayout(timeline, result);

    expect(layout.maxTime).toBe(300);
    expect(layout.xTicks).toContain(0);
    expect(layout.xTicks).toContain(300);
    expect(layout.positionedPoints[0].timeSeconds).toBe(0);
    expect(layout.positionedPoints[layout.positionedPoints.length - 1].timeSeconds).toBe(300);
    expect(layout.positionedPoints[0].x).toBeLessThan(layout.positionedPoints[layout.positionedPoints.length - 1].x);
  });

  it("interpolates the previous pace marker index from saved timeline progress", () => {
    expect(
      getPreviousPaceIndex(
        [
          { timeSeconds: 5, characterIndex: 20, wpm: 48 },
          { timeSeconds: 15, characterIndex: 60, wpm: 48 }
        ],
        10
      )
    ).toBe(40);
  });

  it("keeps fractional previous pace progress for smooth marker animation", () => {
    expect(
      getInterpolatedPreviousPaceIndex(
        [
          { timeSeconds: 5, characterIndex: 20, wpm: 48 },
          { timeSeconds: 15, characterIndex: 61, wpm: 48 }
        ],
        10
      )
    ).toBe(40.5);
  });

  it("adds a final time-up point at the duration instead of using remaining seconds", () => {
    const result = { ...makeResult(), timeUsedSeconds: 300, durationSeconds: 300, wpm: 52, accuracy: 99 };
    const timeline = [
      { timeSeconds: 296, wpm: 51, accuracy: 99 },
      { timeSeconds: 297, wpm: 51, accuracy: 99 }
    ].reduce(addAttemptTimelinePoint, [] as Array<{ timeSeconds: number; wpm: number; accuracy?: number }>);
    const completedTimeline = addAttemptTimelinePoint(timeline, {
      timeSeconds: result.timeUsedSeconds,
      wpm: result.wpm,
      accuracy: result.accuracy
    });
    const layout = getAttemptGraphLayout(completedTimeline, result);

    expect(completedTimeline.at(-1)?.timeSeconds).toBe(300);
    expect(completedTimeline.some((point) => point.timeSeconds === 0 && point.wpm === result.wpm)).toBe(false);
    expect(layout.maxTime).toBe(300);
  });

  it("anchors elapsed-time charts at zero even when the first recorded sample is after start", () => {
    const result = { ...makeResult(), timeUsedSeconds: 300, durationSeconds: 300 };
    const layout = getAttemptGraphLayout(
      [
        { timeSeconds: 1, wpm: 30, accuracy: 95 },
        { timeSeconds: 120, wpm: 48, accuracy: 98 },
        { timeSeconds: 300, wpm: 52, accuracy: 99 }
      ],
      result
    );

    expect(layout.positionedPoints[0].timeSeconds).toBe(0);
    expect(layout.positionedPoints[0].x).toBe(layout.left);
  });

  it("renders the image-card action row and calls the generator", () => {
    const generateImageCard = vi.fn(() => new Promise<void>(() => {}));

    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        onGenerateImageCard={generateImageCard}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Generate image card")).toBeTruthy();
    expect(screen.getByText("Create a shareable result image.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /generate image card/i }));

    expect(generateImageCard).toHaveBeenCalledWith({
      result: makeResult(),
      passage: makePassage(),
      modeLabel: "1m"
    });
  });

  it("shows a suspicious-result note and keeps it out of saved history", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[makeRecentResult("saved", 41, "2026-06-19T00:00:00.000Z")]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        isSuspicious
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("This result was not saved because suspicious input was detected.")).toBeTruthy();
    const historySection = screen.getByText("History").closest("section");

    expect(historySection).toBeTruthy();
    expect(within(historySection as HTMLElement).getByText("Attempts")).toBeTruthy();
    expect(within(historySection as HTMLElement).getByText("1")).toBeTruthy();
  });

  it("calculates consistency from coefficient of variation", () => {
    expect(
      getResultConsistency([
        { timeSeconds: 5, wpm: 50 },
        { timeSeconds: 20, wpm: 50 },
        { timeSeconds: 40, wpm: 50 }
      ])
    ).toBe(100);

    const smallVariation = getResultConsistency([
      { timeSeconds: 5, wpm: 48 },
      { timeSeconds: 20, wpm: 50 },
      { timeSeconds: 40, wpm: 52 },
      { timeSeconds: 60, wpm: 50 }
    ]);
    const largerVariation = getResultConsistency([
      { timeSeconds: 5, wpm: 30 },
      { timeSeconds: 20, wpm: 50 },
      { timeSeconds: 40, wpm: 70 }
    ]);

    expect(smallVariation).toBe(93.7);
    expect(largerVariation).toBe(47.2);
  });

  it("returns unavailable consistency with fewer than three usable timeline points", () => {
    expect(
      getResultConsistency([
        { timeSeconds: 5, wpm: 48 },
        { timeSeconds: 20, wpm: 50 }
      ])
    ).toBeNull();
  });

  it("ignores early WPM points when enough later points exist", () => {
    expect(
      getResultConsistency([
        { timeSeconds: 1, wpm: 200 },
        { timeSeconds: 5, wpm: 50 },
        { timeSeconds: 20, wpm: 50 },
        { timeSeconds: 40, wpm: 50 }
      ])
    ).toBe(100);
  });

  it("explains consistency as WPM coefficient of variation", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByLabelText(
        "Consistency shows how steady your WPM stayed during the test. It is based on the coefficient of variation of your WPM timeline."
      )
    ).toBeTruthy();
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
