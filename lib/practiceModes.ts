export type TimedPracticeMode = {
  id: "1m" | "5m" | "10m";
  label: string;
  kind: "timed";
  seconds: 60 | 300 | 600;
};

export type CompletionPracticeMode = {
  id: "infinite";
  label: string;
  kind: "infinite";
};

export type PracticeMode = TimedPracticeMode | CompletionPracticeMode;
export type PracticeModeId = PracticeMode["id"];

export const PRACTICE_MODE_OPTIONS: PracticeMode[] = [
  { id: "1m", label: "1m", kind: "timed", seconds: 60 },
  { id: "5m", label: "5m", kind: "timed", seconds: 300 },
  { id: "10m", label: "10m", kind: "timed", seconds: 600 },
  { id: "infinite", label: "Infinite", kind: "infinite" }
];

export function getPracticeMode(id: PracticeModeId): PracticeMode {
  return PRACTICE_MODE_OPTIONS.find((mode) => mode.id === id) ?? PRACTICE_MODE_OPTIONS[0];
}

export function isTimedPracticeMode(mode: PracticeMode): mode is TimedPracticeMode {
  return mode.kind === "timed";
}

export function getComparableDurationSeconds(mode: PracticeMode, elapsedSeconds: number) {
  return isTimedPracticeMode(mode) ? mode.seconds : Math.max(1, Math.round(elapsedSeconds));
}

export function isManualFinishShortcut(key: string) {
  return key === "Escape";
}
