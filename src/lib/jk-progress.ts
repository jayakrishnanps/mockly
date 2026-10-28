import { forestPeriodStarts } from "./forest.ts";

export type ProgressActivityDay = { date: string; count: number; xp: number };
export type JKProgressTotals = {
  totalXp: number;
  completedMocks: number;
  activeDays: number;
  correctAnswers: number;
  wrongAnswers: number;
  skippedAnswers: number;
  totalPracticeSeconds: number;
  firstCompletedAt: string | null;
  counts: { today: number; week: number; month: number; year: number; allTime: number };
};
export type JKProgress = JKProgressTotals & {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
  answeredQuestions: number;
  accuracyPercent: number | null;
  activity: ProgressActivityDay[];
  currentStreak: number;
  longestStreak: number;
};

const DAY_MS = 86400000;

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function practiceXp(correct: number, wrong: number, skipped: number): number {
  if (![correct, wrong, skipped].every(nonnegativeInteger)) throw new Error("Invalid practice counts.");
  if (correct === 0 && wrong === 0) return 0;
  const xp = Number(BigInt(10) * (BigInt(correct) - BigInt(wrong)) + BigInt(20));
  if (!Number.isSafeInteger(xp)) throw new Error("Practice XP exceeds the supported range.");
  return xp;
}

function earlyLevelXp(count: number): bigint {
  const completedLevels = BigInt(count);
  if (completedLevels === BigInt(0)) return BigInt(0);
  const last = completedLevels - BigInt(1);
  const squares = last * (last + BigInt(1)) * (BigInt(2) * last + BigInt(1)) / BigInt(6);
  const oddTerms = (last + BigInt(1)) / BigInt(2);
  return BigInt(100) * completedLevels + BigInt(25) * last * completedLevels / BigInt(2) + (squares - oddTerms) / BigInt(4);
}

function xpBeforeLevel(level: number): bigint {
  const last = level - 1;
  let total = earlyLevelXp(Math.min(last, 34));
  if (last > 34) {
    const end = Math.min(last, 50);
    const count = BigInt(end - 34);
    total += earlyLevelXp(end) - earlyLevelXp(34) + BigInt(25) * count * (count + BigInt(1)) / BigInt(2);
  }
  const bands = [
    { start: 50, end: 100, base: 2325, increment: 40 },
    { start: 100, end: 200, base: 4325, increment: 2 },
    { start: 200, end: 500, base: 4525, increment: 3 },
    { start: 500, end: last, base: 5425, increment: 4 },
  ];
  for (const band of bands) {
    const count = BigInt(Math.max(0, Math.min(last, band.end) - band.start));
    total += BigInt(band.base) * count + BigInt(band.increment) * count * (count + BigInt(1)) / BigInt(2);
  }
  return total;
}

export function levelProgress(totalXp: number) {
  if (!nonnegativeInteger(totalXp)) throw new Error("Invalid total XP.");
  const total = BigInt(totalXp);
  let low = 1;
  let high = 2;
  while (xpBeforeLevel(high) <= total) high *= 2;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (xpBeforeLevel(middle) <= total) low = middle;
    else high = middle;
  }
  const xpIntoLevel = Number(total - xpBeforeLevel(low));
  const xpForNextLevel = Number(xpBeforeLevel(low + 1) - xpBeforeLevel(low));
  return { level: low, xpIntoLevel, xpForNextLevel, progressPercent: 100 * xpIntoLevel / xpForNextLevel };
}

export function readJKProgressTotals(value: unknown): JKProgressTotals {
  if (!record(value)) throw new Error("Invalid practice totals.");
  const keys = ["totalXp", "completedMocks", "activeDays", "correctAnswers", "wrongAnswers", "skippedAnswers", "totalPracticeSeconds", "today", "week", "month", "year"] as const;
  for (const key of keys) if (!nonnegativeInteger(value[key])) throw new Error("Invalid practice totals.");
  const first = value.firstCompletedAt;
  if (first !== null && (typeof first !== "string" || !Number.isFinite(Date.parse(first)))) throw new Error("Invalid first practice date.");
  return {
    totalXp: Number(value.totalXp), completedMocks: Number(value.completedMocks), activeDays: Number(value.activeDays),
    correctAnswers: Number(value.correctAnswers), wrongAnswers: Number(value.wrongAnswers), skippedAnswers: Number(value.skippedAnswers),
    totalPracticeSeconds: Number(value.totalPracticeSeconds), firstCompletedAt: first,
    counts: { today: Number(value.today), week: Number(value.week), month: Number(value.month), year: Number(value.year), allTime: Number(value.completedMocks) },
  };
}

function readActivity(value: unknown): ProgressActivityDay[] {
  if (!Array.isArray(value)) throw new Error("Invalid practice activity.");
  const seen = new Set<string>();
  return value.map((day) => {
    if (!record(day) || typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date) ||
      !Number.isFinite(Date.parse(`${day.date}T00:00:00Z`)) || new Date(`${day.date}T00:00:00Z`).toISOString().slice(0, 10) !== day.date ||
      !nonnegativeInteger(day.count) || day.count === 0 || typeof day.xp !== "number" || !Number.isSafeInteger(day.xp) || seen.has(day.date)) throw new Error("Invalid practice activity.");
    seen.add(day.date);
    return { date: day.date, count: day.count, xp: day.xp };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

export function buildJKProgress(totals: JKProgressTotals, rawActivity: unknown, now = new Date()): JKProgress {
  const today = new Date(Date.parse(forestPeriodStarts(now).today) + 330 * 60000).toISOString().slice(0, 10);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const days = readActivity(rawActivity).filter((day) => day.date <= today);
  const byDate = new Map(days.map((day) => [day.date, day]));
  const activity = Array.from({ length: 371 }, (_, index) => {
    const date = new Date(todayMs - (370 - index) * DAY_MS).toISOString().slice(0, 10);
    return byDate.get(date) ?? { date, count: 0, xp: 0 };
  });
  let longestStreak = 0;
  let streak = 0;
  let previousDay: number | null = null;
  for (const day of days) {
    const timestamp = Date.parse(`${day.date}T00:00:00Z`);
    streak = previousDay !== null && timestamp - previousDay === DAY_MS ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    previousDay = timestamp;
  }
  let currentStreak = 0;
  let cursor = byDate.has(today) ? todayMs : todayMs - DAY_MS;
  while (byDate.has(new Date(cursor).toISOString().slice(0, 10))) {
    currentStreak++;
    cursor -= DAY_MS;
  }
  const answeredQuestions = totals.correctAnswers + totals.wrongAnswers;
  if (!Number.isSafeInteger(answeredQuestions)) throw new Error("Invalid practice answer total.");
  return {
    ...totals, ...levelProgress(totals.totalXp), answeredQuestions,
    accuracyPercent: answeredQuestions ? 100 * totals.correctAnswers / answeredQuestions : null,
    activity, currentStreak, longestStreak,
  };
}
