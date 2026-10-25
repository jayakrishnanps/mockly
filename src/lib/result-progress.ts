export type ScoreHistoryPoint = {
  id: string;
  submittedAt: string;
  score: number;
  maxScore: number;
};

export const PROGRESS_WINDOW_SIZE = 10;
export const PROGRESS_CHART_HEIGHT = 224;

export function buildProgressChart(history: readonly ScoreHistoryPoint[], range: number | "all", width: number) {
  const lastPage = Math.max(0, Math.ceil(history.length / PROGRESS_WINDOW_SIZE) - 1);
  const page = typeof range === "number" && Number.isSafeInteger(range) && range >= 0 ? Math.min(range, lastPage) : 0;
  const end = range === "all" ? history.length : history.length - page * PROGRESS_WINDOW_SIZE;
  const start = range === "all" ? 0 : Math.max(0, end - PROGRESS_WINDOW_SIZE);
  const series = history.slice(start, end).map((entry, index) => ({
    ...entry, attemptNumber: start + index + 1, percentage: entry.score / entry.maxScore * 100,
  }));
  let minimum = 0;
  let maximum = 100;
  for (const point of series) {
    minimum = Math.min(minimum, point.percentage);
    maximum = Math.max(maximum, point.percentage);
  }
  const approximateStep = (maximum - minimum) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(approximateStep));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= approximateStep) ?? 10) * magnitude;
  minimum = Math.floor(minimum / step) * step;
  maximum = Math.ceil(maximum / step) * step;
  const y = (percentage: number) => 24 + (maximum - percentage) / (maximum - minimum) * 164;
  const points = series.map((point, index) => ({
    ...point,
    x: series.length === 1 ? (width + 24) / 2 : 44 + index / Math.max(1, series.length - 1) * (width - 64),
    y: y(point.percentage),
  }));
  const ticks = Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => {
    const value = maximum - index * step;
    return { value, y: y(value) };
  });
  return { start, end, points, ticks };
}
