import { and, asc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { attempts, bankQuestions, questions, tests } from "../db/schema.ts";
import type { db } from "../db/index";
import type { QuestionInput, SaveInput, SavedMetadata } from "../lib/mock-validation";
import type { User } from "../lib/users";

export class MockStoreError extends Error {
  code: "not-found" | "conflict";
  constructor(code: "not-found" | "conflict", message: string) {
    super(message);
    this.code = code;
  }
}

function sameQuestion(saved: typeof questions.$inferSelect, incoming: QuestionInput, testId: string) {
  return saved.testId === testId && saved.questionText === incoming.questionText &&
    saved.correctIndex === incoming.correctIndex && JSON.stringify(saved.options) === JSON.stringify(incoming.options);
}

function sameMetadata(saved: typeof tests.$inferSelect, incoming: SavedMetadata) {
  return saved.title === incoming.title && saved.details === incoming.details &&
    JSON.stringify([...saved.forUsers].sort()) === JSON.stringify([...incoming.forUsers].sort()) &&
    saved.durationMinutes === incoming.durationMinutes && Number(saved.marksCorrect) === Number(incoming.marksCorrect) &&
    Number(saved.marksWrong) === Number(incoming.marksWrong);
}

/** The connection is supplied only by the server wrapper (or opt-in database tests). */
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

    async save(input: SaveInput) {
      return database.transaction(async (tx) => {
        let created = false;
        if (input.mode === "create") {
          const inserted = await tx.insert(tests).values({ id: input.testId, ...input.metadata })
            .onConflictDoNothing({ target: tests.id }).returning({ id: tests.id });
          created = inserted.length > 0;
        }
        // Serializes appends and coordinates them with retries and deletion.
        const [mock] = await tx.select().from(tests).where(eq(tests.id, input.testId)).for("update");
        if (!mock || mock.deletedAt) throw new MockStoreError("not-found", "This mock no longer exists. Your draft has been kept.");
        if (mock.sourceBankId) throw new MockStoreError("conflict", "Add questions to this mock's question bank. New attempts will use the updated bank.");
        if (input.mode === "create" && !sameMetadata(mock, input.metadata)) {
          throw new MockStoreError("conflict", "An earlier save already created this mock with different information. Open it to review; your draft has been kept.");
        }

        const previous = await tx.select().from(questions).where(inArray(questions.id, input.questions.map((question) => question.id)));
        if (previous.length) {
          const byId = new Map(previous.map((question) => [question.id, question]));
          const first = byId.get(input.questions[0].id)?.position;
          const matches = previous.length === input.questions.length && input.questions.every((question, index) => {
            const saved = byId.get(question.id);
            return saved && sameQuestion(saved, question, input.testId) && saved.position === (input.mode === "create" ? 1 : first ?? 0) + index;
          });
          if (!matches || created) throw new MockStoreError("conflict", "Some draft questions were already saved. Open the mock to review; your draft has been kept.");
          return { id: mock.id, forUsers: mock.forUsers, alreadySaved: true };
        }
        if (input.mode === "create" && !created) throw new MockStoreError("conflict", "This mock was already saved. Open it to review; your draft has been kept.");

        const [{ highest }] = await tx.select({ highest: max(questions.position) }).from(questions).where(eq(questions.testId, mock.id));
        const start = highest ?? 0;
        // Keep inserts bounded while retaining a single all-or-nothing transaction.
        for (let offset = 0; offset < input.questions.length; offset += 200) {
          await tx.insert(questions).values(input.questions.slice(offset, offset + 200).map((question, index) => ({
            ...question, testId: mock.id, position: start + offset + index + 1,
          })));
        }
        return { id: mock.id, forUsers: mock.forUsers, alreadySaved: false };
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
