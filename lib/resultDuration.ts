export type ResultDurationCandidate = {
  modeDurationSeconds?: number | null;
  elapsedSeconds?: number | null;
  durationSeconds?: number | null;
  timeUsedSeconds?: number | null;
  mode_duration_seconds?: number | null;
  elapsed_seconds?: number | null;
  duration_seconds?: number | null;
};

export type ResultDuration = {
  modeDurationSeconds: number | null;
  elapsedSeconds: number;
};

export function hasValidResultDuration(candidate: ResultDurationCandidate): boolean {
  const hasExplicitModeDuration =
    candidate.modeDurationSeconds !== undefined || candidate.mode_duration_seconds !== undefined;
  const modeDuration = hasExplicitModeDuration
    ? candidate.modeDurationSeconds ?? candidate.mode_duration_seconds ?? null
    : candidate.durationSeconds ?? candidate.duration_seconds ?? null;
  const elapsedDuration =
    candidate.elapsedSeconds ??
    candidate.elapsed_seconds ??
    candidate.timeUsedSeconds ??
    candidate.durationSeconds ??
    candidate.duration_seconds ??
    modeDuration;

  return (
    (modeDuration === null || isValidDuration(modeDuration)) &&
    isValidDuration(elapsedDuration)
  );
}

export function resolveResultDuration(candidate: ResultDurationCandidate): ResultDuration {
  const hasExplicitModeDuration =
    candidate.modeDurationSeconds !== undefined || candidate.mode_duration_seconds !== undefined;
  const explicitModeDuration = candidate.modeDurationSeconds ?? candidate.mode_duration_seconds ?? null;
  const legacyDuration = candidate.durationSeconds ?? candidate.duration_seconds ?? null;
  const elapsedDuration =
    candidate.elapsedSeconds ??
    candidate.elapsed_seconds ??
    candidate.timeUsedSeconds ??
    legacyDuration ??
    explicitModeDuration ??
    1;

  return {
    modeDurationSeconds: hasExplicitModeDuration
      ? normalizeNullableDuration(explicitModeDuration)
      : normalizeNullableDuration(legacyDuration),
    elapsedSeconds: normalizeDuration(elapsedDuration)
  };
}

export function getLegacyDurationBucket(duration: ResultDuration): number {
  return duration.modeDurationSeconds ?? duration.elapsedSeconds;
}

function normalizeNullableDuration(value: number | null): number | null {
  return value === null ? null : normalizeDuration(value);
}

function normalizeDuration(value: number): number {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
}

function isValidDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 86_400;
}
