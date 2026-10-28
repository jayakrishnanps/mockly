import { HE_QUOTES } from "./he-quotes.ts";

const DAY_MS = 86400000;
const INDIA_OFFSET_MS = 330 * 60000;
const FIRST_DAY = Math.floor(Date.UTC(2026, 9, 28) / DAY_MS);

export function heDailyQuote(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid quote date.");
  const day = Math.floor((now.getTime() + INDIA_OFFSET_MS) / DAY_MS);
  const elapsedDays = day - FIRST_DAY;
  const index = ((elapsedDays % HE_QUOTES.length) + HE_QUOTES.length) % HE_QUOTES.length;
  return HE_QUOTES[index];
}
