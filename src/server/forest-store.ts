import { and, count, eq, isNotNull, lte, sql } from "drizzle-orm";
import type { db } from "../db/index";
import { attempts } from "../db/schema.ts";
import { forestPeriodStarts, readForestCounts, type ForestCounts } from "../lib/forest.ts";

export function createForestStore(database: typeof db) {
  return {
    async getHECounts(now = new Date()): Promise<ForestCounts> {
      const starts = forestPeriodStarts(now);
      const [totals] = await database.select({
        today: sql<number>`count(*) filter (where ${attempts.submittedAt} >= ${starts.today})`.mapWith(Number),
        week: sql<number>`count(*) filter (where ${attempts.submittedAt} >= ${starts.week})`.mapWith(Number),
        month: sql<number>`count(*) filter (where ${attempts.submittedAt} >= ${starts.month})`.mapWith(Number),
        year: sql<number>`count(*) filter (where ${attempts.submittedAt} >= ${starts.year})`.mapWith(Number),
        all: count(),
      }).from(attempts).where(and(
        eq(attempts.takenBy, "HE"),
        isNotNull(attempts.submittedAt),
        lte(attempts.submittedAt, now.toISOString()),
      ));
      return readForestCounts(totals);
    },
  };
}
