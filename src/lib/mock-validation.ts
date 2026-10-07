import type { questions, tests } from "../db/schema";
import { isUser, USERS, type User } from "./users.ts";

export type MockMetadata = {
  title: string;
  details: string;
  forUsers: User[];
  durationMinutes: string;
  marksCorrect: string;
  marksWrong: string;
};
export type MetadataErrors = Partial<Record<keyof MockMetadata, string>>;
export type SavedMetadata = Pick<typeof tests.$inferSelect,
  "title" | "details" | "forUsers" | "durationMinutes" | "marksCorrect" | "marksWrong">;
export type QuestionInput = Pick<typeof questions.$inferInsert, "questionText" | "options" | "correctIndex"> & { id: string };
type SaveQuestions = {
  testId: string;
  questions: QuestionInput[];
};
export type SaveInput = SaveQuestions & (
  | { mode: "create"; metadata: SavedMetadata }
  | { mode: "append" }
);
type SaveValidation =
  | { value: SaveInput }
  | { value: null; error: string; fields?: MetadataErrors };

export function defaultMetadata(): MockMetadata {
  return { title: "", details: "", forUsers: [], durationMinutes: "60", marksCorrect: "2", marksWrong: "0.5" };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

// Drafts may contain incomplete (invalid) fields, but must have a safe shape.
export function isMetadata(value: unknown): value is MockMetadata {
  return isRecord(value) && ["title", "details", "durationMinutes", "marksCorrect", "marksWrong"].every((key) => typeof value[key] === "string") &&
    Array.isArray(value.forUsers) && value.forUsers.every(isUser) &&
    value.forUsers.length <= USERS.length && new Set(value.forUsers).size === value.forUsers.length;
}

function isAssignment(value: unknown): value is User[] {
  return Array.isArray(value) && value.length > 0 && value.length <= USERS.length &&
    value.every(isUser) && new Set(value).size === value.length;
}

export function validateMetadata(input: unknown): { value: SavedMetadata | null; errors: MetadataErrors } {
  const value = isRecord(input) ? input : {};
  const errors: MetadataErrors = {};
  const title = typeof value.title === "string" ? value.title.trim() : "";
  const details = typeof value.details === "string" ? value.details.trim() : "";
  if (!title) errors.title = "Enter a title.";
  else if (title.length > 200) errors.title = "Keep the title within 200 characters.";
  if (typeof value.details !== "string" || details.length > 10000) errors.details = "Keep details within 10,000 characters.";
  const users = isAssignment(value.forUsers) ? value.forUsers : null;
  if (!users) {
    errors.forUsers = "Select JK, HE, or both.";
  }
  const duration = value.durationMinutes;
  if (typeof duration !== "string" || !/^\d+$/.test(duration.trim()) || Number(duration) < 1 || Number(duration) > 2147483647) {
    errors.durationMinutes = "Enter a positive whole number of minutes.";
  }
  for (const field of ["marksCorrect", "marksWrong"] as const) {
    const mark = value[field];
    if (typeof mark !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(mark.trim()) || Number(mark) > 999.99 ||
      (field === "marksCorrect" ? Number(mark) <= 0 : Number(mark) < 0)) {
      errors[field] = field === "marksCorrect"
        ? "Enter marks above 0, up to 999.99 (at most two decimal places)."
        : "Enter a deduction from 0 to 999.99 (at most two decimal places).";
    }
  }
  if (Object.keys(errors).length || !users) return { value: null, errors };
  return { value: {
    title, details: details || null, forUsers: USERS.filter((user) => users.includes(user)),
    durationMinutes: Number(duration), marksCorrect: Number(value.marksCorrect).toFixed(2), marksWrong: Number(value.marksWrong).toFixed(2),
  }, errors };
}

export function validateSaveInput(input: unknown): SaveValidation {
  if (!isRecord(input) || (input.mode !== "create" && input.mode !== "append") || !isUuid(input.testId)) {
    return { value: null, error: "This save request is invalid. Reload Studio and try again." };
  }
  if (!Array.isArray(input.questions) || !input.questions.length) return { value: null, error: "Add at least one valid question before saving." };
  const valid: QuestionInput[] = [];
  for (const question of input.questions) {
    if (!isRecord(question) || !isUuid(question.id) || typeof question.questionText !== "string" || !question.questionText.trim() ||
      !Array.isArray(question.options) || question.options.length !== 4 || !question.options.every((option) => typeof option === "string" && option.trim()) ||
      !Number.isInteger(question.correctIndex) || Number(question.correctIndex) < 0 || Number(question.correctIndex) > 3) {
      return { value: null, error: "Every saved question needs text, four nonempty options, and a correct answer from A to D." };
    }
    valid.push({ id: question.id.toLowerCase(), questionText: question.questionText, options: question.options, correctIndex: Number(question.correctIndex) });
  }
  if (new Set(valid.map((question) => question.id)).size !== valid.length) return { value: null, error: "Duplicate question IDs were found. Reload Studio and try again." };
  const batch = { testId: input.testId.toLowerCase(), questions: valid };
  if (input.mode === "append") return { value: { mode: "append", ...batch } };

  const metadata = validateMetadata(input.metadata);
  if (!metadata.value) return { value: null, error: "Check the mock information above.", fields: metadata.errors };
  return { value: { mode: "create", ...batch, metadata: metadata.value } };
}
