export const MIN_PROGRESSION_ACCURACY = 70;
export const MIN_PROGRESSION_SECONDS = 15;

export type ProgressionEligibilityCandidate = {
  accuracy: number;
  wpm: number;
  completionReason?: string | null;
  completion_reason?: string | null;
  isRankable?: boolean | null;
  is_rankable?: boolean | null;
  timeUsedSeconds?: number | null;
  elapsedSeconds?: number | null;
  elapsed_seconds?: number | null;
  durationSeconds?: number | null;
  duration_seconds?: number | null;
  correctCharacters?: number | null;
  correct_chars?: number | null;
  typedCharacters?: number | null;
  typed_chars?: number | null;
  metric_domain?: string | null;
  category?: string | null;
  passage_category?: string | null;
};

export function isProgressionEligibleResult(result: ProgressionEligibilityCandidate): boolean {
  const completionReason = result.completionReason ?? result.completion_reason;
  const persistedRankability = result.isRankable ?? result.is_rankable;
  const elapsedSeconds =
    result.timeUsedSeconds ??
    result.elapsedSeconds ??
    result.elapsed_seconds ??
    result.durationSeconds ??
    result.duration_seconds;
  if (completionReason === "manual" || persistedRankability === false) {
    return false;
  }

  if (
    !Number.isFinite(result.accuracy) ||
    result.accuracy < MIN_PROGRESSION_ACCURACY ||
    result.accuracy > 100 ||
    !Number.isFinite(result.wpm) ||
    result.wpm < 0 ||
    elapsedSeconds == null ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < MIN_PROGRESSION_SECONDS
  ) {
    return false;
  }

  return true;
}
