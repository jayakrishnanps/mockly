"use server";

import { db } from "@/db";
import type { MockComparison } from "@/lib/mock-comparison";
import { isUuid } from "@/lib/mock-validation";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { getSharedMockComparison } from "@/server/mock-comparison";

export async function loadMockComparison(attemptId: string): Promise<{ ok: true; data: MockComparison } | { ok: false; error: string }> {
  if (!isUuid(attemptId)) return { ok: false, error: "This comparison is unavailable." };

  try {
    const user = await getRememberedUserFromCookies();
    if (!user) return { ok: false, error: "Choose your user again to compare attempts." };
    const data = await getSharedMockComparison(db, attemptId, user);
    if (!data) return { ok: false, error: "This mock is no longer shared with both users." };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Comparison could not be loaded. Please try again." };
  }
}
