import { and, asc, count, desc, eq, gt, inArray, max } from "drizzle-orm";
import type { db } from "../db/index";
import { bankQuestions, questionBanks, questions, tests } from "../db/schema.ts";
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
  if (!sameMetadata(mock, input.metadata) || mock.questionLimit !== input.questionLimit) {
    throw new BankStoreError("conflict", "This mock was already created with different information. Open it to review.");
  }
  return { id: mock.id, forUsers: mock.forUsers, alreadySaved: true };
}

/** Bank questions are copied into mocks so their lifetimes stay independent. */
export function createBankStore(database: typeof db) {
  return {
    async list(page = 1) {
      const rows = await database.select({
        id: questionBanks.id, title: questionBanks.title, createdAt: questionBanks.createdAt,
        questionCount: count(bankQuestions.id),
      }).from(questionBanks).leftJoin(bankQuestions, eq(bankQuestions.bankId, questionBanks.id))
        .groupBy(questionBanks.id).orderBy(desc(questionBanks.createdAt), asc(questionBanks.id))
        .limit(BANK_PAGE_SIZE + 1).offset(pageOffset(page));
      return { items: rows.slice(0, BANK_PAGE_SIZE), hasNext: rows.length > BANK_PAGE_SIZE };
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
        // A retry must succeed even when the source bank has since changed or been removed.
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
        const inserted = await tx.insert(tests).values({ id: input.testId, ...input.metadata, questionLimit: input.questionLimit })
          .onConflictDoNothing({ target: tests.id }).returning({ id: tests.id });
        if (!inserted.length) {
          const [mock] = await tx.select().from(tests).where(eq(tests.id, input.testId)).for("update");
          if (!mock) throw new BankStoreError("not-found", "This mock no longer exists.");
          return savedMockResult(mock, input);
        }
        // Page through the bank inside the transaction to avoid loading an unbounded bank into memory.
        let lastPosition = 0;
        for (let offset = 0; offset < questionCount; offset += 200) {
          const batch = await tx.select({
            position: bankQuestions.position,
            questionText: bankQuestions.questionText, options: bankQuestions.options, correctIndex: bankQuestions.correctIndex,
          }).from(bankQuestions).where(and(eq(bankQuestions.bankId, bank.id), gt(bankQuestions.position, lastPosition)))
            .orderBy(asc(bankQuestions.position)).limit(200);
          await tx.insert(questions).values(batch.map((question, index) => ({ ...question, testId: input.testId, position: offset + index + 1 })));
          lastPosition = batch[batch.length - 1].position;
        }
        return { id: input.testId, forUsers: input.metadata.forUsers, alreadySaved: false };
      });
    },
  };
}
