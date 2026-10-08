import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../src/db/schema.ts";
import { createBankStore } from "../src/server/bank-store.ts";
import { createMockStore } from "../src/server/mock-store.ts";
import { defaultMetadata } from "../src/lib/mock-validation.ts";
import { validateBankMock } from "../src/lib/bank-validation.ts";

// Opt-in integration checks allocate and clean up only the UUIDs created here.
test("bank transactions, independent mocks, pagination and retry safety", { skip: process.env.MOCKLY_INTEGRATION_TESTS !== "1" }, async (t) => {
  config({ path: ".env.local", quiet: true });
  assert.ok(process.env.DATABASE_URL);
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set("sslmode", "verify-full");
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true } });
  const database = drizzle(pool);
  const store = createBankStore(database);
  const mockStore = createMockStore(database);
  const bankIds = [];
  const testIds = [];
  t.after(async () => {
    try {
      if (testIds.length) await database.delete(schema.tests).where(inArray(schema.tests.id, testIds));
      if (bankIds.length) await database.delete(schema.questionBanks).where(inArray(schema.questionBanks.id, bankIds));
    } finally { await pool.end(); }
  });
  const questions = (size = 2) => Array.from({ length: size }, (_, index) => ({
    id: randomUUID(), questionText: `Question ${index + 1}: $\\frac{3}{4}$`, options: ["one", "two", "three", "four"], correctIndex: index % 4,
  }));
  const bank = { id: randomUUID(), title: `[Bank verification] ${randomUUID()}` };
  bankIds.push(bank.id);
  function mockRequest(bankId = bank.id, questionLimit = 3) {
    const testId = randomUUID();
    testIds.push(testId);
    const checked = validateBankMock({
      bankId, testId, questionLimit,
      metadata: { ...defaultMetadata(), title: `[Bank mock verification] ${testId}`, forUsers: ["HE"] },
    });
    assert.ok(checked.value);
    return checked.value;
  }

  await t.test("creating an empty bank and retries do not duplicate it", async () => {
    const results = await Promise.all([store.create(bank), store.create(bank)]);
    assert.equal(results.filter((result) => result.alreadySaved).length, 1);
    const loaded = await store.get(bank.id);
    assert.equal(loaded.questionCount, 0);
    assert.deepEqual(loaded.questions, []);
    assert.equal(loaded.hasNext, false);
    await assert.rejects(store.create({ ...bank, title: "changed" }), { code: "conflict" });
    await assert.rejects(store.createMock(mockRequest()), { code: "invalid" });
  });

  await t.test("concurrent appends preserve positions and retries reject mixed or changed IDs", async () => {
    const first = { bankId: bank.id, questions: questions(26) };
    const second = { bankId: bank.id, questions: questions(4) };
    await Promise.all([store.append(first), store.append(first), store.append(second)]);
    const pageOne = await store.get(bank.id);
    const pageTwo = await store.get(bank.id, 2);
    assert.equal(pageOne.questionCount, 30);
    assert.equal(pageOne.questions.length, 25);
    assert.equal(pageOne.hasNext, true);
    assert.equal(pageTwo.questions.length, 5);
    assert.equal(pageTwo.hasNext, false);
    assert.deepEqual([...pageOne.questions, ...pageTwo.questions].map((q) => q.position), Array.from({ length: 30 }, (_, i) => i + 1));
    assert.equal((await store.append(first)).alreadySaved, true);
    await assert.rejects(store.append({ ...first, questions: [{ ...first.questions[0], questionText: "changed" }] }), { code: "conflict" });
    await assert.rejects(store.append({ ...first, questions: [first.questions[0], ...questions()] }), { code: "conflict" });
    const invalid = questions();
    invalid[1].correctIndex = 7;
    await assert.rejects(store.append({ bankId: bank.id, questions: invalid }));
    assert.equal((await store.get(bank.id)).questionCount, 30);
    await assert.rejects(store.get(bank.id, 0), { code: "invalid" });
  });

  const input = mockRequest();
  await t.test("bank mock copies the whole pool with independent IDs and selected default count", async () => {
    const outcomes = await Promise.all([store.createMock(input), store.createMock(input)]);
    assert.equal(outcomes.filter((outcome) => outcome.alreadySaved).length, 1);
    const loaded = await mockStore.get(input.testId);
    assert.equal(loaded.questionLimit, 3);
    assert.deepEqual(loaded.forUsers, ["HE"]);
    assert.equal(loaded.questions.length, 30);
    const bankQuestions = await database.select().from(schema.bankQuestions).where(eq(schema.bankQuestions.bankId, bank.id));
    const ids = new Set(bankQuestions.map((q) => q.id));
    assert.ok(loaded.questions.every((q) => !ids.has(q.id)));
    await assert.rejects(store.createMock({ ...input, questionLimit: 4 }), { code: "conflict" });
    await assert.rejects(store.createMock({ ...input, metadata: { ...input.metadata, title: "changed" } }), { code: "conflict" });
    const tooMany = mockRequest(bank.id, 31);
    await assert.rejects(store.createMock(tooMany), { code: "invalid" });
    assert.equal(await mockStore.get(tooMany.testId), null);
  });

  await t.test("appending or removing the source cannot alter saved mocks or duplicate a retry", async () => {
    const before = await mockStore.get(input.testId);
    await store.append({ bankId: bank.id, questions: questions(2) });
    assert.equal((await store.createMock(input)).alreadySaved, true);
    assert.deepEqual(await mockStore.get(input.testId), before);
    const removedMock = mockRequest();
    await store.createMock(removedMock);
    await mockStore.remove(removedMock.testId);
    assert.equal((await store.get(bank.id)).questionCount, 32);
    await assert.rejects(store.createMock(removedMock), { code: "not-found" });
    await store.remove(bank.id);
    assert.equal(await store.get(bank.id), null);
    assert.deepEqual(await mockStore.get(input.testId), before);
    assert.equal((await store.createMock(input)).alreadySaved, true);
    assert.equal((await database.select().from(schema.bankQuestions).where(eq(schema.bankQuestions.bankId, bank.id))).length, 0);
    await assert.rejects(store.append({ bankId: bank.id, questions: questions() }), { code: "not-found" });
    await store.remove(bank.id);
  });
});
