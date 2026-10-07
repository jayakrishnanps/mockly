import { isRecord, isUuid } from "./mock-validation.ts";
import type { AnswerRecord } from "./scoring";

export type QuestionState = "not-visited" | "not-answered" | "answered" | "marked" | "answered-marked";

export function questionState(answer: AnswerRecord): QuestionState {
  if (answer.selectedIndex !== null) return answer.markedForReview ? "answered-marked" : "answered";
  if (answer.markedForReview) return "marked";
  return answer.visited ? "not-answered" : "not-visited";
}

export function remainingSeconds(expiresAt: number, now: number): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** Reject malformed, duplicate and foreign answers; never drop questions silently. */
export function validateAnswers(value: unknown, questionIds?: string[]): AnswerRecord[] | null {
  if (!Array.isArray(value)) return null;
  const result: AnswerRecord[] = [];
  for (const answer of value) {
    if (!isRecord(answer) || !isUuid(answer.questionId) ||
      !(answer.selectedIndex === null || (Number.isInteger(answer.selectedIndex) && Number(answer.selectedIndex) >= 0 && Number(answer.selectedIndex) <= 3)) ||
      typeof answer.timeSpentMs !== "number" || !Number.isSafeInteger(answer.timeSpentMs) || answer.timeSpentMs < 0 ||
      typeof answer.markedForReview !== "boolean" || (answer.visited !== undefined && typeof answer.visited !== "boolean")) return null;
    result.push({
      questionId: answer.questionId.toLowerCase(), selectedIndex: answer.selectedIndex as number | null,
      timeSpentMs: answer.timeSpentMs, markedForReview: answer.markedForReview,
      visited: answer.visited === true || answer.selectedIndex !== null || answer.timeSpentMs > 0 || answer.markedForReview,
    });
  }
  if (new Set(result.map((answer) => answer.questionId)).size !== result.length) return null;
  if (!questionIds) return result;
  const byId = new Map(result.map((answer) => [answer.questionId, answer]));
  if (result.length !== questionIds.length || questionIds.some((id) => !byId.has(id))) return null;
  return questionIds.map((id) => byId.get(id)!);
}

export function addQuestionTime(answers: AnswerRecord[], index: number, from: number, now: number, expiresAt: number): AnswerRecord[] {
  const elapsed = Math.max(0, Math.floor(Math.min(now, expiresAt) - Math.min(from, expiresAt)));
  return answers.map((answer, i) => i === index ? { ...answer, visited: true, timeSpentMs: answer.timeSpentMs + elapsed } : answer);
}

export type RecoveryDraft = {
  version: 1; attemptId: string; user: string; revision: number;
  answers: AnswerRecord[]; current: number;
};

export function readRecovery(raw: string | null, attemptId: string, user: string, revision: number, questionIds: string[]): RecoveryDraft | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.version !== 1 || value.attemptId !== attemptId || value.user !== user || value.revision !== revision ||
      !Number.isInteger(value.current) || Number(value.current) < 0 || Number(value.current) >= questionIds.length) return null;
    const answers = validateAnswers(value.answers, questionIds);
    if (!answers) return null;
    return { version: 1, attemptId, user, revision, answers, current: Number(value.current) };
  } catch { return null; }
}
