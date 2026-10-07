import { randomInt } from "node:crypto";
import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { attempts, questions, tests } from "../db/schema.ts";
import type { db as DbType } from "../db/index";
import { scoreAttempt, type AnswerRecord } from "../lib/scoring.ts";
import { validateAnswers } from "../lib/attempt-state.ts";
import { isRecord, isUuid } from "../lib/mock-validation.ts";
import { isUser, type User } from "../lib/users.ts";

type Database = typeof DbType;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Mock = typeof tests.$inferSelect;
type Attempt = typeof attempts.$inferSelect;
type SnapshotQuestion = Pick<typeof questions.$inferSelect, "id" | "position" | "questionText" | "options" | "correctIndex">;
type AttemptSnapshot = {
  version: 1; revision: number; durationMinutes: number; marksCorrect: string; marksWrong: string;
  questions: SnapshotQuestion[]; answers: AnswerRecord[];
};

export class AttemptError extends Error {
  code: "not-found" | "forbidden" | "conflict" | "expired" | "invalid" | "stale";
  constructor(code: AttemptError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function isSnapshotQuestion(value: unknown): value is SnapshotQuestion {
  return isRecord(value) && isUuid(value.id) && Number.isInteger(value.position) && Number(value.position) > 0 &&
    typeof value.questionText === "string" && Array.isArray(value.options) && value.options.length === 4 && value.options.every((option) => typeof option === "string") &&
    Number.isInteger(value.correctIndex) && Number(value.correctIndex) >= 0 && Number(value.correctIndex) <= 3;
}

async function readSnapshot(tx: Transaction, attempt: Attempt, mock: Mock): Promise<AttemptSnapshot> {
  const raw = attempt.answers;
  if (isRecord(raw) && raw.version === 1 && Array.isArray(raw.questions) && raw.questions.length && raw.questions.every(isSnapshotQuestion) &&
    Number.isInteger(raw.revision) && Number(raw.revision) >= 0 && Number.isInteger(raw.durationMinutes) && Number(raw.durationMinutes) > 0 &&
    typeof raw.marksCorrect === "string" && Number(raw.marksCorrect) > 0 && Number(raw.marksCorrect) <= 999.99 &&
    typeof raw.marksWrong === "string" && Number(raw.marksWrong) >= 0 && Number(raw.marksWrong) <= 999.99) {
    const answers = validateAnswers(raw.answers, raw.questions.map((q) => q.id));
    if (answers) return {
      version: 1, revision: Number(raw.revision), durationMinutes: Number(raw.durationMinutes),
      marksCorrect: raw.marksCorrect, marksWrong: raw.marksWrong, questions: raw.questions, answers,
    };
  }
  // Legacy arrays contain the original IDs: never replace them with today's full list.
  const answers = validateAnswers(raw);
  if (answers?.length) {
    const rows = await tx.select().from(questions).where(eq(questions.testId, mock.id)).orderBy(asc(questions.position));
    const original = rows.filter((q) => answers.some((answer) => answer.questionId === q.id));
    if (original.length === answers.length) return {
      version: 1, revision: 0, durationMinutes: mock.durationMinutes,
      marksCorrect: mock.marksCorrect, marksWrong: mock.marksWrong,
      questions: original, answers: original.map((q) => answers.find((answer) => answer.questionId === q.id)!),
    };
  }
  throw new AttemptError("invalid", "This attempt's saved data is incomplete. It has not been changed.");
}

function mergeAnswers(snapshot: AttemptSnapshot, incoming: unknown, elapsedMs: number): AnswerRecord[] {
  const answers = validateAnswers(incoming, snapshot.questions.map((q) => q.id));
  if (!answers) throw new AttemptError("invalid", "Invalid answer data. Every question must belong to this attempt and appear exactly once.");
  const savedTime = snapshot.answers.reduce((sum, answer) => sum + answer.timeSpentMs, 0);
  const extraTime = answers.map((answer, index) => Math.max(0, answer.timeSpentMs - snapshot.answers[index].timeSpentMs));
  const requested = extraTime.reduce((sum, time) => sum + time, 0);
  const available = Math.max(0, elapsedMs - savedTime);
  const scale = requested > available ? available / requested : 1;
  return answers.map((answer, index) => ({
    ...answer, timeSpentMs: snapshot.answers[index].timeSpentMs + Math.floor(extraTime[index] * scale),
  }));
}

export function createAttemptStore(database: Database, now: () => number = Date.now) {
  async function owned(tx: Transaction, attemptId: string, user: User) {
    if (!isUuid(attemptId) || !isUser(user)) throw new AttemptError("invalid", "Invalid attempt request.");
    const [attempt] = await tx.select().from(attempts).where(eq(attempts.id, attemptId)).for("update");
    if (!attempt) throw new AttemptError("not-found", "Attempt not found.");
    if (attempt.takenBy !== user) throw new AttemptError("forbidden", "This attempt belongs to another user.");
    const [mock] = await tx.select().from(tests).where(eq(tests.id, attempt.testId));
    if (!mock) throw new AttemptError("not-found", "This mock no longer exists.");
    return { attempt, mock };
  }

  async function finish(tx: Transaction, attempt: Attempt, snapshot: AttemptSnapshot, timestamp: number) {
    const elapsedMs = Math.max(0, Math.min(timestamp - Date.parse(attempt.startedAt), snapshot.durationMinutes * 60000));
    const result = scoreAttempt({
      marksCorrect: Number(snapshot.marksCorrect), marksWrong: Number(snapshot.marksWrong),
      correctIndexes: new Map(snapshot.questions.map((q) => [q.id, q.correctIndex])), answers: snapshot.answers,
    });
    await tx.update(attempts).set({
      submittedAt: new Date(timestamp).toISOString(), timeTakenSeconds: Math.round(elapsedMs / 1000),
      score: result.score.toFixed(2), correctCount: result.correctCount, wrongCount: result.wrongCount,
      skippedCount: result.skippedCount, answers: { ...snapshot, revision: snapshot.revision + 1 },
    }).where(eq(attempts.id, attempt.id));
  }

  async function getExamData(attemptId: string, user: User) {
    const data = await database.transaction(async (tx) => {
      const { attempt, mock } = await owned(tx, attemptId, user);
      if (attempt.submittedAt) return null;
      if (mock.deletedAt) throw new AttemptError("not-found", "This mock has been deleted.");
      if (!mock.forUsers.includes(user)) throw new AttemptError("forbidden", "This mock is not assigned to you.");
      const snapshot = await readSnapshot(tx, attempt, mock);
      const timestamp = now();
      const expiresMs = Date.parse(attempt.startedAt) + snapshot.durationMinutes * 60000;
      if (timestamp >= expiresMs) {
        await finish(tx, attempt, snapshot, timestamp);
        return null;
      }
      return {
        attemptId, testId: mock.id, mockTitle: mock.title, user,
        expiresAt: new Date(expiresMs).toISOString(), serverNow: timestamp, revision: snapshot.revision,
        // Allowlist only. The private snapshot and correctIndex remain on the server.
        questions: snapshot.questions.map(({ id, position, questionText, options }) => ({ id, position, questionText, options })),
        answers: snapshot.answers,
      };
    });
    if (!data) throw new AttemptError("conflict", "This attempt has been submitted.");
    return data;
  }

  return {
    async startOrResume(testId: string, user: User) {
      if (!isUuid(testId) || !isUser(user)) throw new AttemptError("invalid", "Invalid start request.");
      return database.transaction(async (tx) => {
        // Coordinates duplicate starts with Studio's append/delete operations.
        const [mock] = await tx.select().from(tests).where(eq(tests.id, testId)).for("update");
        if (!mock || mock.deletedAt) throw new AttemptError("not-found", "This mock does not exist.");
        if (!mock.forUsers.includes(user)) throw new AttemptError("forbidden", "This mock is not assigned to you.");
        const [active] = await tx.select({ id: attempts.id }).from(attempts)
          .where(and(eq(attempts.testId, testId), eq(attempts.takenBy, user), isNull(attempts.submittedAt)))
          .orderBy(desc(attempts.startedAt)).limit(1);
        if (active) return { attemptId: active.id, resumed: true };
        const rows = await tx.select().from(questions).where(eq(questions.testId, testId)).orderBy(asc(questions.position));
        if (!rows.length) throw new AttemptError("conflict", "This mock has no questions yet.");
        if (rows.length * Math.max(Number(mock.marksCorrect), Number(mock.marksWrong)) > 9999.99) {
          throw new AttemptError("invalid", "This marking scheme exceeds the existing score column's supported range.");
        }
        const [previous] = await tx.select({ answers: attempts.answers }).from(attempts)
          .where(and(eq(attempts.testId, testId), eq(attempts.takenBy, user), isNotNull(attempts.submittedAt)))
          .orderBy(desc(attempts.submittedAt), desc(attempts.id)).limit(1);
        const previousAnswers = previous?.answers;
        const previousOrder = isRecord(previousAnswers) && Array.isArray(previousAnswers.questions) && previousAnswers.questions.every(isSnapshotQuestion)
          ? previousAnswers.questions.map((q) => q.id)
          : validateAnswers(previousAnswers)?.map((answer) => answer.questionId) ?? rows.map((q) => q.id);

        // Shuffle once, then persist this order for navigation, recovery and results.
        const ordered = [...rows];
        for (let index = ordered.length - 1; index > 0; index--) {
          const swapIndex = randomInt(index + 1);
          [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
        }
        // A small mock can randomly repeat its last order; avoid that where possible.
        if (ordered.length > 1 && ordered.length === previousOrder.length && ordered.every((q, index) => q.id === previousOrder[index])) {
          const swapIndex = randomInt(1, ordered.length);
          [ordered[0], ordered[swapIndex]] = [ordered[swapIndex], ordered[0]];
        }
        const snapshot: AttemptSnapshot = {
          version: 1, revision: 0, durationMinutes: mock.durationMinutes, marksCorrect: mock.marksCorrect, marksWrong: mock.marksWrong,
          questions: ordered.map(({ id, questionText, options, correctIndex }, index) => ({ id, position: index + 1, questionText, options, correctIndex })),
          answers: ordered.map((q) => ({ questionId: q.id, selectedIndex: null, timeSpentMs: 0, markedForReview: false, visited: false })),
        };
        const [created] = await tx.insert(attempts).values({ testId, takenBy: user, startedAt: new Date(now()).toISOString(), answers: snapshot }).returning({ id: attempts.id });
        return { attemptId: created.id, resumed: false };
      });
    },
    getExamData,
    getActiveAttempt: getExamData,

    async saveProgress(attemptId: string, user: User, answers: unknown, revision: number) {
      return database.transaction(async (tx) => {
        const { attempt, mock } = await owned(tx, attemptId, user);
        if (attempt.submittedAt) return { submitted: true, revision };
        if (mock.deletedAt) throw new AttemptError("not-found", "This mock has been deleted.");
        if (!mock.forUsers.includes(user)) throw new AttemptError("forbidden", "This mock is not assigned to you.");
        const snapshot = await readSnapshot(tx, attempt, mock);
        const elapsedMs = Math.max(0, now() - Date.parse(attempt.startedAt));
        if (elapsedMs >= snapshot.durationMinutes * 60000) {
          await finish(tx, attempt, snapshot, now());
          return { submitted: true, revision: snapshot.revision + 1 };
        }
        if (revision !== snapshot.revision) throw new AttemptError("stale", "This attempt changed in another tab. Reload to use the latest server progress; your local recovery copy is kept.");
        const next = { ...snapshot, revision: revision + 1, answers: mergeAnswers(snapshot, answers, elapsedMs) };
        await tx.update(attempts).set({ answers: next }).where(eq(attempts.id, attemptId));
        return { submitted: false, revision: next.revision };
      });
    },

    async submitAttempt(attemptId: string, user: User, answers?: unknown, revision?: number) {
      return database.transaction(async (tx) => {
        const { attempt, mock } = await owned(tx, attemptId, user);
        if (attempt.submittedAt) return { attemptId, testId: attempt.testId };
        if (mock.deletedAt) throw new AttemptError("not-found", "This mock has been deleted.");
        if (!mock.forUsers.includes(user)) throw new AttemptError("forbidden", "This mock is not assigned to you.");
        const snapshot = await readSnapshot(tx, attempt, mock);
        const timestamp = now();
        const elapsedMs = Math.max(0, timestamp - Date.parse(attempt.startedAt));
        // At the deadline, only progress already accepted by the server can be scored.
        if (elapsedMs < snapshot.durationMinutes * 60000 && answers !== undefined) {
          if (revision !== snapshot.revision) throw new AttemptError("stale", "This attempt changed in another tab. Reload before submitting.");
          snapshot.answers = mergeAnswers(snapshot, answers, elapsedMs);
        }
        await finish(tx, attempt, snapshot, timestamp);
        return { attemptId, testId: attempt.testId };
      });
    },

    async getResult(attemptId: string, user: User) {
      return database.transaction(async (tx) => {
        const { attempt, mock } = await owned(tx, attemptId, user);
        if (!attempt.submittedAt) return null;
        const snapshot = await readSnapshot(tx, attempt, mock);
        const scores = await tx.select({ score: attempts.score }).from(attempts)
          .where(and(eq(attempts.testId, mock.id), isNotNull(attempts.submittedAt)));
        return {
          attempt: { ...attempt, answers: snapshot.answers },
          mock: { ...mock, marksCorrect: snapshot.marksCorrect, marksWrong: snapshot.marksWrong, durationMinutes: snapshot.durationMinutes },
          questions: snapshot.questions, allScores: scores.map((row) => Number(row.score)),
        };
      });
    },

    async getUserHistory(user: User) {
      const rows = await database.select({
        id: attempts.id, testId: attempts.testId, submittedAt: attempts.submittedAt,
        timeTakenSeconds: attempts.timeTakenSeconds, score: attempts.score, correctCount: attempts.correctCount,
        wrongCount: attempts.wrongCount, skippedCount: attempts.skippedCount, answers: attempts.answers,
        mockTitle: tests.title, marksCorrect: tests.marksCorrect,
      }).from(attempts).innerJoin(tests, eq(attempts.testId, tests.id))
        .where(and(eq(attempts.takenBy, user), isNotNull(attempts.submittedAt))).orderBy(desc(attempts.submittedAt), desc(attempts.id));
      return rows.map(({ answers, ...row }) => ({
        ...row, marksCorrect: isRecord(answers) && typeof answers.marksCorrect === "string" ? answers.marksCorrect : row.marksCorrect,
        totalQuestions: (row.correctCount ?? 0) + (row.wrongCount ?? 0) + (row.skippedCount ?? 0),
      }));
    },

    async clearUserHistory(user: User) {
      if (!isUser(user)) throw new AttemptError("invalid", "Invalid history request.");
      await database.delete(attempts)
        .where(and(eq(attempts.takenBy, user), isNotNull(attempts.submittedAt)));
    },

    async getMockExportData(testId: string, user: User) {
      if (!isUuid(testId) || !isUser(user)) throw new AttemptError("invalid", "Invalid export request.");
      return database.transaction(async (tx) => {
        const [mock] = await tx.select().from(tests)
          .where(and(eq(tests.id, testId), isNull(tests.deletedAt)));
        if (!mock || !mock.forUsers.includes(user)) return null;
        const submitted = await tx.select().from(attempts)
          .where(and(eq(attempts.testId, testId), eq(attempts.takenBy, user), isNotNull(attempts.submittedAt)))
          .orderBy(asc(attempts.submittedAt), asc(attempts.id));
        if (!submitted.length) return null;
        const entries = [];
        for (const attempt of submitted) {
          const snapshot = await readSnapshot(tx, attempt, mock);
          entries.push({
            attempt: { ...attempt, answers: snapshot.answers },
            questions: snapshot.questions, durationMinutes: snapshot.durationMinutes,
            marksCorrect: snapshot.marksCorrect, marksWrong: snapshot.marksWrong,
          });
        }
        const scores = await tx.select({ score: attempts.score }).from(attempts)
          .where(and(eq(attempts.testId, testId), isNotNull(attempts.submittedAt)));
        return { mock, attempts: entries, allScores: scores.map((row) => Number(row.score)) };
      }, { isolationLevel: "repeatable read", accessMode: "read only" });
    },

    async getActiveAttempts(user: User) {
      return database.select({ id: attempts.id, testId: attempts.testId, startedAt: attempts.startedAt, mockTitle: tests.title })
        .from(attempts).innerJoin(tests, eq(attempts.testId, tests.id))
        .where(and(eq(attempts.takenBy, user), isNull(attempts.submittedAt), isNull(tests.deletedAt))).orderBy(desc(attempts.startedAt));
    },

    async getMockStats(testId: string, user: User) {
      const submitted = await database.select().from(attempts)
        .where(and(eq(attempts.testId, testId), eq(attempts.takenBy, user), isNotNull(attempts.submittedAt)))
        .orderBy(desc(attempts.submittedAt), desc(attempts.id));
      if (!submitted.length) return null;
      const scores = submitted.map((row) => Number(row.score));
      return {
        totalAttempts: submitted.length, bestScore: Math.max(...scores), latestScore: scores[0],
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        bestAccuracy: Math.max(...submitted.map((row) => {
          const count = (row.correctCount ?? 0) + (row.wrongCount ?? 0);
          return count ? (row.correctCount ?? 0) / count * 100 : 0;
        })),
        avgTime: Math.round(submitted.reduce((sum, row) => sum + (row.timeTakenSeconds ?? 0), 0) / submitted.length),
      };
    },
  };
}
