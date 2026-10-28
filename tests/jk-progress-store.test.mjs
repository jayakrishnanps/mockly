import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { attempts, bankQuestions, jkPracticeRecords, questionBanks, tests } from "../src/db/schema.ts";
import { practiceXp } from "../src/lib/jk-progress.ts";
import { createJKProgressStore } from "../src/server/jk-progress-store.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createBankStore } from "../src/server/bank-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

const outcome = { correctCount: 2, wrongCount: 1, skippedCount: 1, timeTakenSeconds: 40 };
const now = new Date("2026-10-27T12:00:00Z");

test("JK completion awards are atomic, exactly once and separate from HE", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  const attemptId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Progress fixture", forUsers: ["JK", "HE"] });
  await database.insert(attempts).values([
    { id: attemptId, testId: mockId, takenBy: "JK", ...outcome },
    { testId: mockId, takenBy: "HE", submittedAt: now.toISOString(), ...outcome },
  ]);
  assert.equal((await database.select().from(jkPracticeRecords)).length, 0);
  await assert.rejects(database.transaction(async (tx) => {
    await tx.update(attempts).set({ submittedAt: now.toISOString() }).where(eq(attempts.id, attemptId));
    assert.equal((await tx.select().from(jkPracticeRecords)).length, 1);
    throw new Error("Abort completion");
  }), /Abort completion/);
  assert.equal((await database.select().from(jkPracticeRecords)).length, 0);
  await database.update(attempts).set({ submittedAt: now.toISOString() }).where(eq(attempts.id, attemptId));
  const original = (await database.select().from(jkPracticeRecords))[0];
  assert.equal(original.attemptId, attemptId);
  assert.equal(original.xp, practiceXp(2, 1, 1));
  await database.update(attempts).set({ submittedAt: "2026-10-28T12:00:00Z", correctCount: 0 }).where(eq(attempts.id, attemptId));
  await database.update(attempts).set({ submittedAt: now.toISOString() }).where(eq(attempts.id, attemptId));
  assert.deepEqual(await database.select().from(jkPracticeRecords), [original]);

  const partialId = randomUUID();
  await database.insert(attempts).values({ id: partialId, testId: mockId, takenBy: "JK", submittedAt: now.toISOString() });
  assert.equal((await database.select().from(jkPracticeRecords)).length, 1);
  await database.update(attempts).set(outcome).where(eq(attempts.id, partialId));
  assert.equal((await database.select().from(jkPracticeRecords)).length, 2);
  await database.insert(attempts).values([
    { testId: mockId, takenBy: "JK", submittedAt: now.toISOString(), ...outcome, correctCount: -1 },
    { testId: mockId, takenBy: "JK", submittedAt: now.toISOString(), ...outcome, timeTakenSeconds: -1 },
    { testId: mockId, takenBy: "JK", submittedAt: now.toISOString(), ...outcome, correctCount: 0, wrongCount: 0, skippedCount: 0 },
    { testId: mockId, takenBy: "JK", submittedAt: now.toISOString(), ...outcome, correctCount: 0, wrongCount: 0, skippedCount: 30 },
  ]);
  const rows = await database.select().from(jkPracticeRecords);
  assert.equal(rows.length, 3);
  assert.equal(rows.find((row) => row.skippedCount === 30).xp, 0);
  assert.equal((await createJKProgressStore(database).getTotals(now)).totalXp, 70);
});

test("JK lifetime totals use India periods and survive history, personal mock and bank deletion", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Shared progress fixture", forUsers: ["JK", "HE"] });
  const dates = ["2026-10-26T18:30:00Z", "2026-10-27T12:00:00Z", "2026-10-26T18:29:59.999Z", "2026-10-25T18:30:00Z",
    "2026-10-25T18:29:59.999Z", "2026-09-30T18:30:00Z", "2026-09-30T18:29:59.999Z", "2025-12-31T18:30:00Z", "2025-12-31T18:29:59.999Z"];
  await database.insert(attempts).values([
    ...dates.map((submittedAt) => ({ testId: mockId, takenBy: "JK", submittedAt, ...outcome })),
    { testId: mockId, takenBy: "JK", submittedAt: "2026-10-28T12:00:00Z", ...outcome },
    { testId: mockId, takenBy: "HE", submittedAt: now.toISOString(), ...outcome },
    { testId: mockId, takenBy: "JK", ...outcome },
  ]);
  const store = createJKProgressStore(database);
  const original = await store.getProgress(now);
  assert.equal(original.totalXp, 9 * practiceXp(2, 1, 1));
  assert.equal(original.completedMocks, 9);
  assert.equal(original.correctAnswers, 18);
  assert.equal(original.wrongAnswers, 9);
  assert.equal(original.skippedAnswers, 9);
  assert.equal(original.totalPracticeSeconds, 360);
  assert.equal(new Date(original.firstCompletedAt).toISOString(), "2025-12-31T18:29:59.999Z");
  assert.deepEqual(original.counts, { today: 2, week: 4, month: 6, year: 8, allTime: 9 });
  assert.deepEqual((await store.getActivity(now)).at(-1), { date: "2026-10-27", count: 2, xp: 70 });
  assert.equal(original.activity.at(-1).date, "2026-10-27");
  await createAttemptStore(database).clearUserHistory("JK");
  assert.deepEqual(await store.getProgress(now), original);
  assert.equal((await database.select().from(attempts).where(eq(attempts.takenBy, "JK"))).length, 1);
  const mocks = createMockStore(database);
  await mocks.remove(mockId, "JK");
  assert.deepEqual((await database.select().from(tests).where(eq(tests.id, mockId)))[0].forUsers, ["HE"]);
  assert.equal((await database.select().from(attempts).where(eq(attempts.takenBy, "HE"))).length, 1);
  assert.deepEqual(await store.getProgress(now), original);
  await mocks.remove(mockId, "HE");
  assert.equal((await database.select().from(tests)).length, 0);
  assert.deepEqual(await store.getProgress(now), original);

  const bankId = randomUUID();
  const linkedId = randomUUID();
  const jkAttemptId = randomUUID();
  await database.insert(questionBanks).values({ id: bankId, title: "Progress bank fixture" });
  await database.insert(bankQuestions).values({ bankId, position: 1, questionText: "Question", options: ["A", "B", "C", "D"], correctIndex: 0 });
  await database.insert(tests).values({ id: linkedId, title: "Linked progress mock", sourceBankId: bankId, forUsers: ["JK", "HE"] });
  await database.insert(attempts).values([
    { id: jkAttemptId, testId: linkedId, takenBy: "JK", submittedAt: now.toISOString(), ...outcome },
    { testId: linkedId, takenBy: "HE", submittedAt: now.toISOString(), ...outcome },
  ]);
  const withBank = await store.getProgress(now);
  assert.equal(withBank.completedMocks, 10);
  await createBankStore(database).remove(bankId);
  for (const table of [tests, attempts, questionBanks, bankQuestions]) assert.equal((await database.select().from(table)).length, 0);
  assert.deepEqual(await store.getProgress(now), withBank);
  assert.equal((await database.select().from(jkPracticeRecords).where(eq(jkPracticeRecords.attemptId, jkAttemptId))).length, 1);
});

test("JK progress migration backfills valid historical completions once without reviving deleted history", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Progress backfill fixture", forUsers: ["JK", "HE"] });
  await database.execute(sql`DROP TRIGGER attempts_record_jk_practice ON public.attempts`);
  const id = randomUUID();
  await database.insert(attempts).values([
    { id, testId: mockId, takenBy: "JK", submittedAt: "2026-09-10T12:00:00Z", ...outcome },
    { testId: mockId, takenBy: "HE", submittedAt: now.toISOString(), ...outcome },
    { testId: mockId, takenBy: "JK", ...outcome },
    { testId: mockId, takenBy: "JK", submittedAt: now.toISOString() },
  ]);
  assert.equal((await database.select().from(jkPracticeRecords)).length, 0);
  const migration = await readFile(new URL("../src/db/migrations/0008_jk_progress.sql", import.meta.url), "utf8");
  await database.$client.exec(migration);
  const original = await createJKProgressStore(database).getProgress(now);
  await database.$client.exec(migration);
  assert.deepEqual(await createJKProgressStore(database).getProgress(now), original);
  const rows = await database.select().from(jkPracticeRecords);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].attemptId, id);
  assert.equal(new Date(rows[0].completedAt).toISOString(), "2026-09-10T12:00:00.000Z");
  assert.equal(rows[0].xp, practiceXp(2, 1, 1));
  await database.delete(attempts).where(and(eq(attempts.testId, mockId), eq(attempts.takenBy, "JK")));
  await database.$client.exec(migration);
  assert.deepEqual(await createJKProgressStore(database).getProgress(now), original);
});
