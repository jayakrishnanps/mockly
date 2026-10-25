import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { attempts, tests } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

test("result score history uses only the person's completed attempts on the same mock", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  const otherMockId = randomUUID();
  await database.insert(tests).values([mockId, otherMockId].map((id) => ({
    id, title: "Progress mock", forUsers: ["JK", "HE"], marksCorrect: "2",
  })));
  const store = createAttemptStore(database);
  const firstId = "00000000-0000-4000-8000-000000000001";
  const secondId = "00000000-0000-4000-8000-000000000002";
  const latestId = randomUUID();
  const heId = randomUUID();

  async function completed(id, values = {}) {
    await database.insert(attempts).values({
      id, testId: mockId, takenBy: "JK", submittedAt: "2026-10-20T10:00:00Z",
      score: "12", correctCount: 6, wrongCount: 2, skippedCount: 2,
      timeTakenSeconds: 125,
      answers: { version: 1, marksCorrect: "3", questions: "not transferred" },
      ...values,
    });
  }

  await completed(latestId, { submittedAt: "2026-10-23T10:00:00Z", score: "-0.50", correctCount: 0, wrongCount: 1, skippedCount: 0, answers: [], timeTakenSeconds: null });
  await completed(secondId);
  await completed(firstId, { score: "8", correctCount: 4, wrongCount: 0, skippedCount: 1, answers: { version: 1, marksCorrect: "2" }, timeTakenSeconds: 0 });
  await completed(heId, { takenBy: "HE", score: "20" });
  await completed(randomUUID(), { testId: otherMockId, score: "18" });
  await completed(randomUUID(), { submittedAt: null });

  const history = await store.getMockScoreHistory(mockId, "JK");
  assert.deepEqual(history.map(({ id }) => id), [firstId, secondId, latestId]);
  assert.equal(history[0].submittedAt, "2026-10-20T10:00:00.000Z");
  assert.deepEqual(history.map(({ score, maxScore }) => ({ score, maxScore })), [
    { score: 8, maxScore: 10 }, { score: 12, maxScore: 30 }, { score: -0.5, maxScore: 2 },
  ]);
  assert.deepEqual(history.map(({ timeTakenSeconds }) => timeTakenSeconds), [0, 125, null]);
  assert.deepEqual(Object.keys(history[0]).sort(), ["id", "maxScore", "score", "submittedAt", "timeTakenSeconds"]);
  assert.ok(history.every(({ submittedAt }) => Number.isFinite(Date.parse(submittedAt))));
  const heHistory = await store.getMockScoreHistory(mockId, "HE");
  assert.deepEqual(heHistory.map(({ id }) => id), [heId]);
  assert.deepEqual(Object.keys(heHistory[0]).sort(), ["id", "maxScore", "score", "submittedAt"]);
  assert.deepEqual(await store.getMockScoreHistory(randomUUID(), "JK"), []);
});

test("result score history treats invalid stored elapsed time as unavailable without dropping the score", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Elapsed time validation", forUsers: ["JK"] });
  const invalidTimeId = randomUUID();
  await database.insert(attempts).values({
    id: invalidTimeId, testId: mockId, takenBy: "JK", submittedAt: "2026-10-25T10:00:00Z",
    score: "2", correctCount: 1, wrongCount: 0, skippedCount: 0, answers: [], timeTakenSeconds: -1,
  });

  const history = await createAttemptStore(database).getMockScoreHistory(mockId, "JK");
  assert.equal(history.length, 1);
  assert.equal(history[0].id, invalidTimeId);
  assert.equal(history[0].timeTakenSeconds, null);
  assert.equal(history[0].score, 2);
});

test("result score history rejects invalid input and omits incomplete summaries", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Progress validation", forUsers: ["JK"] });
  const store = createAttemptStore(database);
  await assert.rejects(store.getMockScoreHistory("not-an-id", "JK"), { code: "invalid" });
  await assert.rejects(store.getMockScoreHistory(mockId, "OTHER"), { code: "invalid" });

  for (const values of [
    { score: null }, { correctCount: null }, { wrongCount: -1 },
    { correctCount: 0, wrongCount: 0, skippedCount: 0 },
    { answers: { version: 1, marksCorrect: "not-a-number" } },
    { answers: { version: 1, marksCorrect: "0" } },
  ]) {
    await database.insert(attempts).values({
      id: randomUUID(), testId: mockId, takenBy: "JK", submittedAt: "2026-10-25T10:00:00Z",
      score: "2", correctCount: 1, wrongCount: 0, skippedCount: 0, answers: [], ...values,
    });
  }
  assert.deepEqual(await store.getMockScoreHistory(mockId, "JK"), []);
});
