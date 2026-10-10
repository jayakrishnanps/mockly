import { asc, count, desc, eq, inArray, max } from "drizzle-orm";
import type { db } from "../db/index";
import { bankQuestions, questionBanks, tests } from "../db/schema.ts";
import { BANK_PAGE_SIZE } from "../lib/bank-validation.ts";
import type { BankAppendInput, BankMockInput, BankTitleInput } from "../lib/bank-validation";
import type { QuestionInput, SavedMetadata } from "../lib/mock-validation";

export class BankStoreError extends Error {
  code: "not-found" | "conflict" | "invalid";
  constructor(code: "not-found" | "conflict" | "invalid", message: string) {
    super(message);
    this.code = code;
  }
}

function pageOffset(page: number) {
  if (!Number.isSafeInteger(page) || page < 1 || page > Math.floor(2147483647 / BANK_PAGE_SIZE)) {
    throw new BankStoreError("invalid", "Choose a valid page.");
  }
  return (page - 1) * BANK_PAGE_SIZE;
}

function sameQuestion(saved: typeof bankQuestions.$inferSelect, incoming: QuestionInput, bankId: string) {
  return saved.bankId === bankId && saved.questionText === incoming.questionText &&
    saved.correctIndex === incoming.correctIndex && JSON.stringify(saved.options) === JSON.stringify(incoming.options);
}

function sameMetadata(saved: typeof tests.$inferSelect, incoming: SavedMetadata) {
  return saved.title === incoming.title && saved.details === incoming.details &&
    JSON.stringify([...saved.forUsers].sort()) === JSON.stringify([...incoming.forUsers].sort()) &&
    saved.durationMinutes === incoming.durationMinutes && Number(saved.marksCorrect) === Number(incoming.marksCorrect) &&
    Number(saved.marksWrong) === Number(incoming.marksWrong);
}

function savedMockResult(mock: typeof tests.$inferSelect, input: BankMockInput) {
  if (mock.deletedAt) throw new BankStoreError("not-found", "This mock was deleted. Start a new mock to create another one.");
  if (!sameMetadata(mock, input.metadata) || mock.questionLimit !== input.questionLimit ||
      (mock.sourceBankId !== null && mock.sourceBankId !== input.bankId)) {
    throw new BankStoreError("conflict", "This mock was already created with different information. Open it to review.");
  }
  return { id: mock.id, forUsers: mock.forUsers, alreadySaved: true };
}

/** Linked mocks use the bank's current pool; attempts retain their own snapshots. */
export function createBankStore(database: typeof db) {
  return {
    async list() {
      return database.select({
        id: questionBanks.id, title: questionBanks.title, createdAt: questionBanks.createdAt,
        questionCount: count(bankQuestions.id),
      }).from(questionBanks).leftJoin(bankQuestions, eq(bankQuestions.bankId, questionBanks.id))
        .groupBy(questionBanks.id).orderBy(desc(questionBanks.createdAt), asc(questionBanks.id));
    },

    async get(bankId: string, page = 1) {
      const offset = pageOffset(page);
      return database.transaction(async (tx) => {
        const [bank] = await tx.select().from(questionBanks).where(eq(questionBanks.id, bankId));
        if (!bank) return null;
        const [{ questionCount }] = await tx.select({ questionCount: count() }).from(bankQuestions).where(eq(bankQuestions.bankId, bankId));
        const items = await tx.select().from(bankQuestions).where(eq(bankQuestions.bankId, bankId))
          .orderBy(asc(bankQuestions.position)).limit(BANK_PAGE_SIZE + 1).offset(offset);
        return { ...bank, questionCount, questions: items.slice(0, BANK_PAGE_SIZE), hasNext: items.length > BANK_PAGE_SIZE };
      }, { isolationLevel: "repeatable read", accessMode: "read only" });
    },

    async create(input: BankTitleInput) {
      return database.transaction(async (tx) => {
        const inserted = await tx.insert(questionBanks).values(input).onConflictDoNothing({ target: questionBanks.id })
          .returning({ id: questionBanks.id });
        const [bank] = await tx.select().from(questionBanks).where(eq(questionBanks.id, input.id)).for("update");
        if (!bank) throw new BankStoreError("not-found", "This bank no longer exists.");
        if (bank.title !== input.title) throw new BankStoreError("conflict", "This bank was already created with another name.");
        return { id: bank.id, alreadySaved: inserted.length === 0 };
      });
    },

    async append(input: BankAppendInput) {
      return database.transaction(async (tx) => {
        const [bank] = await tx.select({ id: questionBanks.id }).from(questionBanks).where(eq(questionBanks.id, input.bankId)).for("update");
        if (!bank) throw new BankStoreError("not-found", "This bank no longer exists. Your draft has been kept.");
        if (!input.questions.length) throw new BankStoreError("invalid", "Add at least one question.");
        const previous: (typeof bankQuestions.$inferSelect)[] = [];
        for (let offset = 0; offset < input.questions.length; offset += 200) {
          previous.push(...await tx.select().from(bankQuestions).where(inArray(bankQuestions.id,
            input.questions.slice(offset, offset + 200).map((question) => question.id))));
        }
        if (previous.length) {
          const byId = new Map(previous.map((question) => [question.id, question]));
          const first = byId.get(input.questions[0].id)?.position;
          const matches = previous.length === input.questions.length && input.questions.every((question, index) => {
            const saved = byId.get(question.id);
            return saved && sameQuestion(saved, question, bank.id) && saved.position === (first ?? 0) + index;
          });
          if (!matches) throw new BankStoreError("conflict", "Some draft questions were already saved. Open the bank to review; your draft has been kept.");
          const [{ questionCount }] = await tx.select({ questionCount: count() }).from(bankQuestions).where(eq(bankQuestions.bankId, bank.id));
          return { id: bank.id, questionCount, alreadySaved: true };
        }
        const [{ highest }] = await tx.select({ highest: max(bankQuestions.position) }).from(bankQuestions).where(eq(bankQuestions.bankId, bank.id));
        const start = highest ?? 0;
        for (let offset = 0; offset < input.questions.length; offset += 200) {
          await tx.insert(bankQuestions).values(input.questions.slice(offset, offset + 200).map((question, index) => ({
            ...question, bankId: bank.id, position: start + offset + index + 1,
          })));
        }
        const [{ questionCount }] = await tx.select({ questionCount: count() }).from(bankQuestions).where(eq(bankQuestions.bankId, bank.id));
        return { id: bank.id, questionCount, alreadySaved: false };
      });
    },

    async remove(bankId: string) {
      await database.transaction(async (tx) => {
        const [bank] = await tx.select({ id: questionBanks.id }).from(questionBanks).where(eq(questionBanks.id, bankId)).for("update");
        if (bank) await tx.delete(questionBanks).where(eq(questionBanks.id, bank.id));
      });
    },

    async createMock(input: BankMockInput) {
      return database.transaction(async (tx) => {
        // A retry returns the original mock while its source bank still exists.
        const [previous] = await tx.select().from(tests).where(eq(tests.id, input.testId)).for("update");
        if (previous) return savedMockResult(previous, input);
        const [bank] = await tx.select({ id: questionBanks.id }).from(questionBanks).where(eq(questionBanks.id, input.bankId)).for("update");
        const [concurrentSave] = await tx.select().from(tests).where(eq(tests.id, input.testId)).for("update");
        if (concurrentSave) return savedMockResult(concurrentSave, input);
        if (!bank) throw new BankStoreError("not-found", "This bank no longer exists.");
        const [{ questionCount }] = await tx.select({ questionCount: count() }).from(bankQuestions).where(eq(bankQuestions.bankId, bank.id));
        if (!Number.isInteger(input.questionLimit) || input.questionLimit < 1 || input.questionLimit > questionCount) {
          throw new BankStoreError("invalid", `Choose between 1 and ${questionCount} questions from this bank.`);
        }
        const inserted = await tx.insert(tests).values({ id: input.testId, ...input.metadata, questionLimit: input.questionLimit, sourceBankId: bank.id })
          .onConflictDoNothing({ target: tests.id }).returning({ id: tests.id });
        if (!inserted.length) {
          const [mock] = await tx.select().from(tests).where(eq(tests.id, input.testId)).for("update");
          if (!mock) throw new BankStoreError("not-found", "This mock no longer exists.");
          return savedMockResult(mock, input);
        }
        return { id: input.testId, forUsers: input.metadata.forUsers, alreadySaved: false };
      });
    },
  };
}
