import { isRecord, isUuid, validateMetadata, validateSaveInput } from "./mock-validation.ts";
import type { MetadataErrors, QuestionInput, SavedMetadata } from "./mock-validation";

export const BANK_PAGE_SIZE = 25;
export type BankTitleInput = { id: string; title: string };
export type BankAppendInput = { bankId: string; questions: QuestionInput[] };
export type BankMockInput = {
  bankId: string;
  testId: string;
  metadata: SavedMetadata;
  questionLimit: number;
};
type Validation<T> = { value: T } | { value: null; error: string; fields?: MetadataErrors };

export function validateBankTitle(input: unknown): Validation<BankTitleInput> {
  if (!isRecord(input) || !isUuid(input.id)) {
    return { value: null, error: "This bank request is invalid. Reload and try again." };
  }
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title || title.length > 200) {
    return { value: null, error: "Enter a bank name between 1 and 200 characters." };
  }
  return { value: { id: input.id.toLowerCase(), title } };
}

export function validateBankAppend(input: unknown): Validation<BankAppendInput> {
  if (!isRecord(input) || !isUuid(input.bankId)) {
    return { value: null, error: "This bank request is invalid. Reload and try again." };
  }
  const checked = validateSaveInput({ mode: "append", testId: input.bankId, questions: input.questions });
  if (!checked.value) return checked;
  return { value: { bankId: checked.value.testId, questions: checked.value.questions } };
}

export function validateBankMock(input: unknown): Validation<BankMockInput> {
  if (!isRecord(input) || !isUuid(input.bankId) || !isUuid(input.testId)) {
    return { value: null, error: "This mock request is invalid. Reload and try again." };
  }
  const metadata = validateMetadata(input.metadata);
  if (!metadata.value) return { value: null, error: "Check the mock information.", fields: metadata.errors };
  const rawLimit = typeof input.questionLimit === "string" ? input.questionLimit.trim() : input.questionLimit;
  if ((typeof rawLimit !== "number" && (typeof rawLimit !== "string" || !/^\d+$/.test(rawLimit))) ||
    !Number.isInteger(Number(rawLimit)) || Number(rawLimit) < 1 || Number(rawLimit) > 2147483647) {
    return { value: null, error: "Enter a positive whole number of questions." };
  }
  const questionLimit = Number(rawLimit);
  if (questionLimit * Number(metadata.value.marksCorrect) > 9999.99 || questionLimit * Number(metadata.value.marksWrong) > 9999.99) {
    return { value: null, error: "Choose fewer questions or lower marks so the total stays within 9,999.99." };
  }
  return { value: { bankId: input.bankId.toLowerCase(), testId: input.testId.toLowerCase(), metadata: metadata.value, questionLimit } };
}
