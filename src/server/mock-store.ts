import { and, asc, count, eq, isNull, sql } from "drizzle-orm";
import { attempts, bankQuestions, questions, tests } from "../db/schema.ts";
import type { db } from "../db/index";
import type { QuestionCountResult } from "../lib/question-selection";
import type { User } from "../lib/users";

export function createMockStore(database: typeof db) {
  return {
    async get(testId: string) {
      const [mock] = await database.select().from(tests).where(and(eq(tests.id, testId), isNull(tests.deletedAt)));
      if (!mock) return null;
      if (mock.sourceBankId) {
        // Count the whole live pool while fetching only the visible preview.
        const items = await database.select({
          id: bankQuestions.id, position: bankQuestions.position, questionText: bankQuestions.questionText,
          options: bankQuestions.options, correctIndex: bankQuestions.correctIndex,
          questionCount: sql<number>`count(*) over()`.mapWith(Number),
        }).from(bankQuestions).where(eq(bankQuestions.bankId, mock.sourceBankId))
          .orderBy(asc(bankQuestions.position)).limit(25);
        return {
          ...mock,
          questionCount: items[0]?.questionCount ?? 0,
          questions: items.map(({ id, position, questionText, options, correctIndex }) => ({
            id, position, questionText, options, correctIndex,
          })),
        };
      }
      const items = await database.select().from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.position));
      return { ...mock, questionCount: items.length, questions: items };
    },

    async updateQuestionLimit(testId: string, questionLimit: unknown): Promise<QuestionCountResult> {
      if (typeof questionLimit !== "number" || !Number.isSafeInteger(questionLimit) || questionLimit < 1 || questionLimit > 2147483647) {
        return { ok: false, error: "Enter a positive whole number of questions." };
      }
      return database.transaction(async (tx): Promise<QuestionCountResult> => {
        const [mock] = await tx.select({
          forUsers: tests.forUsers, questionLimit: tests.questionLimit, sourceBankId: tests.sourceBankId,
          marksCorrect: tests.marksCorrect, marksWrong: tests.marksWrong,
        }).from(tests).where(and(eq(tests.id, testId), isNull(tests.deletedAt))).for("update");
        if (!mock) return { ok: false, error: "This mock no longer exists." };
        if (mock.forUsers.length !== 1 || mock.forUsers[0] !== "JK" || mock.questionLimit === null) {
          return { ok: false, error: "The question count can only be edited on JK’s own sampled mocks." };
        }
        const [{ available }] = mock.sourceBankId
          ? await tx.select({ available: count() }).from(bankQuestions).where(eq(bankQuestions.bankId, mock.sourceBankId))
          : await tx.select({ available: count() }).from(questions).where(eq(questions.testId, testId));
        if (available === 0) return { ok: false, error: "This mock has no questions yet." };
        if (questionLimit > available) return { ok: false, error: `Choose between 1 and ${available} questions.` };
        if (questionLimit * Math.max(Number(mock.marksCorrect), Number(mock.marksWrong)) > 9999.99) {
          return { ok: false, error: "Choose fewer questions so the total stays within 9,999.99 marks." };
        }
        if (questionLimit !== mock.questionLimit) {
          await tx.update(tests).set({ questionLimit }).where(eq(tests.id, testId));
        }
        return { ok: true, count: questionLimit };
      });
    },

    async remove(testId: string, user: User) {
      await database.transaction(async (tx) => {
        const [mock] = await tx.select({ id: tests.id, forUsers: tests.forUsers }).from(tests)
          .where(and(eq(tests.id, testId), isNull(tests.deletedAt))).for("update");
        // A repeated deletion must never remove another person's remaining copy.
        if (!mock || !mock.forUsers.includes(user)) return;
        const remainingUsers = mock.forUsers.filter((assignedUser) => assignedUser !== user);
        await tx.delete(attempts).where(and(eq(attempts.testId, testId), eq(attempts.takenBy, user)));
        if (remainingUsers.length) {
          await tx.update(tests).set({ forUsers: remainingUsers }).where(eq(tests.id, testId));
        } else {
          // The existing foreign keys also remove the last copy's questions and attempts.
          await tx.delete(tests).where(eq(tests.id, testId));
        }
      });
    },
  };
}
