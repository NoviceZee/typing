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
