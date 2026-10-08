import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import {
  emptyBankForm, emptyBankMock, loadBankForm, saveBankForm, loadBankMock, saveBankMock,
  loadBankQuestions, saveBankQuestions, nextBankBatch, retryBankBatch,
} from "../src/lib/bank-draft.ts";
import { appendParsedBatch, emptyStudioDraft, saveStudioDraft, loadStudioDraft } from "../src/lib/studio-draft.ts";
import { parseQuestions } from "../src/lib/parser.ts";

const source = "Q1. What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nAns: B";

function memoryStorage() {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("bank question drafts stay separate from Studio and other banks", () => {
  const storage = memoryStorage();
  const bankId = randomUUID();
  const otherId = randomUUID();
  const context = { kind: "append", testId: bankId };
  const draft = appendParsedBatch(emptyStudioDraft(context), parseQuestions(source), randomUUID);
  draft.input = "Unfinished paste";
  saveBankQuestions(bankId, draft, () => storage);
  saveStudioDraft({ ...draft, input: "Studio paste" }, () => storage);
  assert.deepEqual(loadBankQuestions(bankId, () => storage).draft, { ...draft, pendingQuestionIds: null });
  assert.equal(loadStudioDraft(() => storage, context).draft.input, "Studio paste");
  assert.equal(loadBankQuestions(otherId, () => storage).draft.questions.length, 0);
});

test("bank and mock creation IDs and unfinished metadata survive refresh", () => {
  const storage = memoryStorage();
  const bankId = randomUUID();
  const form = { ...emptyBankForm(), title: "Arithmetic", id: bankId };
  saveBankForm(form, () => storage);
  assert.deepEqual(loadBankForm(() => storage).draft, form);
  const mock = { ...emptyBankMock("Arithmetic", 200), testId: randomUUID(), questionLimit: "" };
  mock.metadata.durationMinutes = "";
  mock.metadata.forUsers = ["HE"];
  saveBankMock(bankId, mock, () => storage);
  assert.deepEqual(loadBankMock(bankId, "Changed bank title", 250, () => storage).draft, mock);
  assert.equal(emptyBankMock("Small bank", 12).questionLimit, "12");
  assert.equal(emptyBankMock("Big bank", 200).questionLimit, "30");
});

test("corrupt bank forms remain untouched on load and blocked storage is reported", () => {
  const storage = memoryStorage();
  const bankId = randomUUID();
  storage.setItem("mockly:bank-create:v1", "{broken");
  storage.setItem(`mockly:bank-mock:v1:${bankId}`, JSON.stringify({ version: 1, testId: "not-a-uuid" }));
  assert.ok(loadBankForm(() => storage).storageError);
  assert.equal(storage.getItem("mockly:bank-create:v1"), "{broken");
  assert.ok(loadBankMock(bankId, "Bank", 30, () => storage).storageError);
  const denied = () => { throw new Error("Unavailable"); };
  assert.ok(saveBankForm(emptyBankForm(), denied));
  assert.ok(loadBankMock(bankId, "Bank", 30, denied).storageError);
  assert.ok(saveBankQuestions(bankId, emptyStudioDraft(), denied));
});

test("bounded question batches preserve IDs, ordering, and Unicode payload limits", () => {
  const questions = Array.from({ length: 5 }, (_, index) => ({
    id: randomUUID(), questionText: `Question ${index} ${"अ".repeat(50)}`,
    options: ["One", "Two", "Three", "Four"], correctIndex: 1, raw: source, sourceNumber: "1",
  }));
  let remaining = [...questions];
  const all = [];
  while (remaining.length) {
    const batch = nextBankBatch(remaining, 700);
    assert.ok(batch.length);
    assert.ok(Buffer.byteLength(JSON.stringify(batch), "utf8") <= 700);
    all.push(...batch);
    remaining = remaining.slice(batch.length);
  }
  assert.deepEqual(all.map((item) => item.id), questions.map((item) => item.id));
  assert.deepEqual(nextBankBatch(questions, 10), []);
  assert.equal(questions.length, 5);
});

test("a lost response retains the exact batch through refresh and later imports", () => {
  const storage = memoryStorage();
  const bankId = randomUUID();
  const context = { kind: "append", testId: bankId };
  const original = appendParsedBatch(emptyStudioDraft(context), parseQuestions(source), randomUUID);
  const pendingQuestionIds = original.questions.map((question) => question.id);
  const draft = { ...original, pendingQuestionIds };
  const submitted = retryBankBatch(draft);
  saveBankQuestions(bankId, draft, () => storage);
  const restored = loadBankQuestions(bankId, () => storage).draft;
  assert.deepEqual(retryBankBatch(restored), submitted);
  const withLaterImport = { ...appendParsedBatch(restored, parseQuestions(source), randomUUID), pendingQuestionIds };
  assert.equal(withLaterImport.questions.length, 2);
  assert.deepEqual(retryBankBatch(withLaterImport), submitted);
  const confirmed = new Set(submitted.map((question) => question.id));
  const remaining = { ...withLaterImport, pendingQuestionIds: null, questions: withLaterImport.questions.filter((question) => !confirmed.has(question.id)) };
  assert.equal(retryBankBatch(remaining).length, 1);
  assert.notEqual(retryBankBatch(remaining)[0].id, submitted[0].id);
});
