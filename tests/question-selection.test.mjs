import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuestionCount, selectQuestions, shuffleQuestionOptions } from "../src/lib/question-selection.ts";
import { scoreAttempt } from "../src/lib/scoring.ts";
import { generateResultTxt, toExportableResult } from "../src/lib/export.ts";

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
  const chosen = selectQuestions(questions, 30, () => 0);
  assert.equal(chosen.length, 30);
  assert.equal(new Set(chosen.map((question) => question.id)).size, 30);
  assert.equal(chosen.some((question) => question.id === "q30"), true);
  assert.deepEqual(questions, original);
  assert.equal(chosen.every((question) => questions.includes(question)), true);
  const fromEnd = selectQuestions(questions, 30, (upper) => upper === questions.length ? 0 : upper - 1);
  assert.equal(fromEnd[0].id, "q199");
});

test("independent draws allow every ordered selection, including a repeated one", () => {
  const questions = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const selections = new Set();
  for (let first = 0; first < 3; first++) {
    for (let second = 0; second < 2; second++) {
      const choices = [first, second];
      selections.add(selectQuestions(questions, 2, () => choices.shift()).map((question) => question.id).join(","));
    }
  }
  assert.equal(selections.size, 6);
  assert.deepEqual(selectQuestions(questions, 3, (upper) => upper - 1), questions);
  assert.deepEqual(selectQuestions(questions, 3, (upper) => upper - 1), questions);
  assert.deepEqual(selectQuestions([{ id: "a" }], 1, () => 0), [{ id: "a" }]);
});

test("sampling rejects invalid sizes rather than returning an incomplete selection", () => {
  for (const count of [0, -1, 2, 0.5, NaN]) {
    assert.throws(() => selectQuestions([{ id: "a" }], count, () => 0), RangeError);
  }
});

test("all option permutations retain the correct answer without mutating the saved question", () => {
  for (let correctIndex = 0; correctIndex < 4; correctIndex++) {
    const question = { questionText: "Pick the correct value", options: ["one", "two", "three", "four"], correctIndex };
    const original = structuredClone(question);
    const permutations = new Set();
    for (let first = 0; first < 4; first++) {
      for (let second = 0; second < 3; second++) {
        for (let third = 0; third < 2; third++) {
          const choices = [first, second, third];
          const shuffled = shuffleQuestionOptions(question, () => choices.shift());
          permutations.add(shuffled.options.join(","));
          assert.equal(shuffled.options[shuffled.correctIndex], question.options[correctIndex]);
          assert.deepEqual(question, original);
        }
      }
    }
    assert.equal(permutations.size, 24);
  }
});

test("option identity survives duplicate text and invalid answer indexes are rejected", () => {
  const question = { questionText: "Pick a value", options: ["same", "same", "other", "last"], correctIndex: 0 };
  assert.deepEqual(shuffleQuestionOptions(question, () => 0), { options: ["same", "other", "last", "same"], correctIndex: 3 });
  for (const correctIndex of [-1, 4, 1.5, NaN]) {
    assert.throws(() => shuffleQuestionOptions({ ...question, correctIndex }, () => 0), RangeError);
  }
});

test("clear references to option letters or positions retain their original meaning", () => {
  for (const dependent of ["Both A and B", "(A) and (C)", "Either B or C", "Only A", "(C) only", "All of the above", "None of above", "Both above", "The first option", "Option (B)", "Both **A** and **B**"]) {
    const question = { questionText: "Pick the correct choice", options: ["one", "two", "three", dependent], correctIndex: 3 };
    assert.deepEqual(shuffleQuestionOptions(question, () => assert.fail("Dependent choices must retain their order")), { options: question.options, correctIndex: 3 });
  }
  const question = { questionText: "Which answer matches option A?", options: ["one", "two", "three", "four"], correctIndex: 2 };
  assert.deepEqual(shuffleQuestionOptions(question, () => assert.fail("Stem references must retain their meaning")), { options: question.options, correctIndex: 2 });
});

test("Roman-numbered statements, standalone letters and math variables still shuffle", () => {
  for (const options of [["Only I", "Only II", "Both I and II", "Neither I nor II"], ["A", "B", "C", "D"], ["$a+b$", "$a/b$", "$a-b$", "$a \\times b$"]]) {
    const question = { questionText: "If a and b are positive integers, which statements are true?", options, correctIndex: 0 };
    const shuffled = shuffleQuestionOptions(question, () => 0);
    assert.deepEqual(shuffled.options, [...options.slice(1), options[0]]);
    assert.equal(shuffled.correctIndex, 3);
  }
});

test("scoring and TXT exports use the shuffled snapshot's answer letters", () => {
  const question = { id: "question-1", position: 1, questionText: "Pick the correct value", options: ["one", "two", "three", "four"], correctIndex: 0 };
  const snapshot = { ...question, ...shuffleQuestionOptions(question, () => 0) };
  const answers = [{ questionId: question.id, selectedIndex: snapshot.correctIndex, timeSpentMs: 1000, markedForReview: false, visited: true }];
  const scored = scoreAttempt({ marksCorrect: 2, marksWrong: 0.5, correctIndexes: new Map([[snapshot.id, snapshot.correctIndex]]), answers });
  assert.equal(scored.score, 2);
  const result = toExportableResult({
    attempt: { takenBy: "JK", submittedAt: "2026-10-10T00:00:00.000Z", timeTakenSeconds: 1, score: scored.score.toFixed(2), correctCount: scored.correctCount, wrongCount: scored.wrongCount, skippedCount: scored.skippedCount, answers },
    mock: { title: "Shuffled", durationMinutes: 20, marksCorrect: "2" }, questions: [snapshot], allScores: [],
  });
  const text = generateResultTxt(result);
  assert.ok(text.includes("A) two\nB) three\nC) four\nD) one"));
  assert.ok(text.includes("Correct answer: D | Your answer: D | Result: CORRECT"));
});
