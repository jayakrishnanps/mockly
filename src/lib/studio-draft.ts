import { ERROR_CODES, type InvalidQuestion, type ParsedQuestion, type ParseResult, type ParserError } from "./parser.ts";
import { defaultMetadata, isMetadata, isUuid, type MockMetadata } from "./mock-validation.ts";

export type DraftQuestion = ParsedQuestion & { id: string };
export type DraftProblem = InvalidQuestion & { id: string; editedSource?: string };
export type BatchCounts = { parsed: number; valid: number; problems: number };
type DraftContent = {
  input: string;
  questions: DraftQuestion[];
  problems: DraftProblem[];
  lastBatch: BatchCounts | null;
};
export type StudioContext = { kind: "new" } | { kind: "append"; testId: string };
export type StudioDraft = DraftContent & {
  version: 2;
  context: StudioContext;
  metadata: MockMetadata;
  submissionId: string | null;
};

export const LEGACY_STORAGE_KEY = "mockly:studio-draft:v1";
export const STUDIO_STORAGE_KEY = "mockly:studio-draft:v2:new";
export const STORAGE_WARNING = "Browser storage is unavailable or full. Keep this tab open: refreshing may lose changes or restore an older draft.";
type DraftStorage = Pick<Storage, "getItem" | "setItem">;
type StorageProvider = () => DraftStorage;

export function studioStorageKey(context: StudioContext): string {
  return context.kind === "new" ? STUDIO_STORAGE_KEY : `mockly:studio-draft:v2:test:${context.testId.toLowerCase()}`;
}

export function emptyStudioDraft(context: StudioContext = { kind: "new" }): StudioDraft {
  return { version: 2, context, metadata: defaultMetadata(), submissionId: null, input: "", questions: [], problems: [], lastBatch: null };
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

function isStudioDraft(value: unknown, context: StudioContext): value is StudioDraft {
  if (!record(value) || value.version !== 2 || !isMetadata(value.metadata) ||
    !(value.submissionId === null || isUuid(value.submissionId)) || !record(value.context)) return false;
  const saved = value.context;
  if (saved.kind !== context.kind || (context.kind === "append" && saved.testId !== context.testId)) return false;
  return hasDraftContent(value);
}

export function loadStudioDraft(getStorage: StorageProvider = () => window.localStorage, context: StudioContext = { kind: "new" }): {
  draft: StudioDraft; storageError: string | null;
} {
  try {
    const storage = getStorage();
    const raw = storage.getItem(studioStorageKey(context));
    if (raw === null) {
      const legacy = context.kind === "new" ? storage.getItem(LEGACY_STORAGE_KEY) : null;
      if (legacy === null) return { draft: emptyStudioDraft(context), storageError: null };
      const value: unknown = JSON.parse(legacy);
      if (record(value) && value.version === 1 && hasDraftContent(value)) {
        // Keep v1 untouched as a backup. The first edit/save writes v2.
        return { draft: {
          ...emptyStudioDraft(context), input: value.input, questions: value.questions,
          problems: value.problems, lastBatch: value.lastBatch,
        }, storageError: null };
      }
    } else {
      const value: unknown = JSON.parse(raw);
      if (isStudioDraft(value, context)) return { draft: value, storageError: null };
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) return { draft: emptyStudioDraft(context), storageError: STORAGE_WARNING };
  }
  // Do not overwrite an unreadable saved draft just by opening the page.
  return {
    draft: emptyStudioDraft(context),
    storageError: "The saved draft could not be read. It has not been changed; your next edit will start a new browser draft.",
  };
}

export function saveStudioDraft(draft: StudioDraft, getStorage: StorageProvider = () => window.localStorage): string | null {
  try {
    getStorage().setItem(studioStorageKey(draft.context), JSON.stringify(draft));
    return null;
  } catch {
    return STORAGE_WARNING;
  }
}

/** Persist this snapshot before the request, so a retry reuses its database IDs. */
export function prepareDraftSave(draft: StudioDraft, createId: () => string): StudioDraft {
  return {
    ...draft,
    submissionId: draft.submissionId ?? createId(),
    questions: draft.questions.map((question) => isUuid(question.id) ? question : { ...question, id: createId() }),
  };
}

/** Only saved questions and metadata are cleared; unparsed/invalid work is retained. */
export function clearSavedDraft(draft: StudioDraft): StudioDraft {
  return { ...emptyStudioDraft(draft.context), input: draft.input, problems: draft.problems };
}

/** Append imports; a repair replaces only its own unresolved block. */
export function appendParsedBatch(
  draft: StudioDraft,
  result: ParseResult,
  createId: () => string,
  repairedProblemId?: string,
): StudioDraft {
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
