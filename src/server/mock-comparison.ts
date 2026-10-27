import { and, arrayContains, asc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { db } from "../db/index";
import { attempts, tests } from "../db/schema.ts";
import type { MockComparison } from "../lib/mock-comparison.ts";
import { isUuid } from "../lib/mock-validation.ts";
import { isUser, type User } from "../lib/users.ts";

const snapshotMarksCorrect = sql<string | null>`case
  when jsonb_typeof(${attempts.answers} -> 'marksCorrect') = 'string'
  then ${attempts.answers} ->> 'marksCorrect'
  else null
end`;

export async function getSharedMockComparison(database: typeof db, attemptId: string, user: User): Promise<MockComparison | null> {
  if (!isUuid(attemptId) || !isUser(user)) return null;

  return database.transaction(async (tx) => {
    const [mock] = await tx.select({ testId: tests.id, marksCorrect: tests.marksCorrect })
      .from(attempts).innerJoin(tests, eq(attempts.testId, tests.id))
      .where(and(
        eq(attempts.id, attemptId),
        eq(attempts.takenBy, user),
        isNotNull(attempts.submittedAt),
        isNull(tests.deletedAt),
        arrayContains(tests.forUsers, ["JK", "HE"]),
      ));
    if (!mock) return null;

    const rows = await tx.select({
      id: attempts.id,
      takenBy: attempts.takenBy,
      submittedAt: attempts.submittedAt,
      score: attempts.score,
      timeTakenSeconds: attempts.timeTakenSeconds,
      correctCount: attempts.correctCount,
      wrongCount: attempts.wrongCount,
      skippedCount: attempts.skippedCount,
      snapshotMarksCorrect,
    }).from(attempts).where(and(
      eq(attempts.testId, mock.testId),
      inArray(attempts.takenBy, ["JK", "HE"]),
      isNotNull(attempts.submittedAt),
    )).orderBy(asc(attempts.submittedAt), asc(attempts.id));

    const comparison: MockComparison = { JK: [], HE: [] };
    for (const row of rows) {
      if (!isUser(row.takenBy) || !row.submittedAt || row.score === null) continue;
      const counts = [row.correctCount, row.wrongCount, row.skippedCount];
      if (counts.some((count) => count === null || !Number.isSafeInteger(count) || count < 0)) continue;
      const questionCount = (row.correctCount ?? 0) + (row.wrongCount ?? 0) + (row.skippedCount ?? 0);
      const maxScore = questionCount * Number(row.snapshotMarksCorrect ?? mock.marksCorrect);
      const score = Number(row.score);
      const timestamp = Date.parse(row.submittedAt);
      if (!Number.isSafeInteger(questionCount) || questionCount <= 0 || !Number.isFinite(maxScore) || maxScore <= 0 ||
          !Number.isFinite(score) || !Number.isFinite(timestamp)) continue;

      const history = comparison[row.takenBy];
      history.push({
        id: row.id,
        attemptNumber: history.length + 1,
        submittedAt: new Date(timestamp).toISOString(),
        score,
        maxScore,
        timeTakenSeconds: row.timeTakenSeconds !== null && Number.isSafeInteger(row.timeTakenSeconds) && row.timeTakenSeconds >= 0
          ? row.timeTakenSeconds
          : null,
      });
    }
    return comparison;
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}
