import "server-only";
import { cache } from "react";
import { db } from "@/db";
import { buildJKProgress, levelProgress } from "@/lib/jk-progress";
import { createJKProgressStore } from "./jk-progress-store";

const store = createJKProgressStore(db);
const requestTime = cache(() => new Date());
const getTotals = cache(() => store.getTotals(requestTime()));

export const getJKLevel = cache(async () => levelProgress(await store.getXpBalance(requestTime())).level);

export const getJKProgress = cache(async () => {
  const [totals, activity] = await Promise.all([getTotals(), store.getActivity(requestTime())]);
  return buildJKProgress(totals, activity, requestTime());
});
