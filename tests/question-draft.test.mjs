import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { loadBankQuestions, saveBankQuestions } from "../src/lib/bank-draft.ts";
import { defaultMetadata } from "../src/lib/mock-validation.ts";
import { parseQuestions } from "../src/lib/parser.ts";
import { appendParsedBatch, emptyQuestionDraft, prepareQuestionDraft } from "../src/lib/question-draft.ts";

const valid = "Q1. What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nAns: B";
const invalid = valid.replace("Ans: B", "");
const bankId = randomUUID();
const storageKey = `mockly:bank-questions:v1:${bankId}`;
let nextId = 0;
const createId = () => `test-${++nextId}`;

function memoryStorage() {
  const values = new Map([["mockly:user", "HE"]]);
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("repeated imports append and survive a browser-storage round trip", () => {
  const storage = memoryStorage();
  let draft = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(valid + "\n\n" + invalid), createId);
  draft = appendParsedBatch(draft, parseQuestions(valid), createId);
  assert.equal(draft.questions.length, 2);
  assert.equal(draft.problems.length, 1);
  assert.equal(new Set(draft.questions.map((item) => item.id)).size, 2);
  draft.input = "An unfinished paste";
  draft.problems[0].editedSource = invalid + "\nAn unfinished repair";
  assert.equal(saveBankQuestions(bankId, draft, () => storage), null);
  assert.deepEqual(loadBankQuestions(bankId, () => storage).draft, { ...draft, pendingQuestionIds: null });
  assert.equal(storage.values.get("mockly:user"), "HE");
});

test("repairing one block retains other problems and the existing draft", () => {
  let draft = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(valid + "\n\n" + invalid + "\n\n" + invalid), createId);
  const preservedQuestionId = draft.questions[0].id;
  const otherProblemId = draft.problems[1].id;
  draft.input = "An unfinished new batch";
  draft = appendParsedBatch(draft, parseQuestions(valid), createId, draft.problems[0].id);
  assert.equal(draft.questions.length, 2);
  assert.equal(draft.questions[0].id, preservedQuestionId);
  assert.deepEqual(draft.problems.map((item) => item.id), [otherProblemId]);
  assert.equal(draft.input, "An unfinished new batch");
});

test("a still-invalid repair replaces its problem, without adding a draft question", () => {
  let draft = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(invalid), createId);
  const previousId = draft.problems[0].id;
  draft = appendParsedBatch(draft, parseQuestions(invalid), createId, previousId);
  assert.equal(draft.questions.length, 0);
  assert.equal(draft.problems.length, 1);
  assert.notEqual(draft.problems[0].id, previousId);
});

test("corrupt, unsupported, or structurally invalid storage is not overwritten on load", () => {
  const storage = memoryStorage();
  const good = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(valid), createId);
  const badOptions = structuredClone(good);
  badOptions.questions[0].options.pop();
  const badIndex = structuredClone(good);
  badIndex.questions[0].correctIndex = 7;
  const duplicateIds = structuredClone(good);
  duplicateIds.questions.push(duplicateIds.questions[0]);
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2 }), JSON.stringify(badOptions), JSON.stringify(badIndex), JSON.stringify(duplicateIds)]) {
    storage.setItem(storageKey, raw);
    const loaded = loadBankQuestions(bankId, () => storage);
    assert.deepEqual(loaded.draft, { ...emptyQuestionDraft(bankId), pendingQuestionIds: null });
    assert.ok(loaded.storageError);
    assert.equal(storage.getItem(storageKey), raw);
  }
});

test("denied storage getters, failed reads and quota errors are safe", () => {
  const denied = () => { throw new Error("Denied"); };
  assert.ok(loadBankQuestions(bankId, denied).storageError);
  assert.ok(saveBankQuestions(bankId, emptyQuestionDraft(bankId), denied));
  assert.ok(loadBankQuestions(bankId, () => ({ getItem: denied })).storageError);
  assert.ok(saveBankQuestions(bankId, emptyQuestionDraft(bankId), () => ({ setItem: denied })));
});

test("empty storage does not write anything merely by loading", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadBankQuestions(bankId, () => storage), { draft: { ...emptyQuestionDraft(bankId), pendingQuestionIds: null }, storageError: null });
  assert.equal(storage.values.size, 1);
});

test("existing bank drafts retain questions, repairs and pending retry IDs after standalone removal", () => {
  const storage = memoryStorage();
  const draft = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(valid + "\n\n" + invalid), randomUUID);
  draft.input = "Unfinished bank paste";
  draft.problems[0].editedSource = "Unfinished repair";
  const legacyBankDraft = { ...draft, metadata: defaultMetadata(), submissionId: randomUUID(), pendingQuestionIds: draft.questions.map((question) => question.id) };
  const raw = JSON.stringify(legacyBankDraft);
  storage.setItem(storageKey, raw);
  const loaded = loadBankQuestions(bankId, () => storage);
  assert.equal(loaded.storageError, null);
  assert.deepEqual(loaded.draft, { ...draft, pendingQuestionIds: legacyBankDraft.pendingQuestionIds });
  assert.equal(storage.getItem(storageKey), raw);
});

test("preparing bank questions preserves stable IDs and unfinished work", () => {
  const draft = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(valid + "\n\n" + invalid), createId);
  draft.input = "Unfinished paste";
  const prepared = prepareQuestionDraft(draft, randomUUID);
  assert.notEqual(prepared.questions[0].id, draft.questions[0].id);
  assert.deepEqual(prepareQuestionDraft(prepared, randomUUID), prepared);
  assert.equal(prepared.input, draft.input);
  assert.deepEqual(prepared.problems, draft.problems);
});

test("mismatched bank contexts and unknown parser errors never replace saved drafts", () => {
  const storage = memoryStorage();
  const draft = appendParsedBatch(emptyQuestionDraft(bankId), parseQuestions(invalid), randomUUID);
  const badErrors = structuredClone(draft);
  badErrors.problems[0].errors[0].code = "not_a_parser_error";
  for (const value of [{ ...draft, context: { kind: "new" } }, { ...draft, context: { kind: "append", testId: randomUUID() } }, badErrors]) {
    const raw = JSON.stringify(value);
    storage.setItem(storageKey, raw);
    const loaded = loadBankQuestions(bankId, () => storage);
    assert.ok(loaded.storageError);
    assert.equal(loaded.draft.questions.length, 0);
    assert.equal(storage.getItem(storageKey), raw);
  }
});
