"use server";

import { revalidatePath } from "next/cache";
import { isUuid } from "@/lib/mock-validation";
import { isUser } from "@/lib/users";
import { getRememberedUserFromCookies } from "@/lib/server-user";
import { validateAnswers } from "@/lib/attempt-state";
import { attemptStore } from "@/server/attempts";
import { AttemptError } from "@/server/attempt-store";

export type StartResult =
  | { ok: true; attemptId: string; resumed: boolean }
  | { ok: false; error: string };

export async function startAttempt(testId: unknown, user: unknown, questionCount?: unknown): Promise<StartResult> {
  if (!isUuid(testId) || !isUser(user) || await getRememberedUserFromCookies() !== user) return { ok: false, error: "Choose your identity before starting." };
  try {
    const result = await attemptStore.startOrResume(testId, user, questionCount);
    return { ok: true, attemptId: result.attemptId, resumed: result.resumed };
  } catch (error) {
    if (error instanceof AttemptError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not start this mock. Please try again." };
  }
}

export async function saveExamProgress(attemptId: unknown, user: unknown, answers: unknown, revision: number): Promise<{ ok: true; revision: number; submitted: boolean } | { ok: false; error: string }> {
  if (!isUuid(attemptId) || !isUser(user) || !validateAnswers(answers) || !Number.isSafeInteger(revision) || revision < 0 || await getRememberedUserFromCookies() !== user) return { ok: false, error: "Invalid request or changed user. Reload before continuing." };
  try {
    const result = await attemptStore.saveProgress(attemptId, user, answers, revision);
    return { ok: true, ...result };
  } catch (error) {
    if (error instanceof AttemptError) return { ok: false, error: error.message };
    return { ok: false, error: "Could not save progress." };
  }
}

export async function submitExam(attemptId: unknown, user: unknown, answers: unknown, revision: number): Promise<{ ok: true; attemptId: string } | { ok: false; error: string }> {
  if (!isUuid(attemptId) || !isUser(user) || !validateAnswers(answers) || !Number.isSafeInteger(revision) || revision < 0 || await getRememberedUserFromCookies() !== user) return { ok: false, error: "Invalid request or changed user. Reload before continuing." };
  try {
    const result = await attemptStore.submitAttempt(attemptId, user, answers, revision);
    revalidatePath(`/u/${user}/history`);
    revalidatePath(`/test/${result.testId}`);
    return { ok: true, attemptId: result.attemptId };
  } catch (error) {
    if (error instanceof AttemptError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: "Could not submit the exam. Please try again." };
  }
}
