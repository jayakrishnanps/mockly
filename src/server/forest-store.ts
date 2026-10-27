import { count, lte, sql } from "drizzle-orm";
import type { db } from "../db/index";
import { forestPlants } from "../db/schema.ts";
import { forestPeriodStarts, readForestCounts, type ForestCounts } from "../lib/forest.ts";

export function createForestStore(database: typeof db) {
  return {
    async getHECounts(now = new Date()): Promise<ForestCounts> {
      const starts = forestPeriodStarts(now);
      const [totals] = await database.select({
        today: sql<number>`count(*) filter (where ${forestPlants.plantedAt} >= ${starts.today})`.mapWith(Number),
        week: sql<number>`count(*) filter (where ${forestPlants.plantedAt} >= ${starts.week})`.mapWith(Number),
        month: sql<number>`count(*) filter (where ${forestPlants.plantedAt} >= ${starts.month})`.mapWith(Number),
        year: sql<number>`count(*) filter (where ${forestPlants.plantedAt} >= ${starts.year})`.mapWith(Number),
        all: count(),
      }).from(forestPlants).where(lte(forestPlants.plantedAt, now.toISOString()));
      return readForestCounts(totals);
    },
  };
}
