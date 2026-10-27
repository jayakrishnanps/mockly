export const FOREST_PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
  { value: "all", label: "All time" },
] as const;

export type ForestPeriod = typeof FOREST_PERIODS[number]["value"];
export type ForestCounts = Record<ForestPeriod, number>;

export const FOREST_CAPACITY = 25;

const INDIA_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function forestPeriodStarts(now: Date): Record<Exclude<ForestPeriod, "all">, string> {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid forest date.");
  const local = new Date(now.getTime() + INDIA_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const today = Date.UTC(year, month, day) - INDIA_OFFSET_MS;
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;

  return {
    today: new Date(today).toISOString(),
    week: new Date(today - daysSinceMonday * DAY_MS).toISOString(),
    month: new Date(Date.UTC(year, month, 1) - INDIA_OFFSET_MS).toISOString(),
    year: new Date(Date.UTC(year, 0, 1) - INDIA_OFFSET_MS).toISOString(),
  };
}

export function readForestCounts(value: unknown): ForestCounts {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid forest totals.");
  const row = value as Record<string, unknown>;
  const counts: ForestCounts = { today: 0, week: 0, month: 0, year: 0, all: 0 };
  for (const { value: period } of FOREST_PERIODS) {
    const count = row[period];
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("Invalid forest totals.");
    counts[period] = count;
  }
  return counts;
}

export function visiblePlantCount(count: number): number {
  return Number.isSafeInteger(count) && count > 0 ? Math.min(count, FOREST_CAPACITY) : 0;
}
