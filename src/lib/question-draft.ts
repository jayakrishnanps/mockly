import { ERROR_CODES, type InvalidQuestion, type ParsedQuestion, type ParseResult, type ParserError } from "./parser.ts";
import { isUuid } from "./mock-validation.ts";

export type DraftQuestion = ParsedQuestion & { id: string };
export type DraftProblem = InvalidQuestion & { id: string; editedSource?: string };
export type BatchCounts = { parsed: number; valid: number; problems: number };
type DraftContent = {
  input: string;
  questions: DraftQuestion[];
  problems: DraftProblem[];
  lastBatch: BatchCounts | null;
};
export type QuestionDraft = DraftContent & {
  version: 2;
  context: { kind: "append"; testId: string };
};

export const STORAGE_WARNING = "Browser storage is unavailable or full. Keep this tab open: refreshing may lose changes or restore an older draft.";

export function emptyQuestionDraft(bankId: string): QuestionDraft {
  return { version: 2, context: { kind: "append", testId: bankId }, input: "", questions: [], problems: [], lastBatch: null };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function sourceFields(value: Record<string, unknown>): boolean {
  return text(value.id) && text(value.raw) &&
    (value.sourceNumber === null || (typeof value.sourceNumber === "string" && /^\d+$/.test(value.sourceNumber)));
}

function isDraftQuestion(value: unknown): value is DraftQuestion {
  return record(value) && sourceFields(value) && text(value.questionText) &&
    Array.isArray(value.options) && value.options.length === 4 && value.options.every(text) &&
    Number.isInteger(value.correctIndex) && Number(value.correctIndex) >= 0 && Number(value.correctIndex) <= 3;
}

function isParserError(value: unknown): value is ParserError {
  return record(value) && ERROR_CODES.some((code) => code === value.code) && text(value.message) &&
    (value.line === undefined || (Number.isInteger(value.line) && Number(value.line) > 0));
}

function isDraftProblem(value: unknown): value is DraftProblem {
  return record(value) && sourceFields(value) && Array.isArray(value.errors) &&
    value.errors.length > 0 && value.errors.every(isParserError) &&
    (value.editedSource === undefined || typeof value.editedSource === "string");
}

function hasDraftContent(value: unknown): value is DraftContent {
  if (!record(value) || typeof value.input !== "string" ||
      !Array.isArray(value.questions) || !value.questions.every(isDraftQuestion) ||
      !Array.isArray(value.problems) || !value.problems.every(isDraftProblem)) return false;
  const ids = [...value.questions, ...value.problems].map((item) => item.id);
  if (new Set(ids).size !== ids.length) return false;
  const counts = value.lastBatch;
  return counts === null || (record(counts) &&
    [counts.parsed, counts.valid, counts.problems].every((count) => Number.isInteger(count) && Number(count) >= 0) &&
    counts.parsed === Number(counts.valid) + Number(counts.problems));
}

export function isQuestionDraft(value: unknown, bankId: string): value is QuestionDraft {
  return record(value) && value.version === 2 && record(value.context) &&
    value.context.kind === "append" && value.context.testId === bankId && hasDraftContent(value);
}

export function prepareQuestionDraft(draft: QuestionDraft, createId: () => string): QuestionDraft {
  return {
    ...draft,
    questions: draft.questions.map((question) => isUuid(question.id) ? question : { ...question, id: createId() }),
  };
}

export function appendParsedBatch(
  draft: QuestionDraft,
  result: ParseResult,
  createId: () => string,
  repairedProblemId?: string,
): QuestionDraft {
  return {
    ...draft,
    input: repairedProblemId ? draft.input : "",
    questions: [...draft.questions, ...result.valid.map((question) => ({ ...question, id: createId() }))],
    problems: [
      ...draft.problems.filter((problem) => problem.id !== repairedProblemId),
      ...result.invalid.map((problem) => ({ ...problem, id: createId() })),
    ],
    lastBatch: { parsed: result.total, valid: result.valid.length, problems: result.invalid.length },
  };
}
