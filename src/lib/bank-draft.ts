import { defaultMetadata, isMetadata, isRecord, isUuid, type MockMetadata, type QuestionInput } from "./mock-validation.ts";
import { emptyQuestionDraft, isQuestionDraft, STORAGE_WARNING, type QuestionDraft, type DraftQuestion } from "./question-draft.ts";

type DraftStorage = Pick<Storage, "getItem" | "setItem">;
type StorageProvider = () => DraftStorage;
const browserStorage: StorageProvider = () => window.localStorage;
const unreadableDraft = "The saved form could not be read. Your next edit will start a new browser draft.";
export type BankQuestionDraft = QuestionDraft & { pendingQuestionIds: string[] | null };

export function loadBankQuestions(bankId: string, getStorage = browserStorage) {
  const loaded = readDraft(`mockly:bank-questions:v1:${bankId}`, emptyQuestionDraft(bankId),
    (value): value is QuestionDraft => isQuestionDraft(value, bankId), getStorage);
  const pending = "pendingQuestionIds" in loaded.draft ? loaded.draft.pendingQuestionIds : null;
  const ids = new Set(loaded.draft.questions.map((question) => question.id));
  const validPending = Array.isArray(pending) && pending.length > 0 && pending.every((id) => isUuid(id) && ids.has(id)) && new Set(pending).size === pending.length;
  const { input, questions, problems, lastBatch } = loaded.draft;
  const draft: BankQuestionDraft = { ...emptyQuestionDraft(bankId), input, questions, problems, lastBatch, pendingQuestionIds: validPending ? pending : null };
  return { draft, storageError: loaded.storageError ?? (pending !== null && !validPending ? unreadableDraft : null) };
}

export function saveBankQuestions(bankId: string, draft: QuestionDraft | BankQuestionDraft, getStorage = browserStorage) {
  return writeDraft(`mockly:bank-questions:v1:${bankId}`, draft, getStorage);
}

export type BankFormDraft = { version: 1; id: string | null; title: string };
export type BankMockDraft = { version: 1; testId: string | null; metadata: MockMetadata; questionLimit: string };

export function emptyBankForm(): BankFormDraft {
  return { version: 1, id: null, title: "" };
}

export function emptyBankMock(title: string, questionCount: number): BankMockDraft {
  return { version: 1, testId: null, metadata: { ...defaultMetadata(), title, forUsers: ["JK"] }, questionLimit: String(Math.min(30, questionCount)) };
}

function readDraft<T>(key: string, empty: T, validate: (value: unknown) => value is T, getStorage: StorageProvider) {
  try {
    const raw = getStorage().getItem(key);
    if (raw === null) return { draft: empty, storageError: null };
    const value: unknown = JSON.parse(raw);
    if (validate(value)) return { draft: value, storageError: null };
  } catch (error) {
    if (!(error instanceof SyntaxError)) return { draft: empty, storageError: STORAGE_WARNING };
  }
  return { draft: empty, storageError: unreadableDraft };
}

function writeDraft(key: string, draft: unknown, getStorage: StorageProvider) {
  try {
    getStorage().setItem(key, JSON.stringify(draft));
    return null;
  } catch {
    return STORAGE_WARNING;
  }
}

export function loadBankForm(getStorage = browserStorage) {
  return readDraft("mockly:bank-create:v1", emptyBankForm(), (value): value is BankFormDraft =>
    isRecord(value) && value.version === 1 && (value.id === null || isUuid(value.id)) && typeof value.title === "string", getStorage);
}

export function saveBankForm(draft: BankFormDraft, getStorage = browserStorage) {
  return writeDraft("mockly:bank-create:v1", draft, getStorage);
}

export function loadBankMock(bankId: string, title: string, questionCount: number, getStorage = browserStorage) {
  return readDraft(`mockly:bank-mock:v1:${bankId}`, emptyBankMock(title, questionCount), (value): value is BankMockDraft =>
    isRecord(value) && value.version === 1 && (value.testId === null || isUuid(value.testId)) &&
    isMetadata(value.metadata) && typeof value.questionLimit === "string", getStorage);
}

export function saveBankMock(bankId: string, draft: BankMockDraft, getStorage = browserStorage) {
  return writeDraft(`mockly:bank-mock:v1:${bankId}`, draft, getStorage);
}

// Leave room for the server-action envelope below Next's request size limit.
export function nextBankBatch(questions: DraftQuestion[], maxBytes = 400_000): QuestionInput[] {
  const encoder = new TextEncoder();
  const batch: QuestionInput[] = [];
  let bytes = 2;
  for (const { id, questionText, options, correctIndex } of questions) {
    const question = { id, questionText, options, correctIndex };
    const size = encoder.encode(JSON.stringify(question)).byteLength + 1;
    if (bytes + size > maxBytes) break;
    batch.push(question);
    bytes += size;
  }
  return batch;
}

export function retryBankBatch(draft: BankQuestionDraft): QuestionInput[] {
  if (!draft.pendingQuestionIds) return nextBankBatch(draft.questions);
  const byId = new Map(draft.questions.map((question) => [question.id, question]));
  return draft.pendingQuestionIds.flatMap((id) => {
    const question = byId.get(id);
    return question ? [{ id, questionText: question.questionText, options: question.options, correctIndex: question.correctIndex }] : [];
  });
}
