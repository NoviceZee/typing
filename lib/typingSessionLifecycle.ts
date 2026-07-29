import type { CompletionReason, PracticeCategory, TypingRules } from "@/lib/typing-engine";
import type { PassageLanguage } from "@/lib/app-storage";
import type { PassageSource } from "@/lib/app-storage";

export type TypingSessionTargetSnapshot = Readonly<{
  passageId: string | null;
  title: string;
  category: PracticeCategory;
  language: PassageLanguage;
  style?: string;
  source?: PassageSource;
  displayTokens?: readonly string[];
  metricUnit?: "wpm" | "cpm";
  displayText: string;
  comparableText: string;
}>;

export type TypingSessionModeSnapshot = Readonly<{
  kind: "timed" | "finite" | "infinite";
  durationSeconds: number | null;
}>;

export type TypingSessionSnapshot = Readonly<{
  id: string;
  startedAt: number;
  target: TypingSessionTargetSnapshot;
  mode: TypingSessionModeSnapshot;
  rules?: TypingRules;
}>;

export type TypingSessionFinishRequest<TTimeline = unknown, TError = unknown> = Readonly<{
  sessionId: string;
  reason: CompletionReason;
  finishedAt: number;
  input: string;
  timeline: readonly TTimeline[];
  errorEvents: readonly TError[];
}>;

export type CompletedTypingSession<TTimeline = unknown, TError = unknown> = Readonly<{
  sessionId: string;
  startedAt: number;
  finishedAt: number;
  elapsedSeconds: number;
  reason: CompletionReason;
  target: TypingSessionTargetSnapshot;
  mode: TypingSessionModeSnapshot;
  rules?: TypingRules;
  input: string;
  timeline: readonly TTimeline[];
  errorEvents: readonly TError[];
}>;

export type TypingSessionCoordinator = {
  finish<TTimeline = unknown, TError = unknown>(
    request: TypingSessionFinishRequest<TTimeline, TError>
  ): CompletedTypingSession<TTimeline, TError> | null;
  isFinished(): boolean;
  getSession(): TypingSessionSnapshot;
};

export function createTypingSessionCoordinator(snapshot: TypingSessionSnapshot): TypingSessionCoordinator {
  const session = freezeSessionSnapshot(snapshot);
  let finished = false;

  return {
    finish<TTimeline, TError>(
      request: TypingSessionFinishRequest<TTimeline, TError>
    ): CompletedTypingSession<TTimeline, TError> | null {
      if (finished || request.sessionId !== session.id) {
        return null;
      }

      // Infinite is a count-up mode. A stale or incorrectly wired timer callback
      // must never be able to finish it as time-up.
      if (request.reason === "time_up" && session.mode.kind !== "timed") {
        return null;
      }

      finished = true;
      const timeline = Object.freeze([...request.timeline]);
      const errorEvents = Object.freeze([...request.errorEvents]);
      return Object.freeze({
        sessionId: session.id,
        startedAt: session.startedAt,
        finishedAt: request.finishedAt,
        elapsedSeconds: Math.max(1, Math.floor((request.finishedAt - session.startedAt) / 1_000)),
        reason: request.reason,
        target: session.target,
        mode: session.mode,
        rules: session.rules,
        input: request.input,
        timeline,
        errorEvents
      });
    },
    isFinished() {
      return finished;
    },
    getSession() {
      return session;
    }
  };
}

function freezeSessionSnapshot(snapshot: TypingSessionSnapshot): TypingSessionSnapshot {
  const target = Object.freeze({
    ...snapshot.target,
    displayTokens: snapshot.target.displayTokens
      ? Object.freeze([...snapshot.target.displayTokens])
      : undefined
  });
  const mode = Object.freeze({ ...snapshot.mode });
  const rules = snapshot.rules ? Object.freeze({ ...snapshot.rules }) : undefined;
  return Object.freeze({ ...snapshot, target, mode, rules });
}
