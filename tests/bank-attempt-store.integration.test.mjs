import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";

test("bank mock attempts select once and preserve score meaning across lengths", { skip: process.env.MOCKLY_INTEGRATION_TESTS !== "1" }, async (t) => {
  config({ path: ".env.local", quiet: true });
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });
  const db = drizzle(pool);
  const bankMockId = randomUUID();
  const ordinaryMockId = randomUUID();
  const highMarksMockId = randomUUID();
  const ids = [bankMockId, ordinaryMockId, highMarksMockId];
  let clock = Date.now();
  const store = createAttemptStore(db, () => clock);
  t.after(async () => {
    try { await db.delete(schema.tests).where(inArray(schema.tests.id, ids)); }
    finally { await pool.end(); }
  });
  await db.insert(schema.tests).values([
    { id: bankMockId, title: `[Bank attempt verification] ${bankMockId}`, forUsers: ["JK", "HE"], durationMinutes: 20, questionLimit: 30 },
    { id: ordinaryMockId, title: `[Ordinary attempt verification] ${ordinaryMockId}`, forUsers: ["JK"], durationMinutes: 20 },
    { id: highMarksMockId, title: `[Bank score verification] ${highMarksMockId}`, forUsers: ["JK"], durationMinutes: 20, questionLimit: 3, marksCorrect: "300" },
  ]);
  for (const [testId, count] of [[bankMockId, 60], [ordinaryMockId, 4], [highMarksMockId, 40]]) {
    await db.insert(schema.questions).values(Array.from({ length: count }, (_, index) => ({
      id: randomUUID(), testId, position: index + 1,
      questionText: `Question ${index + 1}`, options: ["Correct", "B", "C", "D"], correctIndex: 0,
    })));
  }

  let first;
  await t.test("default count and concurrent starts produce one immutable selection", async () => {
    const starts = await Promise.all([store.startOrResume(bankMockId, "JK"), store.startOrResume(bankMockId, "JK")]);
    assert.equal(starts[0].attemptId, starts[1].attemptId);
    first = await store.getExamData(starts[0].attemptId, "JK");
    assert.equal(first.questions.length, 30);
    assert.equal(new Set(first.questions.map((question) => question.id)).size, 30);
    assert.deepEqual(first.questions.map((question) => question.position), Array.from({ length: 30 }, (_, index) => index + 1));
    assert.equal(JSON.stringify(first).includes("correctIndex"), false);
    assert.equal(Date.parse(first.expiresAt) - first.serverNow, 20 * 60000);
    const resumed = await store.startOrResume(bankMockId, "JK", 45);
    assert.equal(resumed.attemptId, first.attemptId);
    assert.equal(resumed.resumed, true);
    assert.deepEqual((await store.getExamData(first.attemptId, "JK")).questions, first.questions);
  });

  await t.test("scores and historical questions use only the selected snapshot", async () => {
    clock += 1000;
    await store.submitAttempt(first.attemptId, "JK", first.answers.map((answer) => ({ ...answer, selectedIndex: 0 })), first.revision);
    const result = await store.getResult(first.attemptId, "JK");
    assert.equal(result.attempt.score, "60.00");
    assert.equal(result.questions.length, 30);
    assert.deepEqual(result.allScores, []);
    await db.update(schema.tests).set({ marksCorrect: "4" }).where(eq(schema.tests.id, bankMockId));
    const started = await store.startOrResume(bankMockId, "JK", 10);
    const shorter = await store.getExamData(started.attemptId, "JK");
    assert.equal(shorter.questions.length, 10);
    clock += 1000;
    await store.submitAttempt(shorter.attemptId, "JK", shorter.answers.map((answer, index) => ({ ...answer, selectedIndex: index < 5 ? 0 : null })), shorter.revision);
    const stats = await store.getMockStats(bankMockId, "JK");
    assert.equal(stats.scoreIsPercent, true);
    assert.equal(stats.bestScore, 100);
    assert.equal(stats.latestScore, 50);
    assert.equal(stats.avgScore, 75);
    assert.equal((await store.getResult(first.attemptId, "JK")).mock.marksCorrect, "2.00");
    const exported = await store.getMockExportData(bankMockId, "JK");
    assert.deepEqual(exported.attempts.map((entry) => entry.questions.length), [30, 10]);
    assert.deepEqual(exported.allScores, []);
  });

  await t.test("invalid counts are rejected at the store boundary and HE can choose a count", async () => {
    for (const count of [0, 61, 1.5, "30", null]) {
      await assert.rejects(store.startOrResume(bankMockId, "JK", count), { code: "invalid" });
    }
    const he = await store.startOrResume(bankMockId, "HE", 45);
    assert.equal((await store.getExamData(he.attemptId, "HE")).questions.length, 45);
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
