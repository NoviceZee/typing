import { describe, expect, it } from "vitest";
import {
  createTypingSessionCoordinator,
  type TypingSessionSnapshot
} from "@/lib/typingSessionLifecycle";

function makeSession(overrides: Partial<TypingSessionSnapshot> = {}): TypingSessionSnapshot {
  return {
    id: "session-1",
    startedAt: 1_000,
    target: {
      passageId: "passage-1",
      title: "A passage",
      category: "Business email",
      language: "english",
      displayText: "Target text",
      comparableText: "Target text"
    },
    mode: {
      kind: "infinite",
      durationSeconds: null
    },
    ...overrides
  };
}

describe("typing session completion transaction", () => {
  it("freezes one immutable completion snapshot and rejects duplicate finish requests", () => {
    const coordinator = createTypingSessionCoordinator(makeSession());
    const request = {
      sessionId: "session-1",
      reason: "text_completed" as const,
      finishedAt: 3_500,
      input: "Target text",
      timeline: [{ timeSeconds: 2, characterIndex: 11 }],
      errorEvents: []
    };

    const first = coordinator.finish(request);
    const second = coordinator.finish({ ...request, reason: "manual" });

    expect(first).toMatchObject({
      sessionId: "session-1",
      reason: "text_completed",
      elapsedSeconds: 2,
      input: "Target text",
      target: { comparableText: "Target text" }
    });
    expect(second).toBeNull();
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first?.target)).toBe(true);
    expect(Object.isFrozen(first?.timeline)).toBe(true);
  });

  it("rejects a stale callback from another session", () => {
    const coordinator = createTypingSessionCoordinator(makeSession({ id: "current-session" }));

    expect(
      coordinator.finish({
        sessionId: "stale-session",
        reason: "time_up",
        finishedAt: 61_000,
        input: "",
        timeline: [],
        errorEvents: []
      })
    ).toBeNull();
    expect(coordinator.isFinished()).toBe(false);
  });

  it("never treats an Infinite count-up clock as a time-up completion source", () => {
    const coordinator = createTypingSessionCoordinator(makeSession());

    expect(
      coordinator.finish({
        sessionId: "session-1",
        reason: "time_up",
        finishedAt: 61_000,
        input: "Target",
        timeline: [],
        errorEvents: []
      })
    ).toBeNull();
    expect(coordinator.isFinished()).toBe(false);
  });
});
