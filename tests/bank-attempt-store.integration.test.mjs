import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";

test("bank mock attempts draw from the current bank and preserve historical snapshots", { skip: process.env.MOCKLY_INTEGRATION_TESTS !== "1" }, async (t) => {
  config({ path: ".env.local", quiet: true });
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });
  const db = drizzle(pool);
  const bankId = randomUUID();
  const bankMockId = randomUUID();
  const ordinaryMockId = randomUUID();
  const highMarksMockId = randomUUID();
  const ids = [bankMockId, ordinaryMockId, highMarksMockId];
  let clock = Date.now();
  const store = createAttemptStore(db, () => clock);
  t.after(async () => {
    try {
      await db.delete(schema.tests).where(inArray(schema.tests.id, ids));
      await db.delete(schema.questionBanks).where(eq(schema.questionBanks.id, bankId));
    }
    finally { await pool.end(); }
  });
  await db.insert(schema.questionBanks).values({ id: bankId, title: `[Attempt source verification] ${bankId}` });
  await db.insert(schema.tests).values([
    { id: bankMockId, sourceBankId: bankId, title: `[Bank attempt verification] ${bankMockId}`, forUsers: ["JK", "HE"], durationMinutes: 20, questionLimit: 30 },
    { id: ordinaryMockId, title: `[Ordinary attempt verification] ${ordinaryMockId}`, forUsers: ["JK"], durationMinutes: 20 },
    { id: highMarksMockId, title: `[Bank score verification] ${highMarksMockId}`, forUsers: ["JK"], durationMinutes: 20, questionLimit: 3, marksCorrect: "300" },
  ]);
  const bankRows = Array.from({ length: 60 }, (_, index) => ({
    id: randomUUID(), bankId, position: index + 1,
    questionText: `Bank question ${index + 1}`, options: ["Correct", "B", "C", "D"], correctIndex: 0,
  }));
  await db.insert(schema.bankQuestions).values(bankRows);
  // Leftover copied rows must never be mixed into a linked mock's current pool.
  for (const [testId, count] of [[bankMockId, 5], [ordinaryMockId, 4], [highMarksMockId, 40]]) {
    await db.insert(schema.questions).values(Array.from({ length: count }, (_, index) => ({
      id: randomUUID(), testId, position: index + 1,
      questionText: `Question ${index + 1}`, options: ["Correct", "B", "C", "D"], correctIndex: 0,
    })));
  }

  let first;
  await t.test("configured count and concurrent starts produce one immutable selection", async () => {
    const starts = await Promise.all([store.startOrResume(bankMockId, "JK"), store.startOrResume(bankMockId, "JK")]);
    assert.equal(starts[0].attemptId, starts[1].attemptId);
    first = await store.getExamData(starts[0].attemptId, "JK");
    assert.equal(first.questions.length, 30);
    assert.ok(first.questions.every((question) => bankRows.some((row) => row.id === question.id)));
    assert.equal(new Set(first.questions.map((question) => question.id)).size, 30);
    assert.deepEqual(first.questions.map((question) => question.position), Array.from({ length: 30 }, (_, index) => index + 1));
    assert.equal(JSON.stringify(first).includes("correctIndex"), false);
    assert.equal(Date.parse(first.expiresAt) - first.serverNow, 20 * 60000);
    const resumed = await store.startOrResume(bankMockId, "JK", 45);
    assert.equal(resumed.attemptId, first.attemptId);
    assert.equal(resumed.resumed, true);
    assert.deepEqual((await store.getExamData(first.attemptId, "JK")).questions, first.questions);
  });

  await t.test("new attempts see bank additions without changing or concatenating an active selection", async () => {
    const additions = Array.from({ length: 20 }, (_, index) => ({
      id: randomUUID(), bankId, position: bankRows.length + index + 1,
      questionText: `Added bank question ${index + 1}`, options: ["Correct", "B", "C", "D"], correctIndex: 0,
    }));
    await db.insert(schema.bankQuestions).values(additions);
    bankRows.push(...additions);
    const resumed = await store.startOrResume(bankMockId, "JK");
    assert.equal(resumed.attemptId, first.attemptId);
    assert.equal(resumed.resumed, true);
    assert.deepEqual((await store.getExamData(first.attemptId, "JK")).questions, first.questions);

    // Include the entire current pool so assertions do not depend on random luck.
    // The extra five would expose accidentally concatenated leftover copied rows.
    await db.update(schema.tests).set({ questionLimit: bankRows.length + 5 }).where(eq(schema.tests.id, bankMockId));
    const started = await store.startOrResume(bankMockId, "HE");
    const current = await store.getExamData(started.attemptId, "HE");
    assert.equal(current.questions.length, bankRows.length);
    assert.deepEqual(new Set(current.questions.map((question) => question.id)), new Set(bankRows.map((row) => row.id)));
    assert.deepEqual((await store.getExamData(first.attemptId, "JK")).questions, first.questions);
    clock += 1000;
    await store.submitAttempt(current.attemptId, "HE", current.answers, current.revision);
    await db.update(schema.tests).set({ questionLimit: 30 }).where(eq(schema.tests.id, bankMockId));
  });

  await t.test("scores and historical questions use only the selected snapshot", async () => {
    clock += 1000;
    await store.submitAttempt(first.attemptId, "JK", first.answers.map((answer, index) => ({ ...answer, selectedIndex: first.questions[index].options.indexOf("Correct") })), first.revision);
    const result = await store.getResult(first.attemptId, "JK");
    assert.equal(result.attempt.score, "60.00");
    assert.equal(result.questions.length, 30);
    assert.deepEqual(result.questions.map(({ correctIndex, ...question }) => {
      assert.equal(question.options[correctIndex], "Correct");
      return question;
    }), first.questions);
    assert.deepEqual(result.allScores, []);
    // Simulate historical settings to check that old attempts retain their own count and marks.
    await db.update(schema.tests).set({ marksCorrect: "4", questionLimit: 10 }).where(eq(schema.tests.id, bankMockId));
    const started = await store.startOrResume(bankMockId, "JK");
    const shorter = await store.getExamData(started.attemptId, "JK");
    assert.equal(shorter.questions.length, 10);
    clock += 1000;
    await store.submitAttempt(shorter.attemptId, "JK", shorter.answers.map((answer, index) => ({ ...answer, selectedIndex: index < 5 ? shorter.questions[index].options.indexOf("Correct") : null })), shorter.revision);
    await db.update(schema.tests).set({ questionLimit: 30 }).where(eq(schema.tests.id, bankMockId));
    const stats = await store.getMockStats(bankMockId, "JK");
    assert.equal(stats.scoreIsPercent, true);
    assert.equal(stats.bestScore, 100);
    assert.equal(stats.latestScore, 50);
    assert.equal(stats.avgScore, 75);
    assert.equal((await store.getResult(first.attemptId, "JK")).mock.marksCorrect, "2.00");
    const exported = await store.getMockExportData(bankMockId, "JK");
    assert.deepEqual(exported.attempts.map((entry) => entry.questions.length), [30, 10]);
    assert.deepEqual(exported.attempts[0].questions, result.questions);
    assert.deepEqual(exported.allScores, []);
  });

  await t.test("count overrides are rejected and HE uses the configured count", async () => {
    for (const count of [0, 10, 45, 61, 1.5, "30", null]) {
      await assert.rejects(store.startOrResume(bankMockId, "JK", count), { code: "invalid" });
    }
    await assert.rejects(store.startOrResume(bankMockId, "HE", 45), { code: "invalid" });
    const he = await store.startOrResume(bankMockId, "HE");
    assert.equal((await store.getExamData(he.attemptId, "HE")).questions.length, 30);
    await assert.rejects(store.getExamData(he.attemptId, "JK"), { code: "forbidden" });
  });

  await t.test("ordinary mocks keep all questions and score limits use the selected length", async () => {
    await assert.rejects(store.startOrResume(ordinaryMockId, "JK", 2), { code: "invalid" });
    const ordinary = await store.startOrResume(ordinaryMockId, "JK");
    assert.equal((await store.getExamData(ordinary.attemptId, "JK")).questions.length, 4);
    await assert.rejects(store.startOrResume(highMarksMockId, "JK", 40), { code: "invalid" });
    const highMarks = await store.startOrResume(highMarksMockId, "JK");
    assert.equal((await store.getExamData(highMarks.attemptId, "JK")).questions.length, 3);
  });
});
