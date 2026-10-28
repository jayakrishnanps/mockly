import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { attempts, bankQuestions, questions, tests } from "../db/schema.ts";
import type { db } from "../db/index";
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
