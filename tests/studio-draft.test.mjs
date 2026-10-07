import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { parseQuestions } from "../src/lib/parser.ts";
import { appendParsedBatch, emptyStudioDraft, loadStudioDraft, saveStudioDraft, STUDIO_STORAGE_KEY, LEGACY_STORAGE_KEY, studioStorageKey, prepareDraftSave, clearSavedDraft } from "../src/lib/studio-draft.ts";

const valid = "Q1. What is 2 + 2?\nA) 3\nB) 4\nC) 5\nD) 6\nAns: B";
const invalid = valid.replace("Ans: B", "");
let nextId = 0;
const createId = () => `test-${++nextId}`;

function memoryStorage() {
  const values = new Map([["mockly:user", "HE"]]);
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test("repeated imports append and survive a browser-storage round trip", () => {
  const storage = memoryStorage();
  let draft = appendParsedBatch(emptyStudioDraft(), parseQuestions(valid + "\n\n" + invalid), createId);
  draft = appendParsedBatch(draft, parseQuestions(valid), createId);
  assert.equal(draft.questions.length, 2);
  assert.equal(draft.problems.length, 1);
  assert.equal(new Set(draft.questions.map((item) => item.id)).size, 2);
  draft.input = "An unfinished paste";
  draft.problems[0].editedSource = invalid + "\nAn unfinished repair";
  assert.equal(saveStudioDraft(draft, () => storage), null);
  assert.deepEqual(loadStudioDraft(() => storage).draft, draft);
  assert.equal(storage.values.get("mockly:user"), "HE");
});

test("repairing one block retains other problems and the existing draft", () => {
  let draft = appendParsedBatch(emptyStudioDraft(), parseQuestions(valid + "\n\n" + invalid + "\n\n" + invalid), createId);
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
  let draft = appendParsedBatch(emptyStudioDraft(), parseQuestions(invalid), createId);
  const previousId = draft.problems[0].id;
  draft = appendParsedBatch(draft, parseQuestions(invalid), createId, previousId);
  assert.equal(draft.questions.length, 0);
  assert.equal(draft.problems.length, 1);
  assert.notEqual(draft.problems[0].id, previousId);
});

test("corrupt, unsupported, or structurally invalid storage is not overwritten on load", () => {
  const storage = memoryStorage();
  const good = appendParsedBatch(emptyStudioDraft(), parseQuestions(valid), createId);
  const badOptions = structuredClone(good);
  badOptions.questions[0].options.pop();
  const badIndex = structuredClone(good);
  badIndex.questions[0].correctIndex = 7;
  const duplicateIds = structuredClone(good);
  duplicateIds.questions.push(duplicateIds.questions[0]);
  for (const raw of ["{broken", "null", JSON.stringify({ version: 2 }), JSON.stringify(badOptions), JSON.stringify(badIndex), JSON.stringify(duplicateIds)]) {
    storage.setItem(STUDIO_STORAGE_KEY, raw);
    const loaded = loadStudioDraft(() => storage);
    assert.deepEqual(loaded.draft, emptyStudioDraft());
    assert.ok(loaded.storageError);
    assert.equal(storage.getItem(STUDIO_STORAGE_KEY), raw);
  }
});

test("denied storage getters, failed reads and quota errors are safe", () => {
  const denied = () => { throw new Error("Denied"); };
  assert.ok(loadStudioDraft(denied).storageError);
  assert.ok(saveStudioDraft(emptyStudioDraft(), denied));
  assert.ok(loadStudioDraft(() => ({ getItem: denied })).storageError);
  assert.ok(saveStudioDraft(emptyStudioDraft(), () => ({ setItem: denied })));
});

test("empty storage does not write anything merely by loading", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadStudioDraft(() => storage), { draft: emptyStudioDraft(), storageError: null });
  assert.equal(storage.values.size, 1);
});

test("new and individual append drafts persist independently, including incomplete metadata", () => {
  const storage = memoryStorage();
  for (const context of [{ kind: "new" }, { kind: "append", testId: randomUUID() }, { kind: "append", testId: randomUUID() }]) {
    const draft = appendParsedBatch(emptyStudioDraft(context), parseQuestions(valid), randomUUID);
    draft.metadata.title = `Unfinished ${studioStorageKey(context)}`;
    draft.metadata.durationMinutes = "";
    saveStudioDraft(draft, () => storage);
    assert.deepEqual(loadStudioDraft(() => storage, context).draft, draft);
  }
  assert.equal(storage.values.size, 4);
});

test("v1 migration keeps questions, problem repairs and input without changing the backup", () => {
  const storage = memoryStorage();
  const draft = appendParsedBatch(emptyStudioDraft(), parseQuestions(valid + "\n\n" + invalid), randomUUID);
  const legacy = { version: 1, input: "unfinished", questions: draft.questions, problems: draft.problems, lastBatch: draft.lastBatch };
  legacy.problems[0].editedSource = "repair in progress";
  const raw = JSON.stringify(legacy);
  storage.setItem(LEGACY_STORAGE_KEY, raw);
  const loaded = loadStudioDraft(() => storage);
  assert.equal(loaded.storageError, null);
  assert.equal(loaded.draft.version, 2);
  assert.equal(loaded.draft.input, "unfinished");
  assert.deepEqual(loaded.draft.questions, legacy.questions);
  assert.deepEqual(loaded.draft.problems, legacy.problems);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), raw);
  assert.equal(storage.getItem(STUDIO_STORAGE_KEY), null);
  const appendContext = { kind: "append", testId: randomUUID() };
  assert.deepEqual(loadStudioDraft(() => storage, appendContext).draft, emptyStudioDraft(appendContext));
  saveStudioDraft(clearSavedDraft(loaded.draft), () => storage);
  assert.equal(loadStudioDraft(() => storage).draft.questions.length, 0, "v1 must not reappear after a successful save");
});

test("a failed/uncertain save retains all data and stable retry IDs across refresh", () => {
  const storage = memoryStorage();
  const draft = appendParsedBatch(emptyStudioDraft(), parseQuestions(valid + "\n\n" + invalid), createId);
  draft.input = "unfinished paste";
  draft.metadata.title = "Do not lose this";
  const snapshot = prepareDraftSave(draft, randomUUID);
  saveStudioDraft(snapshot, () => storage);
  const refreshed = loadStudioDraft(() => storage).draft;
  assert.deepEqual(refreshed, snapshot);
  assert.deepEqual(prepareDraftSave(refreshed, randomUUID), snapshot);
  assert.equal(snapshot.questions[0].questionText, draft.questions[0].questionText);
  const cleared = clearSavedDraft(snapshot);
  assert.equal(cleared.questions.length, 0);
  assert.equal(cleared.metadata.title, "");
  assert.equal(cleared.submissionId, null);
  assert.equal(cleared.input, draft.input);
  assert.deepEqual(cleared.problems, draft.problems);
});

test("context-mismatched and corrupt metadata storage never mix into another draft", () => {
  const storage = memoryStorage();
  const context = { kind: "append", testId: randomUUID() };
  for (const draft of [emptyStudioDraft(), { ...emptyStudioDraft(context), metadata: null }, { ...emptyStudioDraft(context), submissionId: "bad" }]) {
    storage.setItem(studioStorageKey(context), JSON.stringify(draft));
    const loaded = loadStudioDraft(() => storage, context);
    assert.ok(loaded.storageError);
    assert.deepEqual(loaded.draft, emptyStudioDraft(context));
  }
});

test("unknown persisted parser errors are rejected without overwriting the original draft", () => {
  const storage = memoryStorage();
  const draft = appendParsedBatch(emptyStudioDraft(), parseQuestions(invalid), randomUUID);
  draft.problems[0].errors[0].code = "not_a_parser_error";
  const raw = JSON.stringify(draft);
  storage.setItem(STUDIO_STORAGE_KEY, raw);

  const loaded = loadStudioDraft(() => storage);
  assert.ok(loaded.storageError);
  assert.equal(storage.getItem(STUDIO_STORAGE_KEY), raw);
});

test("duplicate and unknown identities in saved metadata are treated as corrupt storage", () => {
  const storage = memoryStorage();
  for (const forUsers of [["JK", "JK"], ["HE", "unknown"]]) {
    const draft = emptyStudioDraft();
    draft.metadata.forUsers = forUsers;
    const raw = JSON.stringify(draft);
    storage.setItem(STUDIO_STORAGE_KEY, raw);

    assert.ok(loadStudioDraft(() => storage).storageError);
    assert.equal(storage.getItem(STUDIO_STORAGE_KEY), raw);
  }
});
