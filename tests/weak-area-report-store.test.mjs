import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { attempts, forestPlants, heWeakReports, questionBanks, tests, weakAreaReports } from "../src/db/schema.ts";
import { createAttemptStore } from "../src/server/attempt-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { createBankStore } from "../src/server/bank-store.ts";
import { createWeakAreaReportStore } from "../src/server/weak-area-report-store.ts";
import { createLocalDatabase } from "./helpers/local-database.mjs";

const areas = [{ subject: "Math", area: "Reverse percentages", focus: "Accuracy", priority: "High" }];

test("weak-area reports validate sources, keep retry IDs, and follow JK's mock lifecycle", async (t) => {
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

  await t.test("clearing history or deleting HE's shared copy keeps JK reports", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    await database.insert(attempts).values([
      { testId: sourceTestId, takenBy: "JK", submittedAt: "2026-10-27T11:00:00Z" },
      { testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" },
    ]);
    await store.save({ id, sourceTestId, areas });
    await createAttemptStore(database).clearUserHistory("JK");
    assert.ok((await store.list()).some((report) => report.id === id));
    const mocks = createMockStore(database);
    await mocks.remove(sourceTestId, "HE");
    assert.deepEqual(await store.save({ id, sourceTestId, areas }), { id });
    const saved = (await store.list()).find((report) => report.id === id);
    assert.equal(saved.sourceTitle, "Saved source name");
    assert.deepEqual(saved.areas, areas);
    assert.deepEqual((await database.select().from(tests).where(eq(tests.id, sourceTestId)))[0].forUsers, ["JK"]);
    await mocks.remove(sourceTestId, "JK");
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, id))).length, 0);
    await assert.rejects(store.save({ id, sourceTestId, areas }), (error) => error.code === "not-found");
  });

  await t.test("deleting JK's shared copy removes its reports and preserves HE's copy, history and plants", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    const heAttemptId = randomUUID();
    await database.insert(attempts).values([
      { testId: sourceTestId, takenBy: "JK", submittedAt: "2026-10-27T11:00:00Z" },
      { id: heAttemptId, testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" },
    ]);
    await store.save({ id, sourceTestId, areas });
    const mocks = createMockStore(database);
    await mocks.remove(sourceTestId, "JK");
    await mocks.remove(sourceTestId, "JK");
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, id))).length, 0);
    assert.deepEqual((await database.select().from(tests).where(eq(tests.id, sourceTestId)))[0].forUsers, ["HE"]);
    assert.equal((await database.select().from(attempts).where(and(eq(attempts.testId, sourceTestId), eq(attempts.takenBy, "JK")))).length, 0);
    assert.equal((await database.select().from(attempts).where(eq(attempts.id, heAttemptId))).length, 1);
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, heAttemptId))).length, 1);
    await assert.rejects(store.save({ id, sourceTestId, areas }), (error) => error.code === "not-found");
    await mocks.remove(sourceTestId, "HE");
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, heAttemptId))).length, 1);
  });

  await t.test("deleting a question bank removes linked reports while keeping Forest plants", async () => {
    const bankId = randomUUID();
    const sourceTestId = await source(["JK", "HE"], { sourceBankId: null });
    const id = randomUUID();
    const heAttemptId = randomUUID();
    await database.insert(questionBanks).values({ id: bankId, title: "Report bank" });
    await database.update(tests).set({ sourceBankId: bankId }).where(eq(tests.id, sourceTestId));
    await database.insert(attempts).values({ id: heAttemptId, testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" });
    await store.save({ id, sourceTestId, areas });
    await createBankStore(database).remove(bankId);
    assert.equal((await database.select().from(tests).where(eq(tests.id, sourceTestId))).length, 0);
    assert.equal((await database.select().from(attempts).where(eq(attempts.id, heAttemptId))).length, 0);
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, id))).length, 0);
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, heAttemptId))).length, 1);
  });

  await t.test("soft deletion removes reports and rejects new report saves", async () => {
    const sourceTestId = await source();
    const id = randomUUID();
    await store.save({ id, sourceTestId, areas });
    await database.update(tests).set({ deletedAt: "2026-10-27T11:00:00Z" }).where(eq(tests.id, sourceTestId));
    assert.equal((await database.select().from(weakAreaReports).where(eq(weakAreaReports.id, id))).length, 0);
    await assert.rejects(store.save({ id, sourceTestId, areas }), (error) => error.code === "not-found");
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
    await database.insert(weakAreaReports).values({ id, sourceTestId: await source(), sourceTitle: "Malformed fixture", areas: [{ area: "Missing fields" }] });
    await assert.rejects(store.list(), (error) => error.code === "invalid");
    await database.delete(weakAreaReports).where(eq(weakAreaReports.id, id));
  });

  await t.test("checking one area removes only its stable identity and preserves other data", async () => {
    const sourceTestId = await source(["JK", "HE"]);
    const id = randomUUID();
    const heReportId = randomUUID();
    const attemptId = randomUUID();
    const reportAreas = [
      areas[0],
      { subject: "Reasoning", area: "Reverse percentages", focus: "Speed", priority: "Low" },
      { subject: "Math", area: "Combining work rates", focus: "Both", priority: "Medium" },
    ];
    await store.save({ id, sourceTestId, areas: reportAreas });
    await database.insert(heWeakReports).values({ id: heReportId, sourceTestId, sourceTitle: "HE notes", title: "പരിശീലനം", explanation: "- പതുക്കെ വായിക്കൂ.", practice: "- വീണ്ടും ചെയ്യൂ." });
    await database.insert(attempts).values({ id: attemptId, testId: sourceTestId, takenBy: "HE", submittedAt: "2026-10-27T11:00:00Z" });
    const before = (await store.list()).find((report) => report.id === id);
    const target = { reportId: id.toUpperCase(), subject: "math", area: "  REVERSE   percentages  " };
    await store.removeArea(target);
    await store.removeArea(target);
    const after = (await store.list()).find((report) => report.id === id);
    assert.deepEqual(after, { ...before, areas: reportAreas.slice(1) });
    assert.equal((await database.select().from(heWeakReports).where(eq(heWeakReports.id, heReportId))).length, 1);
    assert.equal((await database.select().from(tests).where(eq(tests.id, sourceTestId))).length, 1);
    assert.equal((await database.select().from(attempts).where(eq(attempts.id, attemptId))).length, 1);
    assert.equal((await database.select().from(forestPlants).where(eq(forestPlants.attemptId, attemptId))).length, 1);
    await store.removeArea({ reportId: id, subject: "Math", area: reportAreas[2].area });
    assert.deepEqual((await store.list()).find((report) => report.id === id).areas, [reportAreas[1]]);
  });

  await t.test("the last checked area leaves an empty latest assessment instead of reviving older areas", async () => {
    const sourceTestId = await source();
    const earlierId = randomUUID();
    const latestId = randomUUID();
    await store.save({ id: earlierId, sourceTestId, areas });
    await store.save({ id: latestId, sourceTestId, areas });
    await database.update(weakAreaReports).set({ importedAt: "2026-10-27T10:00:00Z" }).where(eq(weakAreaReports.id, earlierId));
    await database.update(weakAreaReports).set({ importedAt: "2026-10-27T11:00:00Z" }).where(eq(weakAreaReports.id, latestId));
    await store.removeArea({ reportId: latestId, subject: areas[0].subject, area: areas[0].area });
    await store.removeArea({ reportId: latestId, subject: areas[0].subject, area: areas[0].area });
    const saved = (await store.list()).filter((report) => report.sourceTestId === sourceTestId);
    assert.equal(saved[0].id, latestId);
    assert.deepEqual(saved[0].areas, []);
    assert.deepEqual(saved[1].areas, areas);
    await assert.rejects(store.save({ id: latestId, sourceTestId, areas }), (error) => error.code === "conflict");
  });

  await t.test("area checks reject malformed targets and safely ignore missing records", async () => {
    const id = randomUUID();
    const sourceTestId = await source();
    await store.save({ id, sourceTestId, areas });
    const target = { reportId: id, subject: areas[0].subject, area: areas[0].area };
    for (const invalid of [null, [], {}, { ...target, reportId: "bad" }, { ...target, subject: "Science" },
      { ...target, area: "" }, { ...target, area: "**bad**" }, { ...target, area: "x".repeat(101) }, { ...target, extra: true }]) {
      await assert.rejects(store.removeArea(invalid), (error) => error.code === "invalid");
    }
    await store.removeArea({ ...target, reportId: randomUUID() });
    await store.removeArea({ ...target, area: "A different valid area" });
    assert.deepEqual((await store.list()).find((report) => report.id === id).areas, areas);
  });
});

test("report lifecycle migration removes unavailable reports and can be reapplied", async (t) => {
  const { database, close } = await createLocalDatabase();
  t.after(close);
  await database.execute(sql`ALTER TABLE public.weak_area_reports DROP CONSTRAINT weak_area_reports_source_test_id_fkey`);
  await database.execute(sql`DROP TRIGGER tests_remove_inaccessible_weak_area_reports ON public.tests`);
  const validId = randomUUID();
  const heOnlyId = randomUUID();
  const deletedId = randomUUID();
  await database.insert(tests).values([
    { id: validId, title: "JK source", forUsers: ["JK"] },
    { id: heOnlyId, title: "HE source", forUsers: ["HE"] },
    { id: deletedId, title: "Deleted source", forUsers: ["JK"], deletedAt: "2026-10-27T11:00:00Z" },
  ]);
  const reportIds = [validId, heOnlyId, deletedId, randomUUID()].map((sourceTestId) => ({ id: randomUUID(), sourceTestId }));
  await database.insert(weakAreaReports).values(reportIds.map((row) => ({ ...row, sourceTitle: "Saved name", areas })));
  const migration = await readFile(new URL("../src/db/migrations/0006_weak_report_lifecycle.sql", import.meta.url), "utf8");
  await database.$client.exec(migration);
  await database.$client.exec(migration);
  assert.deepEqual((await database.select().from(weakAreaReports)).map((row) => row.id), [reportIds[0].id]);
  await database.delete(tests).where(eq(tests.id, validId));
  assert.equal((await database.select().from(weakAreaReports)).length, 0);
});
