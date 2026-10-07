"use server";

import { getRememberedUserFromCookies } from "@/lib/server-user";
import { isUuid } from "@/lib/mock-validation";
import { isUser } from "@/lib/users";
import { attemptStore } from "@/server/attempts";

export async function getMockStatsAction(testId: unknown, user: unknown) {
  if (!isUuid(testId) || !isUser(user) || await getRememberedUserFromCookies() !== user) return null;
  try {
    return await attemptStore.getMockStats(testId, user);
  } catch {
    return null;
  }
}
