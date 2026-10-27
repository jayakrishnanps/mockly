import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { attempts, bankQuestions, forestPlants, questionBanks, tests } from "../src/db/schema.ts";
import { FOREST_CAPACITY, forestPeriodStarts, readForestCounts, visiblePlantCount } from "../src/lib/forest.ts";
import { createForestStore } from "../src/server/forest-store.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createBankStore } from "../src/server/bank-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

test("forest periods use India midnight and a Monday start to the week", () => {
  assert.deepEqual(forestPeriodStarts(new Date("2026-10-27T12:00:00Z")), {
    today: "2026-10-26T18:30:00.000Z",
    week: "2026-10-25T18:30:00.000Z",
    month: "2026-09-30T18:30:00.000Z",
    year: "2025-12-31T18:30:00.000Z",
  });
  assert.equal(forestPeriodStarts(new Date("2026-10-25T18:29:59.999Z")).week, "2026-10-18T18:30:00.000Z");
  assert.equal(forestPeriodStarts(new Date("2026-10-25T18:30:00Z")).week, "2026-10-25T18:30:00.000Z");
});

test("forest calendar boundaries handle new years and leap days", () => {
  assert.deepEqual(forestPeriodStarts(new Date("2026-12-31T18:30:00Z")), {
    today: "2026-12-31T18:30:00.000Z",
    week: "2026-12-27T18:30:00.000Z",
    month: "2026-12-31T18:30:00.000Z",
    year: "2026-12-31T18:30:00.000Z",
  });
  assert.equal(forestPeriodStarts(new Date("2028-02-29T12:00:00Z")).today, "2028-02-28T18:30:00.000Z");
  assert.throws(() => forestPeriodStarts(new Date("invalid")), /Invalid forest date/);
});

test("forest display stays bounded without reducing the recorded totals", () => {
  const totals = { today: 0, week: 2, month: 25, year: 100, all: 10000 };
  assert.deepEqual(readForestCounts(totals), totals);
  assert.deepEqual(Object.values(totals).map(visiblePlantCount), [0, 2, FOREST_CAPACITY, FOREST_CAPACITY, FOREST_CAPACITY]);
  for (const invalid of [null, [], {}, { ...totals, today: -1 }, { ...totals, week: "2" }, { ...totals, month: 0.5 }, { ...totals, all: Infinity }]) {
    assert.throws(() => readForestCounts(invalid), /Invalid forest totals/);
  }
  assert.equal(visiblePlantCount(NaN), 0);
});

test("forest totals count only HE's completed tests across mocks and calendar boundaries", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockIds = [randomUUID(), randomUUID()];
  await database.insert(tests).values(mockIds.map((id) => ({ id, title: "Forest fixture", forUsers: ["JK", "HE"] })));
  const dates = [
    "2026-10-26T18:30:00Z", "2026-10-27T12:00:00Z",
    "2026-10-26T18:29:59.999Z", "2026-10-25T18:30:00Z",
    "2026-10-25T18:29:59.999Z", "2026-09-30T18:30:00Z",
    "2026-09-30T18:29:59.999Z", "2025-12-31T18:30:00Z",
    "2025-12-31T18:29:59.999Z",
  ];
  await database.insert(attempts).values([
    ...dates.map((submittedAt, index) => ({
      id: randomUUID(), testId: mockIds[index % 2], takenBy: "HE", submittedAt,
    })),
    { id: randomUUID(), testId: mockIds[0], takenBy: "JK", submittedAt: dates[0] },
    { id: randomUUID(), testId: mockIds[0], takenBy: "HE", submittedAt: null },
    { id: randomUUID(), testId: mockIds[0], takenBy: "HE", submittedAt: "2026-10-28T12:00:00Z" },
  ]);
  const store = createForestStore(database);
  assert.deepEqual(await store.getHECounts(new Date("2026-10-27T12:00:00Z")), {
    today: 2, week: 4, month: 6, year: 8, all: 9,
  });
});

test("an empty forest returns zero in every period", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  assert.deepEqual(await createForestStore(database).getHECounts(new Date("2026-10-27T12:00:00Z")), {
    today: 0, week: 0, month: 0, year: 0, all: 0,
  });
});

test("plants survive history clearing, shared-mock deletion, and complete bank deletion", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const now = new Date("2026-10-27T12:00:00Z");
  const forest = createForestStore(database);
  const mockId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Shared mock", forUsers: ["JK", "HE"] });
  await database.insert(attempts).values({ testId: mockId, takenBy: "HE", submittedAt: now.toISOString() });
  const heActiveId = randomUUID();
  await database.insert(attempts).values({ id: heActiveId, testId: mockId, takenBy: "HE" });
  await createAttemptStore(database).clearUserHistory("HE");
  assert.equal((await forest.getHECounts(now)).all, 1);
  assert.equal((await database.select().from(attempts).where(and(eq(attempts.takenBy, "HE"), isNotNull(attempts.submittedAt)))).length, 0);
  assert.equal((await database.select().from(attempts).where(eq(attempts.id, heActiveId))).length, 1);

  await database.insert(attempts).values([
    { testId: mockId, takenBy: "HE", submittedAt: now.toISOString() },
    { testId: mockId, takenBy: "JK", submittedAt: now.toISOString() },
    { testId: mockId, takenBy: "JK" },
  ]);
  const mocks = createMockStore(database);
  await mocks.remove(mockId, "JK");
  assert.equal((await database.select().from(attempts).where(eq(attempts.takenBy, "JK"))).length, 0);
  assert.equal((await database.select().from(attempts).where(eq(attempts.takenBy, "HE"))).length, 2);
  assert.deepEqual((await database.select().from(tests).where(eq(tests.id, mockId)))[0].forUsers, ["HE"]);
  await mocks.remove(mockId, "JK");
  assert.equal((await database.select().from(attempts).where(eq(attempts.takenBy, "HE"))).length, 2);
  await mocks.remove(mockId, "HE");
  assert.equal((await database.select().from(attempts)).length, 0);
  assert.equal((await database.select().from(tests)).length, 0);
  assert.equal((await forest.getHECounts(now)).all, 2);

  const bankId = randomUUID();
  const linkedId = randomUUID();
  await database.insert(questionBanks).values({ id: bankId, title: "Linked bank" });
  await database.insert(bankQuestions).values({ bankId, position: 1, questionText: "Example", options: ["A", "B", "C", "D"], correctIndex: 0 });
  await database.insert(tests).values({ id: linkedId, title: "Bank mock", sourceBankId: bankId, forUsers: ["JK", "HE"] });
  await database.insert(attempts).values([
    { testId: linkedId, takenBy: "HE", submittedAt: now.toISOString() },
    { testId: linkedId, takenBy: "JK", submittedAt: now.toISOString() },
    { testId: linkedId, takenBy: "HE" },
  ]);
  await createBankStore(database).remove(bankId);
  for (const table of [tests, attempts, questionBanks, bankQuestions]) {
    assert.equal((await database.select().from(table)).length, 0);
  }
  assert.deepEqual(await forest.getHECounts(now), { today: 3, week: 3, month: 3, year: 3, all: 3 });
});

test("planting is atomic with completion and retries cannot duplicate or move a plant", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  const attemptId = randomUUID();
  const plantedAt = "2026-10-26T12:00:00.000Z";
  await database.insert(tests).values({ id: mockId, title: "Retry fixture", forUsers: ["HE"] });
  await database.insert(attempts).values({ id: attemptId, testId: mockId, takenBy: "HE" });
  assert.equal((await database.select().from(forestPlants)).length, 0);
  await assert.rejects(database.transaction(async (tx) => {
    await tx.update(attempts).set({ submittedAt: plantedAt }).where(eq(attempts.id, attemptId));
    throw new Error("Abort completion");
  }), /Abort completion/);
  assert.equal((await database.select().from(forestPlants)).length, 0);
  await database.update(attempts).set({ submittedAt: plantedAt }).where(eq(attempts.id, attemptId));
  await database.update(attempts).set({ submittedAt: "2026-10-27T12:00:00Z" }).where(eq(attempts.id, attemptId));
  const plants = await database.select().from(forestPlants);
  assert.equal(plants.length, 1);
  assert.equal(plants[0].attemptId, attemptId);
  assert.equal(new Date(plants[0].plantedAt).toISOString(), plantedAt);
});

test("the migration restores historical HE plants once and keeps their original dates", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const mockId = randomUUID();
  await database.insert(tests).values({ id: mockId, title: "Backfill fixture", forUsers: ["JK", "HE"] });
  await database.execute(sql`DROP TRIGGER attempts_record_he_forest_plant ON public.attempts`);
  await database.insert(attempts).values([
    { testId: mockId, takenBy: "HE", submittedAt: "2026-09-10T12:00:00Z" },
    { testId: mockId, takenBy: "JK", submittedAt: "2026-09-10T12:00:00Z" },
    { testId: mockId, takenBy: "HE" },
  ]);
  const migration = await readFile(new URL("../src/db/migrations/0004_forest_plants.sql", import.meta.url), "utf8");
  await database.$client.exec(migration);
  await database.$client.exec(migration);
  assert.equal((await database.select().from(forestPlants)).length, 1);
  assert.deepEqual(await createForestStore(database).getHECounts(new Date("2026-10-27T12:00:00Z")), {
    today: 0, week: 0, month: 0, year: 1, all: 1,
  });
});
