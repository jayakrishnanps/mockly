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

function shuffledCopy<T>(items: readonly T[], randomIndex: (upperBound: number) => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = randomIndex(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function selectQuestions<T>(
  questions: readonly T[],
  count: number,
  randomIndex: (upperBound: number) => number,
): T[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > questions.length) {
    throw new RangeError("Question count must be within the available pool.");
  }
  // Each new attempt draws independently; a repeated selection is still valid.
  return shuffledCopy(questions, randomIndex).slice(0, count);
}

type QuestionOptions = { questionText: string; options: readonly string[]; correctIndex: number };

function hasOptionReferences(question: QuestionOptions): boolean {
  const optionText = question.options.join("\n").replace(/[*_`]/g, "");
  const text = `${question.questionText.replace(/[*_`]/g, "")}\n${optionText}`;
  // Keep clear references to option labels/positions intact. Roman numerals such
  // as "Both I and II" refer to statements and do not restrict option shuffling.
  return /\b(?:all|none|both|neither|either)\s+(?:of\s+)?(?:the\s+)?(?:(?:options?|choices?|answers?)\s+)?(?:above|below)\b/i.test(text) ||
    /\b(?:options?|choices?|answers?)\s*\(?[a-d1-4]\b/i.test(text) ||
    /\b[a-d]\b\s*\)?\s*(?:,|and|or|&)\s*\(?\s*[a-d]\b/i.test(optionText) ||
    /\b(?:both|either|neither|only)\s+\(?[a-d]\b|\b[a-d]\b\)?\s+only\b/i.test(optionText) ||
    /\b(?:first|second|third|fourth|last|previous|preceding|following|above|below)\s+(?:options?|choices?|answers?)\b/i.test(text);
}

export function shuffleQuestionOptions(
  question: QuestionOptions,
  randomIndex: (upperBound: number) => number,
): { options: string[]; correctIndex: number } {
  if (!Number.isInteger(question.correctIndex) || question.correctIndex < 0 || question.correctIndex >= question.options.length) {
    throw new RangeError("Correct answer must refer to an available option.");
  }
  if (hasOptionReferences(question)) return { options: [...question.options], correctIndex: question.correctIndex };
  const optionOrder = shuffledCopy(question.options.map((_, index) => index), randomIndex);
  return {
    options: optionOrder.map((index) => question.options[index]),
    // Track the original index, since different options can have identical text.
    correctIndex: optionOrder.indexOf(question.correctIndex),
  };
}
