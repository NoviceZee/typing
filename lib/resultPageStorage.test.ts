/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoredPassage } from "./app-storage";
import type { TypingResult } from "./typing-engine";
import {
  clearResultReturnAction,
  readResultPageSnapshot,
  readResultReturnAction,
  updateResultPageSnapshot,
  writeResultPageSnapshot,
  writeResultReturnAction
} from "./resultPageStorage";

const result: TypingResult = {
  characters: [],
  characterStatuses: [],
  correctCharacters: 200,
  incorrectCharacters: 0,
  missedCharacters: 0,
  extraCharacters: 0,
  totalCharacters: 200,
  comparableTargetLength: 200,
  comparableTypedLength: 200,
  accuracy: 100,
  wpm: 40,
  rawWpm: 42,
  elapsedSeconds: 60,
  modeDurationSeconds: 60,
  category: "Business communication",
  presetName: "General",
  completionReason: "time_up",
  completedAt: "2026-09-19T08:00:00.000Z",
  isRankable: true
};

const passage: StoredPassage = {
  id: "passage-1",
  title: "A result route",
  category: "Business communication",
  style: "General",
  source: "uploaded",
  text: "A stable result route survives refresh.",
  updatedAt: result.completedAt
};

const snapshot = {
  version: 1 as const,
  attemptId: "attempt-1",
  result,
  passage,
  previousResult: null,
  restartPreviousResult: null,
  restartTargetIdentity: null,
  recentResults: null,
  progressMilestones: [],
  attemptTimeline: [{ timeSeconds: 60, wpm: 40 }],
  errorEvents: [],
  modeLabel: "1m",
  isSuspicious: false,
  cloudSaveState: "idle" as const,
  originHref: "/practice?language=english&mode=1m"
};

describe("result page session storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("survives a same-tab page refresh and rejects unrelated attempt ids", () => {
    writeResultPageSnapshot(snapshot);

    expect(readResultPageSnapshot("attempt-1")).toEqual(snapshot);
    expect(readResultPageSnapshot("another-attempt")).toBeNull();
  });

  it("updates asynchronous save state and notifies the result page", () => {
    const listener = vi.fn();
    window.addEventListener("typing-station:result-page-updated", listener);
    writeResultPageSnapshot(snapshot);

    updateResultPageSnapshot("attempt-1", { cloudSaveState: "saved" });

    expect(readResultPageSnapshot("attempt-1")?.cloudSaveState).toBe("saved");
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener("typing-station:result-page-updated", listener);
  });

  it("stores one-time restart and next-passage handoffs separately from display data", () => {
    writeResultReturnAction({ attemptId: "attempt-1", action: "restart" });
    expect(readResultReturnAction("attempt-1")).toEqual({ attemptId: "attempt-1", action: "restart" });

    clearResultReturnAction("attempt-1");
    expect(readResultReturnAction("attempt-1")).toBeNull();
  });

  it("keeps same-navigation result data available when session storage is full", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
    });
    const fallbackSnapshot = { ...snapshot, attemptId: "attempt-memory-fallback" };

    writeResultPageSnapshot(fallbackSnapshot);

    expect(readResultPageSnapshot(fallbackSnapshot.attemptId)).toEqual(fallbackSnapshot);
    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
