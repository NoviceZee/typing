import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ResultDashboard } from "../pages/practice";
import type { TypingResult } from "./typing-engine";
import type { StoredPassage } from "./app-storage";

vi.mock("@/components/AppShell", () => ({ AppShell: () => null }));

const result: TypingResult = {
  characters: [], characterStatuses: [], correctCharacters: 240, incorrectCharacters: 0,
  missedCharacters: 0, extraCharacters: 0, totalCharacters: 240, comparableTargetLength: 240,
  comparableTypedLength: 240, accuracy: 100, wpm: 48, rawWpm: 50, elapsedSeconds: 60,
  modeDurationSeconds: 60, category: "Uncategorised", presetName: "General",
  completionReason: "time_up", completedAt: "2026-06-19T00:02:00.000Z", isRankable: true
};
const passage = {
  id: "layout-fixture", title: "Time management", category: "Uncategorised", style: "General",
  source: "uploaded", text: "Time management keeps formal work moving clearly.", updatedAt: result.completedAt
} satisfies StoredPassage;
const previousResult = {
  passageId: passage.id, passageTitle: passage.title, wpm: 48, rawWpm: 50, accuracy: 100,
  errors: 0, correctCharacters: 240, typedCharacters: 240, elapsedSeconds: 60,
  completedAt: "2026-06-18T00:00:00.000Z", completionReason: "time_up" as const
};
const history = Array.from({ length: 10 }, (_, index) => ({
  id: String(index), passage_title: passage.title, duration_seconds: 60,
  wpm: 40 + index, accuracy: 99, created_at: `2026-06-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`
}));
const timeline = [5, 20, 40, 60].map((timeSeconds, index) => ({
  timeSeconds, wpm: 40 + index * 3, burstWpm: 45 + index * 3, accuracy: 100
}));
const noop = () => {};
const base: React.ComponentProps<typeof ResultDashboard> = {
  result, passage, previousResult, recentResults: history, attemptTimeline: timeline,
  modeLabel: "1m", cloudSaveState: "saved", onRestart: noop, onNextPassage: noop
};
const longPassage: StoredPassage = {
  ...passage,
  category: "Government & public information",
  title: "Understanding the importance of thoughtful time management in collaborative international research and professional communication",
  style: "Advanced professional communication, research methods, collaborative planning and sustainable daily productivity"
};
const mistakes = Array.from({ length: 8 }, (_, index) => ({ index, expected: "a", actual: "s", status: "wrong" as const }));
const cases: Array<[string, Partial<React.ComponentProps<typeof ResultDashboard>>]> = [
  ["saved-full-history", {}],
  ["long-metadata-mistakes", { passage: longPassage, result: { ...result, incorrectCharacters: 8, characterStatuses: mistakes } }],
  ["corrected-errors", { result: { ...result, wpm: 50 }, errorEvents: [{ timeSeconds: 20, characterIndex: 3 }] }],
  ["first-attempt", { previousResult: null, recentResults: [] }],
  ["limited-history", { recentResults: history.slice(0, 1) }],
  ["anonymous", { previousResult: null, recentResults: null, cloudSaveState: "idle" }],
  ["save-failed", { passage: longPassage, cloudSaveState: "failed", result: { ...result, incorrectCharacters: 8, characterStatuses: mistakes } }],
  ["saving", { cloudSaveState: "saving" }],
  ["manual-unsaved", { result: { ...result, completionReason: "manual" }, cloudSaveState: "idle" }],
  ["suspicious", { passage: longPassage, isSuspicious: true, cloudSaveState: "idle" }],
  ["text-completed", { result: { ...result, completionReason: "text_completed", modeDurationSeconds: null, elapsedSeconds: 72 }, modeLabel: "Infinite" }]
];

describe("result page layout fixtures", () => {
  it.each(cases)("preserves accessible result regions for %s", (name, overrides) => {
    const html = renderToStaticMarkup(<ResultDashboard {...base} {...overrides} />);
    expect(html).toContain('aria-label="Result summary"');
    expect(html).toContain('data-testid="primary-result-summary"');
    expect(html).toContain('data-testid="primary-result-composition"');
    expect(html).toContain('data-metric-priority="hero"');
    expect(html).toContain('aria-label="WPM over time"');
    expect(html).toContain('aria-label="Errors encountered"');
    expect(html).toContain('aria-label="Final mistakes remaining"');
    expect(html).toContain('data-metric-priority="secondary"');
    expect(html).toContain('aria-label="Result actions"');
    expect(html).toContain('aria-label="Generate image card"');
    expect(html).toContain('lucide-image icon-control');
    expect(html).toContain('lucide-rotate-ccw icon-control');
    expect(html).toContain('lucide-arrow-right icon-control');
    expect(html).toContain('data-testid="attempt-chart-axis-title-wpm"');
    expect(html).toContain('data-testid="attempt-chart-axis-title-errors"');
    expect(html).toContain('data-testid="attempt-chart-axis-title-time"');
    expect(html).toContain('text-[9px]');
    expect(html).toContain('data-testid="attempt-chart-point-marker"');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("fixed inset-0");
    expect(html.includes("Review mistakes")).toBe((overrides.result?.incorrectCharacters ?? 0) > 0);
    expect(html).not.toContain("Attempts</span>");
    // The optional browser runner consumes the real component markup and compiled app CSS.
    if (process.env.RESULT_LAYOUT_OUTPUT) {
      mkdirSync(process.env.RESULT_LAYOUT_OUTPUT, { recursive: true });
      writeFileSync(join(process.env.RESULT_LAYOUT_OUTPUT, `${name}.html`), html);
    }
  });
});
