export type QuestionCountResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

export function resolveQuestionCount(available: number, configuredCount: number | null, requested: unknown): QuestionCountResult {
  if (!Number.isSafeInteger(available) || available < 1) {
    return { ok: false, error: "This mock has no questions yet." };
  }
  if (configuredCount === null) {
    if (requested !== undefined && requested !== available) {
      return { ok: false, error: "This mock uses all of its questions." };
    }
    return { ok: true, count: available };
  }
  if (!Number.isSafeInteger(configuredCount) || configuredCount < 1) {
    return { ok: false, error: "This mock's question count is invalid." };
  }
  const count = Math.min(configuredCount, available);
  if (requested !== undefined && requested !== count) {
    return { ok: false, error: `This mock uses ${count} questions per attempt, as set when it was created.` };
  }
  return { ok: true, count };
}

export function selectQuestions<T extends { id: string }>(
  questions: readonly T[],
  count: number,
  previousOrder: readonly string[],
  randomIndex: (upperBound: number) => number,
): T[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > questions.length) {
    throw new RangeError("Question count must be within the available pool.");
  }
  const shuffled = [...questions];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const selected = shuffled.slice(0, count);
  // Keep small retakes from repeating the exact saved order when possible.
  if (selected.length > 1 && selected.length === previousOrder.length && selected.every((question, index) => question.id === previousOrder[index])) {
    const swapIndex = 1 + randomIndex(selected.length - 1);
    [selected[0], selected[swapIndex]] = [selected[swapIndex], selected[0]];
  }
  return selected;
}
