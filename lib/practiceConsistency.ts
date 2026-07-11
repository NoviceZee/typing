export type SavedConsistencyResult = {
  id: string;
  wpm: number;
  created_at: string;
};

export type CurrentConsistencyResult = {
  wpm: number;
  completedAt: string;
};

export type ConsistencyPoint = {
  id: string;
  wpm: number;
  completedAt: string;
};

export type ConsistencySummary = {
  currentWpm: number;
  averageWpm: number;
  bestWpm: number;
};

export type AttemptConsistencyInput = {
  id: string;
  completedAt: string;
  category?: string | null;
  timeline?: Array<{ timeSeconds: number; wpm: number }>;
};

export type AttemptConsistencyPoint = {
  id: string;
  completedAt: string;
  score: number;
};

export type AttemptConsistencySummary = {
  points: AttemptConsistencyPoint[];
  latest: number | null;
  average: number | null;
  best: number | null;
  recentChange: number | null;
};

const MAX_CONSISTENCY_POINTS = 10;
const CURRENT_RESULT_DEDUPE_WINDOW_MS = 10_000;

export function buildConsistencySeries(
  savedResults: SavedConsistencyResult[],
  currentResult: CurrentConsistencyResult
): ConsistencyPoint[] {
  const currentCompletedAt = Date.parse(currentResult.completedAt);
  const savedPoints = savedResults
    .filter((result) => !isLikelyCurrentResult(result, currentResult.wpm, currentCompletedAt))
    .map((result) => ({
      id: result.id,
      wpm: result.wpm,
      completedAt: result.created_at
    }))
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt));

  return [
    ...savedPoints,
    {
      id: "current",
      wpm: currentResult.wpm,
      completedAt: currentResult.completedAt
    }
  ].slice(-MAX_CONSISTENCY_POINTS);
}

export function getConsistencySummary(points: Array<{ wpm: number }>): ConsistencySummary {
  const values = points.map((point) => point.wpm);
  const currentWpm = values[values.length - 1] ?? 0;
  const averageWpm = values.length > 0 ? values.reduce((total, value) => total + value, 0) / values.length : 0;
  const bestWpm = values.length > 0 ? Math.max(...values) : 0;

  return {
    currentWpm: roundOne(currentWpm),
    averageWpm: roundOne(averageWpm),
    bestWpm: roundOne(bestWpm)
  };
}

export function getSparklinePath(points: Array<{ wpm: number }>, width: number, height: number): string {
  if (points.length < 2) {
    return "";
  }

  const values = points.map((point) => point.wpm);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const xStep = width / (points.length - 1);
  const verticalPadding = 4;
  const drawableHeight = height - verticalPadding * 2;

  return points
    .map((point, index) => {
      const x = roundCoordinate(index * xStep);
      const y = roundCoordinate(height - verticalPadding - ((point.wpm - min) / range) * drawableHeight);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

export function calculateTimelineConsistency(timeline: Array<{ timeSeconds: number; wpm: number }>): number | null {
  const afterWarmup = timeline.filter((point) => point.timeSeconds >= 5);
  const stablePoints = (afterWarmup.length >= 3 ? afterWarmup : timeline).filter((point) => point.wpm > 0);

  if (stablePoints.length < 3) return null;

  const values = stablePoints.map((point) => point.wpm);
  const average = values.reduce((total, value) => total + value, 0) / values.length;
  if (average <= 0) return null;

  const variance = values.reduce((total, value) => total + (value - average) ** 2, 0) / values.length;
  const coefficientOfVariation = Math.sqrt(variance) / average;
  return roundOne(Math.max(0, Math.min(100, 100 * Math.exp(-2.3 * coefficientOfVariation))));
}

export function buildAttemptConsistencySummary(
  attempts: AttemptConsistencyInput[],
  isInDomain: (category?: string | null) => boolean
): AttemptConsistencySummary {
  const points = attempts
    .filter((attempt) => isInDomain(attempt.category))
    .map((attempt) => ({ ...attempt, score: calculateTimelineConsistency(attempt.timeline ?? []) }))
    .filter((attempt): attempt is AttemptConsistencyInput & { score: number } => attempt.score !== null)
    .sort((left, right) => Date.parse(left.completedAt) - Date.parse(right.completedAt))
    .slice(-30)
    .map(({ id, completedAt, score }) => ({ id, completedAt, score }));
  const scores = points.map((point) => point.score);
  const latest = scores[scores.length - 1] ?? null;
  const previousScores = scores.slice(Math.max(0, scores.length - 6), -1);
  const previousAverage = previousScores.length
    ? previousScores.reduce((total, score) => total + score, 0) / previousScores.length
    : null;

  return {
    points,
    latest,
    average: scores.length ? roundOne(scores.reduce((total, score) => total + score, 0) / scores.length) : null,
    best: scores.length ? Math.max(...scores) : null,
    recentChange: latest !== null && previousAverage !== null ? roundOne(latest - previousAverage) : null
  };
}

export function getConsistencyScorePath(points: AttemptConsistencyPoint[], width: number, height: number): string {
  return getSparklinePath(points.map((point) => ({ wpm: point.score })), width, height);
}

function isLikelyCurrentResult(result: SavedConsistencyResult, currentWpm: number, currentCompletedAt: number) {
  const savedCompletedAt = Date.parse(result.created_at);

  return (
    result.wpm === currentWpm &&
    Number.isFinite(savedCompletedAt) &&
    Number.isFinite(currentCompletedAt) &&
    Math.abs(savedCompletedAt - currentCompletedAt) <= CURRENT_RESULT_DEDUPE_WINDOW_MS
  );
}

function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}
