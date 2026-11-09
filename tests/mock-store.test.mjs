import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { attempts, bankQuestions, questionBanks, questions, tests } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";
import { insertLegacyMockFixture } from "./helpers/legacy-mock-fixture.mjs";

test("removing standalone creation preserves existing shared mocks and per-person history deletion", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const store = createMockStore(database);
  const testId = randomUUID();
  const question = { id: randomUUID(), questionText: "An existing question", options: ["one", "two", "three", "four"], correctIndex: 1 };
  await insertLegacyMockFixture(database, { testId, metadata: { title: "Existing shared mock", forUsers: ["JK", "HE"] }, questions: [question] });
  for (const takenBy of ["JK", "HE"]) await database.insert(attempts).values({ id: randomUUID(), testId, takenBy, submittedAt: "2026-10-28T07:00:00Z" });
  const original = await store.get(testId);
  assert.equal(original.questionCount, 1);
  assert.equal(original.questions[0].questionText, question.questionText);
  await store.remove(testId, "JK");
  await store.remove(testId, "JK");
  const remaining = await store.get(testId);
  assert.deepEqual(remaining.forUsers, ["HE"]);
  assert.deepEqual(remaining.questions, original.questions);
  assert.deepEqual((await database.select().from(attempts).where(eq(attempts.testId, testId))).map((attempt) => attempt.takenBy), ["HE"]);
  await store.remove(testId, "HE");
  assert.equal(await store.get(testId), null);
  assert.equal((await database.select().from(tests).where(eq(tests.id, testId))).length, 0);
  assert.equal((await database.select().from(questions).where(eq(questions.testId, testId))).length, 0);
  assert.equal((await database.select().from(attempts).where(eq(attempts.testId, testId))).length, 0);
});

test("editing JK’s question count uses the live pool and preserves existing attempts", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mocks = createMockStore(database);
  let clock = Date.parse("2026-11-09T05:00:00Z");
  const attemptStore = createAttemptStore(database, () => clock);
  const bankId = randomUUID();
  const [jkId, sharedId, heId, deletedId, legacyId, highMarksId] = Array.from({ length: 6 }, () => randomUUID());
  const sample = { title: "Sampled mock", sourceBankId: bankId, questionLimit: 15, forUsers: ["JK"] };
  await database.insert(questionBanks).values({ id: bankId, title: "Practice bank" });
  await database.insert(tests).values([
    { ...sample, id: jkId },
    { ...sample, id: sharedId, forUsers: ["JK", "HE"] },
    { ...sample, id: heId, forUsers: ["HE"] },
    { ...sample, id: deletedId, deletedAt: new Date(clock).toISOString() },
    { ...sample, id: legacyId, sourceBankId: null, questionLimit: null },
    { ...sample, id: highMarksId, questionLimit: 10, marksCorrect: "999.99" },
  ]);

  async function addQuestions(first, last) {
    await database.insert(bankQuestions).values(Array.from({ length: last - first + 1 }, (_, index) => ({
      id: randomUUID(), bankId, position: first + index, questionText: `Question ${first + index}`,
      options: ["Correct", "Wrong", "Option three", "Option four"], correctIndex: 0,
    })));
  }

  async function start() {
    const { attemptId } = await attemptStore.startOrResume(jkId, "JK");
    return attemptStore.getExamData(attemptId, "JK");
  }

  async function submit(exam, correctCount) {
    clock += 1000;
    const answers = exam.answers.map((answer, index) => ({
      ...answer, selectedIndex: index < correctCount ? exam.questions[index].options.indexOf("Correct") : null,
    }));
    await attemptStore.submitAttempt(exam.attemptId, "JK", answers, exam.revision);
  }

  await addQuestions(1, 15);
  assert.equal((await mocks.updateQuestionLimit(jkId, 30)).ok, false);
  const first = await start();
  assert.equal(first.questions.length, 15);
  await submit(first, 15);
  const originalResult = await attemptStore.getResult(first.attemptId, "JK");
  const active = await start();

  await addQuestions(16, 30);
  for (const id of [sharedId, heId, deletedId, legacyId, randomUUID()]) {
    assert.equal((await mocks.updateQuestionLimit(id, 30)).ok, false);
  }
  for (const invalid of [0, 31, 1.5, "30", null]) {
    assert.equal((await mocks.updateQuestionLimit(jkId, invalid)).ok, false);
  }
  assert.equal((await mocks.updateQuestionLimit(highMarksId, 11)).ok, false);
  assert.equal((await mocks.get(highMarksId)).questionLimit, 10);
  assert.equal((await mocks.get(sharedId)).questionLimit, 15);
  assert.equal((await mocks.get(heId)).questionLimit, 15);
  assert.equal((await mocks.get(jkId)).questionLimit, 15);
  assert.deepEqual(await mocks.updateQuestionLimit(jkId, 30), { ok: true, count: 30 });
  assert.deepEqual(await mocks.updateQuestionLimit(jkId, 30), { ok: true, count: 30 });
  assert.equal((await mocks.get(jkId)).questionLimit, 30);

  const savedResult = await attemptStore.getResult(first.attemptId, "JK");
  assert.deepEqual(savedResult.attempt, originalResult.attempt);
  assert.deepEqual(savedResult.questions, originalResult.questions);
  const resumed = await start();
  assert.equal(resumed.attemptId, active.attemptId);
  assert.deepEqual(resumed.questions, active.questions);
  assert.equal(resumed.questions.length, 15);
  await submit(resumed, 15);
  const next = await start();
  assert.equal(next.questions.length, 30);
  await submit(next, 15);
  const stats = await attemptStore.getMockStats(jkId, "JK");
  assert.equal(stats.bestScore, 100);
  assert.equal(stats.latestScore, 50);
  const history = await attemptStore.getMockExportData(jkId, "JK");
  assert.deepEqual(history.attempts.map((entry) => entry.questions.length), [15, 15, 30]);
});
