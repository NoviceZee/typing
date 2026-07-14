/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ResultModal,
  addAttemptTimelinePoint,
  buildSmoothPath,
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
  it("exposes dialog semantics, focuses the inert dialog surface, and supports Escape", () => {
    const onClose = vi.fn();
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
        onClose={onClose}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Time up" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: /Time up/i }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows distinct burst pace and error markers directly on the graph", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline().map((point, index) => ({
          ...point,
          burstWpm: point.wpm + 14,
          errorCount: index > 0 ? 1 : 0
        }))}
        errorEvents={[{ timeSeconds: 5, characterIndex: 3 }]}
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Errors encountered")).toBeTruthy();
    expect(screen.queryByText("Corrected errors")).toBeNull();
    const chart = screen.getByRole("img", { name: "WPM over time" });
    expect(chart.querySelector('[data-testid="attempt-chart-burst-line"]')?.getAttribute("stroke-dasharray")).toBe("2 6");
    const errorMarker = chart.querySelector('[data-testid="attempt-error-marker"]');
    expect(errorMarker).toBeTruthy();
    expect(errorMarker?.querySelector("line")?.getAttribute("stroke")).toBe("rgb(var(--chart-danger))");
    expect(Number(errorMarker?.querySelector("line")?.getAttribute("y1"))).toBeGreaterThan(20);
  });

  it("builds a smooth cubic path between timeline points", () => {
    expect(buildSmoothPath([{ x: 0, y: 10 }, { x: 20, y: 30 }, { x: 40, y: 20 }])).toContain(" C ");
  });

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

  it("announces a failed cloud save without hiding the local result", () => {
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
        cloudSaveState="failed"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Cloud save failed. Your current result is still visible here."
    );
    expect(screen.getByText("This Result")).toBeTruthy();
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
    expect(screen.getByText("Session review")).toBeTruthy();
    expect(screen.queryByText("Highest")).toBeNull();
    expect(screen.queryByText("Lowest")).toBeNull();
    expect(screen.queryByTestId("result-sign-in-cta")).toBeNull();

    const chart = screen.getByRole("img", { name: "WPM over time" });
    expect(chart.querySelector('[data-testid="attempt-chart-line"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-line))"
    );
    expect(chart.querySelector('[data-testid="attempt-chart-average-line"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-line-secondary))"
    );
    expect(chart.querySelector('[data-testid="attempt-chart-axis-x"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-axis))"
    );
    expect(chart.querySelector('[data-testid="attempt-chart-grid"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-grid))"
    );
  });

  it("displays readable Training labels instead of internal category slugs", () => {
    render(
      <ResultModal
        result={{ ...makeResult(), category: "training_code" }}
        passage={{
          ...makePassage(),
          id: "training-code",
          title: "Training Code",
          category: "training_code",
          style: "60s"
        }}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="60s"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Training · Code · 60s")).toBeTruthy();
    expect(screen.queryByText(/training_code/)).toBeNull();
  });

  it("displays Chinese Training word-count labels without internal slugs", () => {
    render(
      <ResultModal
        result={{ ...makeResult(), category: "training_chinese" }}
        passage={{
          ...makePassage(),
          id: "training-chinese",
          title: "Training Chinese",
          category: "training_chinese",
          style: "10 words"
        }}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="10 words"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Training · Chinese · 10 words")).toBeTruthy();
    expect(screen.queryByText(/training_chinese|characters/)).toBeNull();
  });

  it("labels Chinese Training speed as WPM while keeping character-based values", () => {
    render(
      <ResultModal
        result={{ ...makeResult(), category: "training_chinese", wpm: 50, rawWpm: 50 }}
        passage={{
          ...makePassage(),
          id: "training-chinese",
          title: "Training Chinese",
          category: "training_chinese",
          style: "60s"
        }}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="60s"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("WPM Over Time")).toBeTruthy();
    expect(screen.getAllByText("WPM").length).toBeGreaterThan(0);
    expect(screen.queryByText("CPM")).toBeNull();
  });

  it("counts the current result as the first comparable history attempt", () => {
    render(
      <ResultModal
        result={{ ...makeResult(), wpm: 28.2 }}
        passage={{ ...makePassage(), id: "training-code", title: "Training Code", category: "training_code", style: "60s" }}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="60s"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Avg (last 10)")).toBeTruthy();
    expect(screen.getByText("Best (last 10)")).toBeTruthy();
    expect(screen.getByText("Attempts")).toBeTruthy();
    expect(screen.getAllByText("28.2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.queryByText("Previous Attempt")).toBeNull();
  });

  it("includes the immediately previous comparable attempt in history when recent rows omit it", () => {
    render(
      <ResultModal
        result={{ ...makeResult(), wpm: 28.2, rawWpm: 30, category: "training_code" }}
        passage={{ ...makePassage(), id: "training-code", title: "Training Code", category: "training_code", style: "60s" }}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: "training-code",
          passageTitle: "Training Code",
          wpm: 20.2,
          rawWpm: 22,
          accuracy: 96,
          errors: 2,
          correctCharacters: 101,
          typedCharacters: 106,
          elapsedSeconds: 60,
          durationSeconds: 60,
          completedAt: "2026-06-19T00:01:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="60s"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("24.2")).toBeTruthy();
    expect(screen.getAllByText("28.2").length).toBeGreaterThan(0);
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("Previous Attempt")).toBeTruthy();
    expect(screen.getByText("previous 20.2")).toBeTruthy();
  });

  it("shows a personal-best celebration when net WPM improves over the previous result", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: "passage-1",
          passageTitle: "The Importance of Time Management",
          wpm: 42.4,
          rawWpm: 43,
          accuracy: 98.9,
          errors: 1,
          correctCharacters: 212,
          typedCharacters: 214,
          elapsedSeconds: 60,
          completedAt: "2026-06-18T00:00:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("New Personal Best")).toBeTruthy();
    expect(screen.getByText("42.4 -> 48.0 WPM")).toBeTruthy();
  });

  it("keeps the personal-best celebration readable before auto-dismissing", () => {
    vi.useFakeTimers();

    try {
      render(
        <ResultModal
          result={makeResult()}
          passage={makePassage()}
          onRestart={vi.fn()}
          onNextPassage={vi.fn()}
          previousResult={{
            passageId: "passage-1",
            passageTitle: "The Importance of Time Management",
            wpm: 42.4,
            rawWpm: 43,
            accuracy: 98.9,
            errors: 1,
            correctCharacters: 212,
            typedCharacters: 214,
            elapsedSeconds: 60,
            completedAt: "2026-06-18T00:00:00.000Z",
            completionReason: "time_up"
          }}
          recentResults={[]}
          attemptTimeline={makeTimeline()}
          modeLabel="1m"
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText("New Personal Best")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(4000);
      });

      expect(screen.getByText("New Personal Best")).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.queryByText("New Personal Best")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a level-up celebration when level-up data is available", () => {
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
        progressMilestones={[
          {
            id: "level-up",
            title: "Level Up",
            value: "Level 4 -> Level 5",
            subtitle: "Formal Specialist",
            effect: "ribbons"
          }
        ]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Level Up")).toBeTruthy();
    expect(screen.getByText("Level 4 -> Level 5")).toBeTruthy();
    expect(screen.getByText("Formal Specialist")).toBeTruthy();
  });

  it("shows an achievement-unlocked celebration when unlock data is available", () => {
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
        progressMilestones={[
          {
            id: "achievement-speed-50",
            title: "Achievement Unlocked",
            value: "Speed 50",
            subtitle: "Reach 50 WPM in a saved result.",
            effect: "quiet"
          }
        ]}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Achievement Unlocked")).toBeTruthy();
    expect(screen.getByText("Speed 50")).toBeTruthy();
    expect(screen.getByText("Reach 50 WPM in a saved result.")).toBeTruthy();
  });

  it("queues multiple celebrations instead of rendering them all at once", () => {
    vi.useFakeTimers();

    try {
      render(
        <ResultModal
          result={makeResult()}
          passage={makePassage()}
          onRestart={vi.fn()}
          onNextPassage={vi.fn()}
          previousResult={{
            passageId: "passage-1",
            passageTitle: "The Importance of Time Management",
            wpm: 42.4,
            rawWpm: 43,
            accuracy: 98.9,
            errors: 1,
            correctCharacters: 212,
            typedCharacters: 214,
            elapsedSeconds: 60,
            completedAt: "2026-06-18T00:00:00.000Z",
            completionReason: "time_up"
          }}
          recentResults={[]}
          attemptTimeline={makeTimeline()}
          modeLabel="1m"
          progressMilestones={[
            {
              id: "level-up",
              title: "Level Up",
              value: "Level 4 -> Level 5",
              effect: "ribbons"
            },
            {
              id: "achievement-speed-50",
              title: "Achievement Unlocked",
              value: "Speed 50",
              subtitle: "Reach 50 WPM in a saved result.",
              effect: "quiet"
            }
          ]}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByText("New Personal Best")).toBeTruthy();
      expect(screen.queryByText("Level Up")).toBeNull();
      expect(screen.queryByText("Achievement Unlocked")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(5100);
      });

      expect(screen.queryByText("New Personal Best")).toBeNull();
      expect(screen.getByText("Level Up")).toBeTruthy();
      expect(screen.queryByText("Achievement Unlocked")).toBeNull();

      act(() => {
        vi.advanceTimersByTime(5100);
      });

      expect(screen.queryByText("Level Up")).toBeNull();
      expect(screen.getByText("Achievement Unlocked")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows a best-accuracy celebration when accuracy improves over the previous result", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: "passage-1",
          passageTitle: "The Importance of Time Management",
          wpm: 48,
          rawWpm: 50,
          accuracy: 98.9,
          errors: 1,
          correctCharacters: 238,
          typedCharacters: 240,
          elapsedSeconds: 60,
          completedAt: "2026-06-18T00:00:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("New Best Accuracy")).toBeTruthy();
    expect(screen.getByText("98.90% -> 100.00% accuracy")).toBeTruthy();
  });

  it("does not show a personal-best celebration for an ordinary result", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: "passage-1",
          passageTitle: "The Importance of Time Management",
          wpm: 48,
          rawWpm: 50,
          accuracy: 100,
          errors: 0,
          correctCharacters: 240,
          typedCharacters: 240,
          elapsedSeconds: 60,
          completedAt: "2026-06-18T00:00:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByText("New Personal Best")).toBeNull();
  });

  it("shows WPM, burst, and per-second errors in the graph tooltip", () => {
    render(
      <ResultModal
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={[
          { timeSeconds: 1, wpm: 30, burstWpm: 40, accuracy: 96 },
          { timeSeconds: 5, wpm: 42, burstWpm: 51, accuracy: 98 },
          { timeSeconds: 10, wpm: 48, burstWpm: 56, accuracy: 100 }
        ]}
        errorEvents={[
          { timeSeconds: 9.2, characterIndex: 3 },
          { timeSeconds: 9.8, characterIndex: 7 }
        ]}
        modeLabel="1m"
        onClose={vi.fn()}
      />
    );

    fireEvent.mouseEnter(screen.getByTestId("attempt-graph-point-10"));

    expect(screen.getByText("10s")).toBeTruthy();
    expect(screen.queryByText("Raw WPM 50.0")).toBeNull();
    expect(screen.getByText("WPM 48.0")).toBeTruthy();
    expect(screen.getByText("Burst 56.0")).toBeTruthy();
    expect(screen.getByText("Errors 2")).toBeTruthy();
    expect(screen.queryByText("Accuracy 100.0%")).toBeNull();
    const markers = screen.getAllByTestId("attempt-error-marker");
    expect(markers).toHaveLength(1);
    expect(markers[0].getAttribute("data-error-count")).toBe("2");
    expect(screen.getByTestId("attempt-chart-axis-errors")).toBeTruthy();
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
    expect(layout.xTicks).toHaveLength(21);
    expect(layout.yTicks.every((tick) => tick % 15 === 0)).toBe(true);
    expect(layout.positionedPoints[0].timeSeconds).toBe(0);
    expect(layout.positionedPoints[layout.positionedPoints.length - 1].timeSeconds).toBe(300);
    expect(layout.positionedPoints[0].x).toBeLessThan(layout.positionedPoints[layout.positionedPoints.length - 1].x);
  });

  it("uses 15 time divisions for seconds and 20 for minute-based attempts", () => {
    const layoutFor = (seconds: number) =>
      getAttemptGraphLayout([], { ...makeResult(), timeUsedSeconds: seconds, durationSeconds: seconds });

    expect(layoutFor(15).xTicks).toHaveLength(16);
    expect(layoutFor(15).xTicks[1]).toBe(1);
    expect(layoutFor(30).xTicks).toHaveLength(16);
    expect(layoutFor(30).xTicks[1]).toBe(2);
    expect(layoutFor(60).xTicks).toHaveLength(21);
    expect(layoutFor(60).xTicks[1]).toBe(3);
    expect(layoutFor(300).xTicks).toHaveLength(21);
    expect(layoutFor(300).xTicks[1]).toBe(15);
  });

  it("uses actual Training time instead of the normalized comparison duration", () => {
    const layout = getAttemptGraphLayout([], {
      ...makeResult(),
      timeUsedSeconds: 15,
      durationSeconds: 60,
      category: "training_words"
    });

    expect(layout.maxTime).toBe(15);
    expect(layout.xTicks).toHaveLength(16);
    expect(layout.xTicks[1]).toBe(1);
    expect(layout.xTicks.at(-1)).toBe(15);
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
