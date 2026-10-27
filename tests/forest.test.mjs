import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { attempts, tests } from "../src/db/schema.ts";
import { FOREST_CAPACITY, forestPeriodStarts, readForestCounts, visiblePlantCount } from "../src/lib/forest.ts";
import { createForestStore } from "../src/server/forest-store.ts";
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
