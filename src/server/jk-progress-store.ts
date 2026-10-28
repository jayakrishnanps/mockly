import { count, lte, sql } from "drizzle-orm";
import type { db } from "../db/index";
import { jkPracticeRecords } from "../db/schema.ts";
import { forestPeriodStarts } from "../lib/forest.ts";
import { buildJKProgress, readJKProgressTotals } from "../lib/jk-progress.ts";

export function createJKProgressStore(database: typeof db) {
  function xpBalance(now: Date) {
    return sql<number>`(select coalesce(sum(balance.xp), 0) - least(0, coalesce(min(balance.running_xp), 0))
      from (select ${jkPracticeRecords.xpDelta} as xp,
        sum(${jkPracticeRecords.xpDelta}) over (order by ${jkPracticeRecords.completedAt}, ${jkPracticeRecords.attemptId} rows between unbounded preceding and current row) as running_xp
        from ${jkPracticeRecords} where ${jkPracticeRecords.completedAt} <= ${now.toISOString()}) as balance)`.mapWith(Number);
  }

  async function getXpBalance(now = new Date()) {
    const [row] = await database.select({ totalXp: xpBalance(now) }).from(jkPracticeRecords).limit(1);
    const totalXp = row?.totalXp ?? 0;
    if (!Number.isSafeInteger(totalXp) || totalXp < 0) throw new Error("Invalid total XP.");
    return totalXp;
  }

  async function getTotals(now = new Date()) {
    const starts = forestPeriodStarts(now);
    const [totals] = await database.select({
      totalXp: xpBalance(now),
      completedMocks: count(),
      activeDays: sql<number>`count(distinct (${jkPracticeRecords.completedAt} at time zone 'Asia/Kolkata')::date)`.mapWith(Number),
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
    return database.select({ date, count: count(), xp: sql<number>`sum(${jkPracticeRecords.xpDelta})`.mapWith(Number) })
      .from(jkPracticeRecords).where(lte(jkPracticeRecords.completedAt, now.toISOString())).groupBy(date).orderBy(date);
  }

  return {
    getTotals, getActivity, getXpBalance,
    async getProgress(now = new Date()) {
      const [totals, activity] = await Promise.all([getTotals(now), getActivity(now)]);
      return buildJKProgress(totals, activity, now);
    },
  };
}
