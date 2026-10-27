import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { and, eq } from "drizzle-orm";
import { attempts, forestPlants, heWeakReports, questionBanks, tests, weakAreaReports } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createBankStore } from "../src/server/bank-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createHEWeakReportStore } from "../src/server/he-weak-report-store.ts";
import { createWeakAreaReportStore } from "../src/server/weak-area-report-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

const note = {
  title: "ഒൻപതുകൊണ്ട് ഗുണിക്കുന്നത്",
  explanation: "- ഒൻപതുകൊണ്ട് ഗുണിക്കുമ്പോൾ കൂടുതൽ സമയം എടുക്കുന്നു.",
  practice: "- ആദ്യം $9 \\times 7 = 63$ എന്ന് ഓർത്തുനോക്കൂ.\n- പിന്നെ പതുക്കെ എഴുതിനോക്കൂ.",
};
const areas = [{ subject: "Math", area: "Multiplying by 9", focus: "Speed", priority: "Medium" }];

test("HE practice notes keep their own storage, retry IDs, and source lifecycle", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  const store = createHEWeakReportStore(database);

  async function source(forUsers = ["HE"], extra = {}) {
    const id = randomUUID();
    await database.insert(tests).values({ id, title: "HE source name", forUsers, ...extra });
    return id;
  }

  await t.test("same-ID retries preserve Malayalam, LaTeX, title snapshots and timestamps", async () => {
    const sourceTestId = await source();
    const id = randomUUID();
    assert.deepEqual(await store.save({ id, sourceTestId, ...note }), { id });
    const saved = (await store.list()).find((item) => item.id === id);
    assert.equal(saved.sourceTitle, "HE source name");
    assert.equal(saved.practice, note.practice);
    assert.equal(saved.title, note.title);
    await database.update(tests).set({ title: "New name" }).where(eq(tests.id, sourceTestId));
    assert.deepEqual(await store.save({ id: id.toUpperCase(), sourceTestId, ...note }), { id });
    assert.deepEqual((await store.list()).find((item) => item.id === id), saved);
    assert.equal((await database.select().from(heWeakReports).where(eq(heWeakReports.id, id))).length, 1);
    await assert.rejects(store.save({ id, sourceTestId, ...note, title: "വേറൊരു കുറിപ്പ്" }), (error) => error.code === "conflict");
    await assert.rejects(store.save({ id, sourceTestId: await source(), ...note }), (error) => error.code === "conflict");
  });

  await t.test("only active HE mocks accept notes and malformed saves are rejected", async () => {
    for (const sourceTestId of [await source(["JK"]), await source(["HE"], { deletedAt: "2026-10-27T10:00:00Z" }), randomUUID()]) {
      await assert.rejects(store.save({ id: randomUUID(), sourceTestId, ...note }), (error) => error.code === "not-found");
    }
    const sourceTestId = await source();
    for (const input of [null, { id: "bad", sourceTestId, ...note }, { id: randomUUID(), sourceTestId, ...note, extra: true }, { id: randomUUID(), sourceTestId, ...note, practice: "" }]) {
      await assert.rejects(store.save(input), (error) => error.code === "invalid");
    }
  });

  await t.test("clearing HE history and removing JK's shared copy leave HE notes intact", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    const heAttemptId = randomUUID();
    await database.insert(attempts).values([
      { id: heAttemptId, testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" },
      { testId: sourceTestId, takenBy: "JK", submittedAt: "2026-10-27T11:00:00Z" },
    ]);
    await store.save({ id, sourceTestId, ...note });
    await createAttemptStore(database).clearUserHistory("HE");
    assert.equal((await database.select().from(attempts).where(eq(attempts.id, heAttemptId))).length, 0);
    assert.ok((await store.list()).some((item) => item.id === id));
    await createMockStore(database).remove(sourceTestId, "JK");
    assert.deepEqual((await database.select().from(tests).where(eq(tests.id, sourceTestId)))[0].forUsers, ["HE"]);
    assert.ok((await store.list()).some((item) => item.id === id));
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, heAttemptId))).length, 1);
  });

  await t.test("removing HE's shared copy removes HE notes and preserves JK reports and attempts", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    const jkReportId = randomUUID();
    await store.save({ id, sourceTestId, ...note });
    await createWeakAreaReportStore(database).save({ id: jkReportId, sourceTestId, areas });
    await database.insert(attempts).values({ testId: sourceTestId, takenBy: "JK", submittedAt: "2026-10-27T11:00:00Z" });
    const mocks = createMockStore(database);
    await mocks.remove(sourceTestId, "HE");
    await mocks.remove(sourceTestId, "HE");
    assert.equal((await database.select().from(heWeakReports).where(eq(heWeakReports.id, id))).length, 0);
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, jkReportId))).length, 1);
    assert.equal((await database.select().from(attempts).where(and(eq(attempts.testId, sourceTestId), eq(attempts.takenBy, "JK")))).length, 1);
    assert.deepEqual((await database.select().from(tests).where(eq(tests.id, sourceTestId)))[0].forUsers, ["JK"]);
    await assert.rejects(store.save({ id, sourceTestId, ...note }), (error) => error.code === "not-found");
  });

  await t.test("deleting a bank removes linked notes, mocks and history without deleting plants", async () => {
    const bankId = randomUUID();
    const id = randomUUID();
    const attemptId = randomUUID();
    await database.insert(questionBanks).values({ id: bankId, title: "HE note bank" });
    const sourceTestId = await source(["JK", "HE"], { sourceBankId: bankId });
    await store.save({ id, sourceTestId, ...note });
    await database.insert(attempts).values({ id: attemptId, testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" });
    await createBankStore(database).remove(bankId);
    assert.equal((await database.select().from(heWeakReports).where(eq(heWeakReports.id, id))).length, 0);
    assert.equal((await database.select().from(tests).where(eq(tests.id, sourceTestId))).length, 0);
    assert.equal((await database.select().from(attempts).where(eq(attempts.id, attemptId))).length, 0);
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, attemptId))).length, 1);
  });

  await t.test("soft deletion removes notes and prevents new saves", async () => {
    const sourceTestId = await source();
    const id = randomUUID();
    await store.save({ id, sourceTestId, ...note });
    await database.update(tests).set({ deletedAt: "2026-10-27T11:00:00Z" }).where(eq(tests.id, sourceTestId));
    assert.equal((await database.select().from(heWeakReports).where(eq(heWeakReports.id, id))).length, 0);
    await assert.rejects(store.save({ id, sourceTestId, ...note }), (error) => error.code === "not-found");
  });

  await t.test("individual deletion and clearing all notes leave JK reports, attempts and plants intact", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    const remainingId = randomUUID();
    const jkReportId = randomUUID();
    const attemptId = randomUUID();
    await store.save({ id, sourceTestId, ...note });
    await store.save({ id: remainingId, sourceTestId, ...note });
    await createWeakAreaReportStore(database).save({ id: jkReportId, sourceTestId, areas });
    await database.insert(attempts).values({ id: attemptId, testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" });
    await store.remove(id);
    await store.remove(id);
    await assert.rejects(store.remove("bad"), (error) => error.code === "invalid");
    assert.equal((await database.select().from(heWeakReports).where(eq(heWeakReports.id, id))).length, 0);
    assert.ok((await store.list()).some((item) => item.id === remainingId));
    await store.clearAll();
    await store.clearAll();
    assert.deepEqual(await store.list(), []);
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, jkReportId))).length, 1);
    assert.equal((await database.select().from(attempts).where(eq(attempts.id, attemptId))).length, 1);
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, attemptId))).length, 1);
    assert.equal((await database.select().from(tests).where(eq(tests.id, sourceTestId))).length, 1);
  });

  await t.test("invalid stored content is rejected on reads", async () => {
    const id = randomUUID();
    await database.insert(heWeakReports).values({ id, sourceTestId: await source(), sourceTitle: "Invalid fixture", ...note, title: "English only" });
    await assert.rejects(store.list(), (error) => error.code === "invalid");
    await database.delete(heWeakReports).where(eq(heWeakReports.id, id));
  });

  await t.test("the additive migration can be reapplied without changing stored notes", async () => {
    const id = randomUUID();
    await store.save({ id, sourceTestId: await source(), ...note });
    const before = await store.list();
    const migration = await readFile(new URL("../src/db/migrations/0007_he_weak_reports.sql", import.meta.url), "utf8");
    await database.$client.exec(migration);
    assert.deepEqual(await store.list(), before);
  });
});
