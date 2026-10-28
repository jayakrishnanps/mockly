import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { arrayContains, eq, inArray } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { defaultMetadata, validateMetadata } from "../src/lib/mock-validation.ts";
import { insertLegacyMockFixture } from "./helpers/legacy-mock-fixture.mjs";
import { parseQuestions } from "../src/lib/parser.ts";

// Opt in: $env:MOCKLY_INTEGRATION_TESTS='1'; npm test
// Only temporary mocks allocated below and their cascaded questions/attempts are deleted.
test("existing mocks retain assignments, question reads and per-person deletion", { skip: process.env.MOCKLY_INTEGRATION_TESTS !== "1" }, async (t) => {
  config({ path: ".env.local", quiet: true });
  assert.ok(process.env.DATABASE_URL);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });
  const db = drizzle(pool);
  const store = createMockStore(db);
  const attemptStore = createAttemptStore(db);
  const ids = [];
  t.after(async () => {
    try { if (ids.length) await db.delete(schema.tests).where(inArray(schema.tests.id, ids)); }
    finally { await pool.end(); }
  });
  const batch = () => parseQuestions(String.raw`Q9. **Simplify** $\frac{\frac{3}{4}}{\frac{5}{6}}$
A) $\frac{9}{10}$
B) 1
C) 2
D) 3
Ans: A

Q2. Choose the last option.
A) first
B) second
C) third
D) fourth
Ans: D`).valid.map((question) => ({ ...question, id: randomUUID() }));
  function request(users = ["JK"], overrides = {}) {
    const testId = randomUUID();
    ids.push(testId);
    const checked = validateMetadata({ ...defaultMetadata(), title: `[Legacy mock verification] ${testId}`, forUsers: users, ...overrides });
    assert.ok(checked.value);
    return { testId, metadata: checked.value, questions: batch() };
  }
  const jk = request();
  const he = request(["HE"], { durationMinutes: "35", marksCorrect: "3.25", marksWrong: "0.75" });
  const shared = request(["JK", "HE"]);
  await t.test("JK-only, HE-only and shared legacy mocks retain their existing question data", async () => {
    for (const input of [jk, he, shared]) await insertLegacyMockFixture(db, input);
    for (const [user, expected] of [["JK", [jk.testId, shared.testId]], ["HE", [he.testId, shared.testId]]]) {
      const rows = await db.select({ id: schema.tests.id }).from(schema.tests).where(arrayContains(schema.tests.forUsers, [user]));
      assert.deepEqual(rows.filter((row) => ids.includes(row.id)).map((row) => row.id).sort(), expected.sort());
    }
    const loaded = await store.get(he.testId);
    assert.equal(loaded.details, null);
    assert.equal(loaded.durationMinutes, 35);
    assert.equal(loaded.marksCorrect, "3.25");
    assert.equal(loaded.marksWrong, "0.75");
    assert.equal(loaded.questions.length, 2);
    assert.deepEqual(loaded.questions.map((q) => q.position), [1, 2]);
    assert.deepEqual(loaded.questions.map((q) => q.correctIndex), [0, 3]);
    assert.equal(loaded.questions[0].questionText, he.questions[0].questionText);
    assert.deepEqual(loaded.questions[0].options, he.questions[0].options);
  });
  await t.test("missing reads and parent deletion honor the existing cascade", async () => {
    assert.equal(await store.get(randomUUID()), null);
    await store.remove(jk.testId, "JK");
    await store.remove(jk.testId, "JK");
    assert.equal(await store.get(jk.testId), null);
    assert.equal((await db.select().from(schema.questions).where(eq(schema.questions.testId, jk.testId))).length, 0);
    assert.ok(await store.get(he.testId));
  });
  await t.test("shared mock deletion removes only the selected person's assignment and all their attempts", async () => {
    const before = await store.get(shared.testId);
    const attemptIds = {};
    for (const user of ["JK", "HE"]) {
      const completed = await attemptStore.startOrResume(shared.testId, user);
      await attemptStore.submitAttempt(completed.attemptId, user);
      const active = await attemptStore.startOrResume(shared.testId, user);
      attemptIds[user] = [completed.attemptId, active.attemptId];
    }
    const otherAttempts = await db.select().from(schema.attempts).where(inArray(schema.attempts.id, attemptIds.HE)).orderBy(schema.attempts.id);

    await Promise.all([store.remove(shared.testId, "JK"), store.remove(shared.testId, "JK")]);
    const remaining = await store.get(shared.testId);
    assert.deepEqual(remaining.forUsers, ["HE"]);
    assert.equal(remaining.deletedAt, null);
    assert.deepEqual(remaining.questions, before.questions);
    assert.equal((await db.select().from(schema.attempts).where(inArray(schema.attempts.id, attemptIds.JK))).length, 0);
    assert.deepEqual(await db.select().from(schema.attempts).where(inArray(schema.attempts.id, attemptIds.HE)).orderBy(schema.attempts.id), otherAttempts);
    assert.ok(!(await attemptStore.getUserHistory("JK")).some((attempt) => attempt.testId === shared.testId));
    assert.ok((await attemptStore.getUserHistory("HE")).some((attempt) => attempt.id === attemptIds.HE[0]));
    await assert.rejects(attemptStore.getResult(attemptIds.JK[0], "JK"), { code: "not-found" });
    await assert.rejects(attemptStore.startOrResume(shared.testId, "JK"), { code: "forbidden" });
    assert.ok(await attemptStore.getResult(attemptIds.HE[0], "HE"));

    await store.remove(shared.testId, "JK");
    assert.deepEqual((await store.get(shared.testId)).forUsers, ["HE"]);
    await store.remove(shared.testId, "HE");
    await store.remove(shared.testId, "HE");
    assert.equal(await store.get(shared.testId), null);
    assert.equal((await db.select().from(schema.tests).where(eq(schema.tests.id, shared.testId))).length, 0);
    assert.equal((await db.select().from(schema.questions).where(eq(schema.questions.testId, shared.testId))).length, 0);
    assert.equal((await db.select().from(schema.attempts).where(eq(schema.attempts.testId, shared.testId))).length, 0);
    assert.ok(!(await attemptStore.getUserHistory("HE")).some((attempt) => attempt.testId === shared.testId));
    assert.ok(await store.get(he.testId));
  });
});
