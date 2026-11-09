"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/mock-validation";
import type { QuestionCountResult } from "@/lib/question-selection";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { mockStore } from "@/server/mocks";

export async function updateMockQuestionCount(testId: unknown, count: unknown): Promise<QuestionCountResult> {
  if (await getRememberedUserFromCookies() !== "JK") {
    return { ok: false, error: "Switch to JK to edit the question count." };
  }
  if (!isUuid(testId)) return { ok: false, error: "This mock ID is invalid." };

  const id = testId.toLowerCase();
  try {
    const result = await mockStore.updateQuestionLimit(id, count);
    if (result.ok) revalidatePath(`/test/${id}`);
    return result;
  } catch {
    return { ok: false, error: "Could not save the question count. Please try again." };
  }
}
