import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";

test("Neon Stage 4 lifecycle and immutable historical snapshots", { skip: process.env.MOCKLY_INTEGRATION_TESTS !== "1" }, async t => {
  config({ path: ".env.local", quiet: true });
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });
  const db = drizzle(pool);
  const testId = randomUUID();
  let clock = Date.now();
  const store = createAttemptStore(db, () => clock);
  t.after(async () => { try { await db.delete(schema.tests).where(eq(schema.tests.id, testId)); } finally { await pool.end(); } });
  await db.insert(schema.tests).values({ id: testId, title: `[Stage 4 verification] ${testId}`, forUsers: ["JK"], durationMinutes: 1 });
  const rows = [0, 1, 2].map((index) => ({ id: randomUUID(), testId, position: index + 1, questionText: `Question ${index + 1}`, options: ["a", "b", "c", "d"], correctIndex: 0 }));
  await db.insert(schema.questions).values(rows);
  let id, progress;
  await t.test("assignment, concurrent start, owner checks and no active answer-key leakage", async () => {
    await assert.rejects(store.startOrResume(testId, "HE"), { code: "forbidden" });
    const [first, second] = await Promise.all([store.startOrResume(testId, "JK"), store.startOrResume(testId, "JK")]);
    assert.equal(first.attemptId, second.attemptId); id = first.attemptId;
    progress = await store.getExamData(id, "JK");
    assert.equal(JSON.stringify(progress).includes("correctIndex"), false);
    await assert.rejects(store.getExamData(id, "HE"), { code: "forbidden" });
    await assert.rejects(store.getResult(id, "HE"), { code: "forbidden" });
    assert.equal(await store.getResult(id, "JK"), null);
  });
  await t.test("clear response, revision conflicts and invalid payload rollback", async () => {
    clock += 5000;
    const selected = progress.answers.map((a, i) => ({ ...a, selectedIndex: i === 0 ? 0 : null, visited: i === 0, timeSpentMs: i === 0 ? 1000 : 0 }));
    assert.deepEqual(await store.saveProgress(id, "JK", selected, 0), { submitted: false, revision: 1 });
    await assert.rejects(store.saveProgress(id, "JK", selected, 0), { code: "stale" });
    await assert.rejects(store.saveProgress(id, "JK", selected.slice(1), 1), { code: "invalid" });
    selected[0].selectedIndex = null;
    await store.saveProgress(id, "JK", selected, 1);
    progress = await store.getExamData(id, "JK");
    assert.equal(progress.answers[0].selectedIndex, null);
    assert.equal(progress.revision, 2);
  });
  await t.test("appends cannot change the active attempt's question set", async () => {
    await db.insert(schema.questions).values({ ...rows[0], id: randomUUID(), position: 4 });
    assert.equal((await store.getExamData(id, "JK")).questions.length, 3);
  });
  await t.test("manual and duplicate submissions are immutable and score server-side", async () => {
    const answers = progress.answers.map((a, i) => ({ ...a, selectedIndex: i === 0 ? 0 : i === 1 ? 1 : null }));
    await Promise.all([store.submitAttempt(id, "JK", answers, 2), store.submitAttempt(id, "JK", answers, 2)]);
    const result = await store.getResult(id, "JK");
    assert.equal(result.attempt.score, "1.50");
    assert.deepEqual([result.attempt.correctCount, result.attempt.wrongCount, result.attempt.skippedCount], [1, 1, 1]);
    assert.equal(result.questions.length, 3);
    await store.saveProgress(id, "JK", [], 2);
    await store.submitAttempt(id, "JK", [], 2);
    assert.deepEqual(await store.getResult(id, "JK"), result);
    await assert.rejects(store.getExamData(id, "JK"), { code: "conflict" });
    assert.equal((await store.getUserHistory("JK")).find(a => a.id === id).totalQuestions, 3);
    assert.equal((await store.getMockStats(testId, "JK")).totalAttempts, 1);
  });
  await t.test("retakes use the new question set; expiry scores only accepted progress", async () => {
    const second = await store.startOrResume(testId, "JK");
    assert.notEqual(second.attemptId, id);
    const data = await store.getExamData(second.attemptId, "JK");
    assert.equal(data.questions.length, 4);
    clock += 1000;
    const saved = data.answers.map((a, i) => ({ ...a, selectedIndex: i === 0 ? 0 : null }));
    await store.saveProgress(second.attemptId, "JK", saved, 0);
    clock += 60000;
    const late = data.answers.map(a => ({ ...a, selectedIndex: 0 }));
    await store.submitAttempt(second.attemptId, "JK", late, 1);
    const result = await store.getResult(second.attemptId, "JK");
    assert.equal(result.attempt.score, "2.00");
    assert.equal(result.attempt.timeTakenSeconds, 60);
    assert.equal((await store.getMockStats(testId, "JK")).totalAttempts, 2);
  });
  await t.test("expired reopen finalizes, and shared assignment works for HE", async () => {
    await db.update(schema.tests).set({ forUsers: ["JK", "HE"] }).where(eq(schema.tests.id, testId));
    const he = await store.startOrResume(testId, "HE");
    clock += 60001;
    await assert.rejects(store.getExamData(he.attemptId, "HE"), { code: "conflict" });
    assert.equal((await store.getResult(he.attemptId, "HE")).attempt.skippedCount, 4);
    assert.equal((await store.getMockStats(testId, "HE")).totalAttempts, 1);
  });
  await t.test("legacy answer arrays retain original question IDs", async () => {
    const legacyId = randomUUID();
    await db.insert(schema.attempts).values({ id: legacyId, testId, takenBy: "JK", answers: progress.answers, startedAt: new Date(clock).toISOString() });
    assert.equal((await store.getExamData(legacyId, "JK")).questions.length, 3);
  });
});
