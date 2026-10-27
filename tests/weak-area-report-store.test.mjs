import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { attempts, tests, weakAreaReports } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createWeakAreaReportStore } from "../src/server/weak-area-report-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

const areas = [{ subject: "Math", area: "Reverse percentages", focus: "Accuracy", priority: "High" }];

test("weak-area reports validate sources, keep retry IDs, and survive source deletion", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const store = createWeakAreaReportStore(database);

  async function source(forUsers = ["JK"], extra = {}) {
    const id = randomUUID();
    await database.insert(tests).values({ id, title: "Saved source name", forUsers, ...extra });
    return id;
  }

  await t.test("same-ID retries return the saved report and differing payloads conflict", async () => {
    const sourceTestId = await source();
    const id = randomUUID();
    assert.deepEqual(await store.save({ id, sourceTestId, areas }), { id });
    const first = (await store.list()).find((report) => report.id === id);
    assert.equal(first.sourceTitle, "Saved source name");
    assert.deepEqual(await store.save({ id: id.toUpperCase(), sourceTestId, areas }), { id });
    assert.deepEqual((await store.list()).find((report) => report.id === id), first);
    await assert.rejects(store.save({ id, sourceTestId, areas: [] }), (error) => error.code === "conflict");
    await assert.rejects(store.save({ id, sourceTestId: await source(), areas }), (error) => error.code === "conflict");
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, id))).length, 1);
  });

  await t.test("HE-only, deleted and missing sources cannot create reports", async () => {
    for (const sourceTestId of [await source(["HE"]), await source(["JK"], { deletedAt: "2026-10-27T10:00:00Z" }), randomUUID()]) {
      await assert.rejects(store.save({ id: randomUUID(), sourceTestId, areas }), (error) => error.code === "not-found");
    }
    await assert.rejects(store.save({ id: "bad", sourceTestId: randomUUID(), areas }), (error) => error.code === "invalid");
    await assert.rejects(store.save({ id: randomUUID(), sourceTestId: await source(), areas: [{ ...areas[0], focus: "guess" }] }), (error) => error.code === "invalid");
  });

  await t.test("history and mock deletion keep imported reports and allow uncertain-save retries", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    await database.insert(attempts).values({ testId: sourceTestId, takenBy: "JK", submittedAt: "2026-10-27T11:00:00Z" });
    await store.save({ id, sourceTestId, areas });
    await createAttemptStore(database).clearUserHistory("JK");
    assert.ok((await store.list()).some((report) => report.id === id));
    const mocks = createMockStore(database);
    await mocks.remove(sourceTestId, "JK");
    await mocks.remove(sourceTestId, "HE");
    assert.equal((await database.select().from(tests).where(eq(tests.id, sourceTestId))).length, 0);
    assert.deepEqual(await store.save({ id, sourceTestId, areas }), { id });
    const saved = (await store.list()).find((report) => report.id === id);
    assert.equal(saved.sourceTitle, "Saved source name");
    assert.deepEqual(saved.areas, areas);
  });

  await t.test("empty assessments are valid and removing a report leaves the mock intact", async () => {
    const sourceTestId = await source();
    const id = randomUUID();
    await store.save({ id, sourceTestId, areas: [] });
    assert.deepEqual((await store.list()).find((report) => report.id === id).areas, []);
    await store.remove(id);
    await store.remove(id);
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, id))).length, 0);
    assert.equal((await database.select().from(tests).where(eq(tests.id, sourceTestId))).length, 1);
    await assert.rejects(store.remove("bad"), (error) => error.code === "invalid");
  });

  await t.test("invalid saved area metadata produces a read error", async () => {
    const id = randomUUID();
    await database.insert(weakAreaReports).values({ id, sourceTestId: randomUUID(), sourceTitle: "Malformed fixture", areas: [{ area: "Missing fields" }] });
    await assert.rejects(store.list(), (error) => error.code === "invalid");
    await database.delete(weakAreaReports).where(eq(weakAreaReports.id, id));
  });
});
