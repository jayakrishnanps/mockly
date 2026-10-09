import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuestionCount, selectQuestions } from "../src/lib/question-selection.ts";

test("ordinary mocks keep all questions and reject a smaller requested set", () => {
  assert.deepEqual(resolveQuestionCount(60, null, undefined), { ok: true, count: 60 });
  assert.deepEqual(resolveQuestionCount(60, null, 60), { ok: true, count: 60 });
  assert.equal(resolveQuestionCount(60, null, 30).ok, false);
});

test("bank mocks use their configured count, bounded by the available pool", () => {
  assert.deepEqual(resolveQuestionCount(200, 30, undefined), { ok: true, count: 30 });
  assert.deepEqual(resolveQuestionCount(12, 30, undefined), { ok: true, count: 12 });
  assert.deepEqual(resolveQuestionCount(200, 30, 30), { ok: true, count: 30 });
  for (const count of [1, 10, 45, 200]) {
    assert.equal(resolveQuestionCount(200, 30, count).ok, false);
  }
});

test("question counts reject coercion, fractions, empty pools and out-of-range input", () => {
  for (const value of ["30", "", null, true, {}, [], 0, -1, 2.5, 201, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(resolveQuestionCount(200, 30, value).ok, false, `Accepted ${String(value)}`);
  }
  assert.equal(resolveQuestionCount(0, 30, undefined).ok, false);
  assert.equal(resolveQuestionCount(20, 0, undefined).ok, false);
});

test("sampling uses the full pool without duplicates and does not mutate questions", () => {
  const questions = Array.from({ length: 200 }, (_, index) => ({ id: `q${index}`, text: `Question ${index}` }));
  const original = structuredClone(questions);
  const chosen = selectQuestions(questions, 30, [], () => 0);
  assert.equal(chosen.length, 30);
  assert.equal(new Set(chosen.map((question) => question.id)).size, 30);
  assert.equal(chosen.some((question) => question.id === "q30"), true);
  assert.deepEqual(questions, original);
  assert.equal(chosen.every((question) => questions.includes(question)), true);
});

test("retakes avoid repeating the entire previous order where possible", () => {
  const questions = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const previous = questions.map((question) => question.id);
  const chosen = selectQuestions(questions, 3, previous, (upper) => upper - 1);
  assert.notDeepEqual(chosen.map((question) => question.id), previous);
  assert.deepEqual(new Set(chosen.map((question) => question.id)), new Set(previous));
  assert.deepEqual(selectQuestions([{ id: "a" }], 1, ["a"], () => 0), [{ id: "a" }]);
});

test("sampling rejects invalid sizes rather than returning an incomplete selection", () => {
  for (const count of [0, -1, 2, 0.5, NaN]) {
    assert.throws(() => selectQuestions([{ id: "a" }], count, [], () => 0), RangeError);
  }
});
