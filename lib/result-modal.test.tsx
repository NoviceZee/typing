/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ResultDashboard,
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

describe("ResultDashboard", () => {
  it("renders page semantics without a dialog, focus trap, or body scroll lock", () => {
    render(
      <ResultDashboard
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
      />
    );

    expect(screen.getByRole("heading", { level: 1, name: "Result" })).toBeTruthy();
    expect(screen.getByText("Time up")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("heading", { level: 1, name: "Result" })).toBeTruthy();
  });

  it("omits empty mistake review while preserving encountered errors and the final count", () => {
    render(<ResultDashboard result={makeResult()} passage={makePassage()} onRestart={vi.fn()}
      onNextPassage={vi.fn()} previousResult={null} recentResults={[]} attemptTimeline={makeTimeline()}
      errorEvents={[{ timeSeconds: 5, characterIndex: 3 }]} modeLabel="1m" />);

    expect(screen.queryByText("Review mistakes")).toBeNull();
    expect(screen.queryByText("0 final")).toBeNull();
    expect(screen.getByLabelText("Errors encountered").parentElement?.textContent).toContain("1");
    expect(screen.getByLabelText("Final mistakes remaining").parentElement?.textContent).toContain("0");
  });

  it.each([48, 50])("keeps Net WPM secondary and explicit when it is %s", (wpm) => {
    render(<ResultDashboard result={{ ...makeResult(), wpm }} passage={makePassage()} onRestart={vi.fn()}
      onNextPassage={vi.fn()} previousResult={null} recentResults={[]} attemptTimeline={makeTimeline()}
      modeLabel="1m" />);

    const summary = screen.getByRole("region", { name: "Result summary" });
    const netWpmMetric = within(summary).getByText("Net WPM").closest('[data-metric-priority="secondary"]');
    expect(netWpmMetric).toBeTruthy();
    expect(netWpmMetric?.textContent).toContain(wpm.toFixed(1));
    expect(within(summary).getAllByText("50.0").length).toBeGreaterThan(0);
  });

  it("keeps nonzero mistake review keyboard reachable without trapping page focus", () => {
    render(<ResultDashboard result={{ ...makeResult(), incorrectCharacters: 2 }} passage={makePassage()}
      onRestart={vi.fn()} onNextPassage={vi.fn()} previousResult={null} recentResults={[]}
      attemptTimeline={makeTimeline()} modeLabel="1m" />);

    const review = screen.getByRole("button", { name: "Review mistakes" });
    expect(review.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Session review")).toBeNull();
    fireEvent.click(review);
    expect(review.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Session review")).toBeTruthy();
    review.focus();
    expect(document.activeElement).toBe(review);
  });

  it("shows distinct burst pace and error markers directly on the graph", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByLabelText("Errors encountered").parentElement?.textContent).toContain("1");
    expect(screen.getByLabelText("Final mistakes remaining").parentElement?.textContent).toContain("0");
    expect(screen.queryByText("Corrected errors")).toBeNull();
    const chart = screen.getByRole("img", { name: "WPM over time" });
    expect(chart.querySelector('[data-testid="attempt-chart-burst-line"]')?.getAttribute("stroke-dasharray")).toBe("2 6");
    const errorMarker = chart.querySelector('[data-testid="attempt-error-marker"]');
    expect(errorMarker).toBeTruthy();
    const markerLine = errorMarker?.querySelector("line");
    expect(markerLine?.getAttribute("stroke")).toBe("rgb(var(--chart-danger))");
    expect(markerLine?.getAttribute("stroke-width")).toBe("1.75");
    expect(Number(markerLine?.getAttribute("x2")) - Number(markerLine?.getAttribute("x1"))).toBe(5.5);
    expect(Number(markerLine?.getAttribute("y1"))).toBeGreaterThan(20);
  });

  it("builds a smooth cubic path between timeline points", () => {
    expect(buildSmoothPath([{ x: 0, y: 10 }, { x: 20, y: 30 }, { x: 40, y: 20 }])).toContain(" C ");
  });

  it("hides saved-result history for logged-out users and shows the sign-in CTA at the bottom", () => {
    render(
      <ResultDashboard
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={null}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
      />
    );

    expect(screen.queryByText("Last 10")).toBeNull();
    expect(screen.queryByText("Avg")).toBeNull();
    expect(screen.getByTestId("result-sign-in-cta").textContent).toContain(
      "Sign in to save your result and see long-term progress."
    );
  });

  it("announces a failed cloud save without hiding the local result", () => {
    render(
      <ResultDashboard
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        cloudSaveState="failed"
      />
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Cloud save failed. Your current result is still visible here."
    );
    expect(screen.getByRole("region", { name: "Result summary" })).toBeTruthy();
    expect(screen.getByTestId("primary-result-summary").querySelector('[data-metric-priority="hero"]')?.textContent).toContain("50.0");
    const resultSummary = screen.getByRole("region", { name: "Result summary" });
    expect(within(resultSummary).getByText("Accuracy")).toBeTruthy();
    expect(within(resultSummary).getByText("Consistency")).toBeTruthy();
    expect(within(resultSummary).getByText("Duration")).toBeTruthy();
  });

  it("shows the authenticated result layout without duplicated summary sections", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByRole("region", { name: "Result summary" })).toBeTruthy();
    expect(screen.getByText("WPM Over Time")).toBeTruthy();
    expect(screen.getByText("Time (seconds)")).toBeTruthy();
    expect(screen.getAllByText("WPM").length).toBeGreaterThan(0);
    expect(screen.getByText("Last 10")).toBeTruthy();
    expect(screen.getByText("Avg")).toBeTruthy();
    expect(screen.getByText("Best")).toBeTruthy();
    expect(screen.queryByText("Attempts")).toBeNull();
    expect(screen.getByText("Previous Attempt")).toBeTruthy();
    expect(screen.getAllByText(/Net WPM/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("36.2 → 50.0")).toBeTruthy();
    expect(screen.queryByText("36.2 → 48.0")).toBeNull();
    expect(screen.getByText("98.9% → 100%")).toBeTruthy();
    expect(screen.getByText("Session content or settings may differ")).toBeTruthy();
    expect(screen.queryByText("Session review")).toBeNull();
    expect(screen.queryByText("Review mistakes")).toBeNull();
    expect(screen.queryByText("Highest")).toBeNull();
    expect(screen.queryByText("Lowest")).toBeNull();
    expect(screen.queryByTestId("result-sign-in-cta")).toBeNull();
    expect(screen.getByRole("group", { name: "Result actions" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next passage" }).getAttribute("data-touch-target")).toBe("44");
    expect(screen.getByRole("button", { name: "Generate image card" }).querySelector(".lucide-image")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restart same passage" }).querySelector(".lucide-rotate-ccw")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next passage" }).querySelector(".lucide-arrow-right")).toBeTruthy();
    const actions = within(screen.getByRole("group", { name: "Result actions" })).getAllByRole("button");
    expect(actions).toHaveLength(3);
    expect(actions.every((action) => action.className.includes("w-full justify-start"))).toBe(true);
    expect(actions.every((action) => action.querySelector("svg")?.classList.contains("icon-control"))).toBe(true);

    const chart = screen.getByRole("img", { name: "WPM over time" });
    expect(chart.querySelector('[data-testid="attempt-chart-line"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-line))"
    );
    expect(chart.querySelector('[data-testid="attempt-chart-average-line"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-line-secondary))"
    );
    expect(chart.querySelector('[data-testid="attempt-chart-line"]')?.getAttribute("stroke-width")).toBe("2");
    expect(chart.querySelector('[data-testid="attempt-chart-burst-line"]')?.getAttribute("stroke-width")).toBe("2");
    expect(chart.querySelector('[data-testid="attempt-chart-average-line"]')?.getAttribute("stroke-width")).toBe("2");
    expect(chart.querySelector('[data-testid="attempt-chart-point-marker"]')?.getAttribute("r")).toBe("2.25");
    expect(chart.querySelector('[data-testid="attempt-chart-axis-title-wpm"]')?.getAttribute("transform")).toContain("rotate(-90");
    expect(chart.querySelector('[data-testid="attempt-chart-axis-title-errors"]')?.getAttribute("transform")).toContain("rotate(90");
    expect(chart.querySelector('[data-testid="attempt-chart-axis-title-time"]')?.getAttribute("class")).toContain("text-[9px]");
    expect(chart.querySelector('[data-testid="attempt-chart-wpm-tick"]')?.getAttribute("class")).toContain("text-[10px]");
    expect(Array.from(chart.querySelectorAll('[data-testid="attempt-chart-time-tick"]')).every((tick) => /^\d+$/.test(tick.textContent ?? ""))).toBe(true);
    expect(chart.querySelector('[data-testid="attempt-chart-axis-x"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-axis))"
    );
    expect(chart.querySelector('[data-testid="attempt-chart-grid"]')?.getAttribute("stroke")).toBe(
      "rgb(var(--chart-grid))"
    );
  });

  it("labels a previous attempt as directly comparable only when target and mode match", () => {
    const passage = makePassage();
    render(
      <ResultDashboard
        result={makeResult()}
        passage={passage}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: passage.id ?? "passage-1",
          passageTitle: passage.title ?? "Untitled passage",
          wpm: 47,
          rawWpm: 49,
          accuracy: 99,
          errors: 1,
          correctCharacters: 235,
          typedCharacters: 238,
          elapsedSeconds: 60,
          modeDurationSeconds: 60,
          targetSnapshot: passage.text,
          completedAt: "2026-06-18T00:00:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
      />
    );

    expect(screen.getByText("Same passage and mode")).toBeTruthy();
    expect(screen.queryByText("Session content or settings may differ")).toBeNull();
  });

  it("displays readable Training labels instead of internal category slugs", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("Training · Code · 60s")).toBeTruthy();
    expect(screen.queryByText(/training_code/)).toBeNull();
  });

  it("displays Chinese Training word-count labels without internal slugs", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("Training · Chinese · 10 words")).toBeTruthy();
    expect(screen.queryByText(/training_chinese|characters/)).toBeNull();
  });

  it("labels Chinese Training speed as WPM while keeping character-based values", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("WPM Over Time")).toBeTruthy();
    expect(screen.getAllByText("WPM").length).toBeGreaterThan(0);
    expect(screen.queryByText("CPM")).toBeNull();
  });

  it("counts the current result as the first comparable history attempt", () => {
    render(
      <ResultDashboard
        result={{ ...makeResult(), wpm: 28.2 }}
        passage={{ ...makePassage(), id: "training-code", title: "Training Code", category: "training_code", style: "60s" }}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="60s"
      />
    );

    expect(screen.getByText("Avg")).toBeTruthy();
    expect(screen.getByText("Best")).toBeTruthy();
    expect(screen.queryByText("Attempts")).toBeNull();
    expect(screen.getAllByText("28.2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Previous Attempt")).toBeNull();
  });

  it("includes the immediately previous comparable attempt in history when recent rows omit it", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("24.2")).toBeTruthy();
    expect(screen.getAllByText("28.2").length).toBeGreaterThan(0);
    expect(screen.queryByText("Attempts")).toBeNull();
    expect(screen.getByText("Previous Attempt")).toBeTruthy();
    expect(screen.getByText("22.0 → 30.0")).toBeTruthy();
  });

  it("shows a personal-best celebration when net WPM improves over the previous result", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("New Personal Best")).toBeTruthy();
    expect(screen.getByText("42.4 -> 48.0 WPM")).toBeTruthy();
  });

  it("keeps an Escape/manual result display-only without PB, accuracy, or supplied progression unlocks", () => {
    render(
      <ResultDashboard
        result={{ ...makeResult(), completionReason: "manual", wpm: 200, rawWpm: 250, accuracy: 100, isRankable: false }}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={{
          passageId: "passage-1",
          passageTitle: "Previous",
          wpm: 35,
          rawWpm: 36,
          accuracy: 95,
          errors: 2,
          correctCharacters: 175,
          typedCharacters: 180,
          elapsedSeconds: 60,
          completedAt: "2026-06-18T00:00:00.000Z",
          completionReason: "time_up"
        }}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        progressMilestones={[{ id: "achievement", title: "Achievement Unlocked", value: "Speed 50", effect: "quiet" }]}
      />
    );

    expect(screen.getByText("Manual result")).toBeTruthy();
    expect(screen.getByText("Not saved.")).toBeTruthy();
    expect(screen.queryByText("New Personal Best")).toBeNull();
    expect(screen.queryByText("New Best Accuracy")).toBeNull();
    expect(screen.queryByText("Achievement Unlocked")).toBeNull();
  });

  it("keeps the personal-best celebration readable before auto-dismissing", () => {
    vi.useFakeTimers();

    try {
      render(
        <ResultDashboard
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
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("Level Up")).toBeTruthy();
    expect(screen.getByText("Level 4 -> Level 5")).toBeTruthy();
    expect(screen.getByText("Formal Specialist")).toBeTruthy();
  });

  it("shows an achievement-unlocked celebration when unlock data is available", () => {
    render(
      <ResultDashboard
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
        <ResultDashboard
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
      <ResultDashboard
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
      />
    );

    expect(screen.getByText("New Best Accuracy")).toBeTruthy();
    expect(screen.getByText("98.90% -> 100.00% accuracy")).toBeTruthy();
  });

  it("does not show a personal-best celebration for an ordinary result", () => {
    render(
      <ResultDashboard
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
      />
    );

    expect(screen.queryByText("New Personal Best")).toBeNull();
  });

  it("shows WPM, burst, and per-second errors in the graph tooltip", () => {
    render(
      <ResultDashboard
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
    const result = { ...makeResult(), elapsedSeconds: 300, modeDurationSeconds: 300 };
    const timeline = Array.from({ length: 301 }, (_, timeSeconds) => ({
      timeSeconds,
      wpm: timeSeconds === 0 ? 0 : 48,
      accuracy: 100
    })).reduce(addAttemptTimelinePoint, [] as Array<{ timeSeconds: number; wpm: number; accuracy?: number }>);
    const layout = getAttemptGraphLayout(timeline, result);

    expect(layout.maxTime).toBe(300);
    expect(layout.xTicks).toContain(0);
    expect(layout.xTicks).toContain(300);
    expect(layout.xTicks.length).toBeLessThanOrEqual(11);
    expect(layout.xTicks.every(Number.isInteger)).toBe(true);
    expect(layout.yTicks.every((tick) => tick % 15 === 0)).toBe(true);
    expect(layout.positionedPoints[0].timeSeconds).toBe(0);
    expect(layout.positionedPoints[layout.positionedPoints.length - 1].timeSeconds).toBe(300);
    expect(layout.positionedPoints[0].x).toBeLessThan(layout.positionedPoints[layout.positionedPoints.length - 1].x);
  });

  it("uses readable whole-second ticks while preserving the true end point", () => {
    const layoutFor = (seconds: number) =>
      getAttemptGraphLayout([], { ...makeResult(), elapsedSeconds: seconds, modeDurationSeconds: seconds });

    for (const seconds of [15, 30, 43, 60, 300]) {
      const ticks = layoutFor(seconds).xTicks;
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks.length).toBeLessThanOrEqual(11);
      expect(ticks.at(-1)).toBe(seconds);
    }
    expect(layoutFor(43).xTicks).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 43]);
  });

  it("uses actual Training time instead of the normalized comparison duration", () => {
    const layout = getAttemptGraphLayout([], {
      ...makeResult(),
      elapsedSeconds: 15,
      modeDurationSeconds: 60,
      category: "training_words"
    });

    expect(layout.maxTime).toBe(15);
    expect(layout.xTicks.every(Number.isInteger)).toBe(true);
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
    const result = { ...makeResult(), elapsedSeconds: 300, modeDurationSeconds: 300, wpm: 52, accuracy: 99 };
    const timeline = [
      { timeSeconds: 296, wpm: 51, accuracy: 99 },
      { timeSeconds: 297, wpm: 51, accuracy: 99 }
    ].reduce(addAttemptTimelinePoint, [] as Array<{ timeSeconds: number; wpm: number; accuracy?: number }>);
    const completedTimeline = addAttemptTimelinePoint(timeline, {
      timeSeconds: result.elapsedSeconds,
      wpm: result.wpm,
      accuracy: result.accuracy
    });
    const layout = getAttemptGraphLayout(completedTimeline, result);

    expect(completedTimeline.at(-1)?.timeSeconds).toBe(300);
    expect(completedTimeline.some((point) => point.timeSeconds === 0 && point.wpm === result.wpm)).toBe(false);
    expect(layout.maxTime).toBe(300);
  });

  it("anchors elapsed-time charts at zero even when the first recorded sample is after start", () => {
    const result = { ...makeResult(), elapsedSeconds: 300, modeDurationSeconds: 300 };
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
      <ResultDashboard
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        onGenerateImageCard={generateImageCard}
      />
    );

    expect(screen.getByText("Generate image")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /generate image card/i }));

    expect(generateImageCard).toHaveBeenCalledWith({
      result: makeResult(),
      passage: makePassage(),
      modeLabel: "1m"
    });
  });

  it("shows a suspicious-result note and keeps it out of saved history", () => {
    render(
      <ResultDashboard
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[makeRecentResult("saved", 41, "2026-06-19T00:00:00.000Z")]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
        isSuspicious
      />
    );

    expect(screen.getByText("This result was not saved because suspicious input was detected.")).toBeTruthy();
    const historySection = screen.getByText("Last 10").closest("section");

    expect(historySection).toBeTruthy();
    expect(within(historySection as HTMLElement).queryByText("Attempts")).toBeNull();
    expect(within(historySection as HTMLElement).getAllByText("41.0")).toHaveLength(2);
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
      <ResultDashboard
        result={makeResult()}
        passage={makePassage()}
        onRestart={vi.fn()}
        onNextPassage={vi.fn()}
        previousResult={null}
        recentResults={[]}
        attemptTimeline={makeTimeline()}
        modeLabel="1m"
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
    elapsedSeconds: 60,
    modeDurationSeconds: 60,
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
