import { count, lte, sql } from "drizzle-orm";
import type { db } from "../db/index";
import { jkPracticeRecords } from "../db/schema.ts";
import { forestPeriodStarts } from "../lib/forest.ts";
import { buildJKProgress, readJKProgressTotals } from "../lib/jk-progress.ts";

export function createJKProgressStore(database: typeof db) {
  async function getTotals(now = new Date()) {
    const starts = forestPeriodStarts(now);
    const [totals] = await database.select({
      totalXp: sql<number>`coalesce(sum(${jkPracticeRecords.xp}), 0)`.mapWith(Number),
      completedMocks: count(),
      correctAnswers: sql<number>`coalesce(sum(${jkPracticeRecords.correctCount}), 0)`.mapWith(Number),
      wrongAnswers: sql<number>`coalesce(sum(${jkPracticeRecords.wrongCount}), 0)`.mapWith(Number),
      skippedAnswers: sql<number>`coalesce(sum(${jkPracticeRecords.skippedCount}), 0)`.mapWith(Number),
      totalPracticeSeconds: sql<number>`coalesce(sum(${jkPracticeRecords.timeTakenSeconds}), 0)`.mapWith(Number),
      firstCompletedAt: sql<string | null>`min(${jkPracticeRecords.completedAt})::text`,
      today: sql<number>`count(*) filter (where ${jkPracticeRecords.completedAt} >= ${starts.today})`.mapWith(Number),
      week: sql<number>`count(*) filter (where ${jkPracticeRecords.completedAt} >= ${starts.week})`.mapWith(Number),
      month: sql<number>`count(*) filter (where ${jkPracticeRecords.completedAt} >= ${starts.month})`.mapWith(Number),
      year: sql<number>`count(*) filter (where ${jkPracticeRecords.completedAt} >= ${starts.year})`.mapWith(Number),
    }).from(jkPracticeRecords).where(lte(jkPracticeRecords.completedAt, now.toISOString()));
    return readJKProgressTotals(totals);
  }

  async function getActivity(now = new Date()) {
    const date = sql<string>`to_char(${jkPracticeRecords.completedAt} at time zone 'Asia/Kolkata', 'YYYY-MM-DD')`;
    return database.select({ date, count: count(), xp: sql<number>`sum(${jkPracticeRecords.xp})`.mapWith(Number) })
      .from(jkPracticeRecords).where(lte(jkPracticeRecords.completedAt, now.toISOString())).groupBy(date).orderBy(date);
  }

  return {
    getTotals, getActivity,
    async getProgress(now = new Date()) {
      const [totals, activity] = await Promise.all([getTotals(now), getActivity(now)]);
      return buildJKProgress(totals, activity, now);
    },
  };
}
