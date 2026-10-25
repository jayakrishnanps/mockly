export type ScoreHistoryPoint = {
  id: string;
  submittedAt: string;
  score: number;
  maxScore: number;
  timeTakenSeconds?: number | null;
};

export const PROGRESS_WINDOW_SIZE = 10;
export const PROGRESS_CHART_HEIGHT = 336;
export type ProgressScale = "detail" | "full";

export function buildProgressChart(history: readonly ScoreHistoryPoint[], range: number | "all", width: number, scale: ProgressScale = "detail", showTime = false) {
  const lastPage = Math.max(0, Math.ceil(history.length / PROGRESS_WINDOW_SIZE) - 1);
  const page = typeof range === "number" && Number.isSafeInteger(range) && range >= 0 ? Math.min(range, lastPage) : 0;
  const end = range === "all" ? history.length : history.length - page * PROGRESS_WINDOW_SIZE;
  const start = range === "all" ? 0 : Math.max(0, end - PROGRESS_WINDOW_SIZE);
  const series = history.slice(start, end).map((entry, index) => ({
    ...entry, attemptNumber: start + index + 1, percentage: entry.score / entry.maxScore * 100,
  }));
  let minimum = series[0]?.percentage ?? 0;
  let maximum = minimum;
  for (const point of series) {
    minimum = Math.min(minimum, point.percentage);
    maximum = Math.max(maximum, point.percentage);
  }
  if (scale === "full" || series.length === 0) {
    minimum = Math.min(0, minimum);
    maximum = Math.max(100, maximum);
  } else {
    const withinPercentageRange = minimum >= 0 && maximum <= 100;
    const span = Math.max(5, maximum - minimum);
    const middle = (minimum + maximum) / 2;
    minimum = middle - span * 0.6;
    maximum = middle + span * 0.6;
    if (withinPercentageRange && minimum < 0) {
      maximum -= minimum;
      minimum = 0;
    }
    if (withinPercentageRange && maximum > 100) {
      minimum -= maximum - 100;
      maximum = 100;
    }
    if (withinPercentageRange) minimum = Math.max(0, minimum);
  }
  const approximateStep = (maximum - minimum) / 12;
  const magnitude = 10 ** Math.floor(Math.log10(approximateStep));
  const step = ([1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= approximateStep) ?? 10) * magnitude;
  minimum = Number((Math.floor(minimum / step) * step).toFixed(8));
  maximum = Number((Math.ceil(maximum / step) * step).toFixed(8));
  const plot = { left: 60, right: width - (showTime ? 72 : 24), top: 32, bottom: PROGRESS_CHART_HEIGHT - 40 };
  const y = (percentage: number) => plot.top + (maximum - percentage) / (maximum - minimum) * (plot.bottom - plot.top);
  const points = series.map((point, index) => ({
    ...point,
    x: series.length === 1 ? (plot.left + plot.right) / 2 : plot.left + index / Math.max(1, series.length - 1) * (plot.right - plot.left),
    y: y(point.percentage),
  }));
  const ticks = Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => {
    const value = Number((maximum - index * step).toFixed(8));
    return { value, y: y(value) };
  });
  return { start, end, points, ticks, plot, minimum, maximum };
}

export function buildTimeProgressChart(chart: ReturnType<typeof buildProgressChart>, scale: ProgressScale) {
  let minimum = Infinity;
  let maximum = 0;
  for (const point of chart.points) {
    const seconds = point.timeTakenSeconds;
    if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds < 0) continue;
    minimum = Math.min(minimum, seconds);
    maximum = Math.max(maximum, seconds);
  }

  if (minimum === Infinity) minimum = 0;
  if (scale === "full") {
    minimum = 0;
    maximum = Math.max(60, maximum);
  } else {
    const padding = Math.max(60, maximum - minimum) * 0.1;
    const span = Math.max(60, maximum - minimum) + padding * 2;
    const middle = (minimum + maximum) / 2;
    minimum = Math.max(0, middle - span / 2);
    maximum = Math.max(maximum + padding, minimum + span);
  }

  const approximateStep = (maximum - minimum) / 6;
  const magnitude = 10 ** Math.floor(Math.log10(approximateStep));
  const step = ([1, 2, 3, 6, 10].find((factor) => factor * magnitude >= approximateStep) ?? 10) * magnitude;
  minimum = Math.floor(minimum / step) * step;
  maximum = Math.ceil(maximum / step) * step;
  const y = (seconds: number) => chart.plot.top + (maximum - seconds) / (maximum - minimum) * (chart.plot.bottom - chart.plot.top);
  const points = chart.points.map((point) => {
    const seconds = point.timeTakenSeconds;
    const valid = typeof seconds === "number" && Number.isSafeInteger(seconds) && seconds >= 0;
    return { id: point.id, x: point.x, seconds: valid ? seconds : null, y: valid ? y(seconds) : null };
  });
  const ticks = Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, index) => {
    const value = maximum - index * step;
    return { value, y: y(value) };
  });
  let path = "";
  let connected = false;
  for (const point of points) {
    if (point.y === null) {
      connected = false;
      continue;
    }
    path += `${connected ? "L" : "M"}${point.x},${point.y} `;
    connected = true;
  }
  return { points, ticks, path: path.trim(), minimum, maximum };
}

export function formatProgressTime(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes}m ${String(seconds % 60).padStart(2, "0")}s` : `${seconds}s`;
}
