import assert from "node:assert/strict";
import test from "node:test";
import { resolveQuestionCount, selectBankQuestions, selectQuestions, shuffleQuestionOptions } from "../src/lib/question-selection.ts";
import { scoreAttempt } from "../src/lib/scoring.ts";
import { generateResultTxt, toExportableResult } from "../src/lib/export.ts";

function seededRandom(seed) {
  let state = seed >>> 0;
  return (upperBound) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return Math.floor(state / 4294967296 * upperBound);
  };
}

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

test("bank selection reserves up to a fifth for oldest wrongs before meaningful skips", () => {
  const questions = Array.from({ length: 100 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map(questions.slice(0, 8).map((question, index) => [question.id, {
    count: 4, lastPractisedAt: 1000 + index, review: index < 7 ? "wrong" : "skipped",
  }]));
  const selected = selectBankQuestions(questions, 30, history, () => 0);
  const ids = selected.map((question) => question.id);
  assert.equal(ids.length, 30);
  assert.equal(new Set(ids).size, 30);
  assert.equal(ids.filter((id) => history.get(id)?.review === "wrong").length, 6);
  assert.equal(ids.filter((id) => history.get(id)?.review === "skipped").length, 0);
  assert.equal(ids.filter((id) => !history.has(id)).length, 24);
});

test("bank selection fills small and exhausted pools without exceeding unique questions", () => {
  const shortPool = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const history = new Map([
    ["a", { count: 2, lastPractisedAt: 100, review: "wrong" }],
    ["b", { count: 4, lastPractisedAt: 200, review: "skipped" }],
    ["c", { count: 1, lastPractisedAt: 50, review: null }],
  ]);
  assert.equal(selectBankQuestions(shortPool, 1, history, () => 0)[0].id, "a");
  assert.equal(new Set(selectBankQuestions(shortPool, 3, history, () => 0).map((question) => question.id)).size, 3);
  const fiveQuestions = [...shortPool, { id: "d" }, { id: "e" }, { id: "f" }, { id: "g" }];
  assert.ok(selectBankQuestions(fiveQuestions, 5, history, () => 0).some((question) => question.id === "a"));
  assert.throws(() => selectBankQuestions([{ id: "a" }, { id: "a" }], 1, new Map(), () => 0), RangeError);
});

test("bank selection keeps one review place in mocks shorter than five questions", () => {
  const pool = Array.from({ length: 20 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map([
    ["q18", { count: 10, lastPractisedAt: 200, review: "wrong" }],
    ["q19", { count: 1, lastPractisedAt: 100, review: "skipped" }],
  ]);
  for (let count = 1; count < 5; count++) {
    const selected = selectBankQuestions(pool, count, history, () => 0);
    assert.equal(selected.length, count);
    assert.ok(selected.some((question) => question.id === "q18"));
    assert.equal(selected.filter((question) => history.has(question.id)).length, 1);
  }
});

test("bank selection fills from the fewest previous encounters after unseen questions run out", () => {
  const pool = Array.from({ length: 100 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map(pool.map((question, index) => [question.id, {
    count: index < 20 ? 1 : index < 40 ? 2 : 3,
    lastPractisedAt: 1000 + index, review: null,
  }]));
  const selected = selectBankQuestions(pool, 30, history, seededRandom(17));
  assert.equal(selected.filter((question) => history.get(question.id).count === 1).length, 20);
  assert.equal(selected.filter((question) => history.get(question.id).count === 2).length, 10);
  assert.equal(selected.filter((question) => history.get(question.id).count === 3).length, 0);
});

test("bank selection gives vacant review places to the oldest meaningful skips after wrong answers", () => {
  const pool = Array.from({ length: 100 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map(pool.slice(0, 8).map((question, index) => [question.id, {
    count: 10, lastPractisedAt: index < 3 ? 5000 + index : 1000 + index,
    review: index < 3 ? "wrong" : "skipped",
  }]));
  const selected = selectBankQuestions(pool, 30, history, seededRandom(9));
  const selectedReviewIds = selected.filter((question) => history.has(question.id)).map((question) => question.id);
  assert.deepEqual(new Set(selectedReviewIds), new Set(["q0", "q1", "q2", "q3", "q4", "q5"]));
  assert.equal(selected.filter((question) => !history.has(question.id)).length, 24);
});

test("bank selection rotates review priority toward the mistakes practised least recently", () => {
  const pool = Array.from({ length: 100 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map(pool.slice(0, 10).map((question, index) => [question.id, {
    count: 10, lastPractisedAt: 1000 + index, review: "wrong",
  }]));
  const first = selectBankQuestions(pool, 30, history, seededRandom(11));
  const firstReview = first.filter((question) => history.has(question.id));
  assert.deepEqual(new Set(firstReview.map((question) => question.id)), new Set(["q0", "q1", "q2", "q3", "q4", "q5"]));
  for (const question of firstReview) {
    const previous = history.get(question.id);
    history.set(question.id, { ...previous, count: previous.count + 1, lastPractisedAt: previous.lastPractisedAt + 5000 });
  }
  const second = selectBankQuestions(pool, 30, history, seededRandom(12));
  const secondReview = second.filter((question) => history.has(question.id));
  assert.deepEqual(new Set(secondReview.map((question) => question.id)), new Set(["q6", "q7", "q8", "q9", "q0", "q1"]));
});

test("bank selection fills the requested count when review questions exceed their reserved share", () => {
  const pool = Array.from({ length: 6 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map(pool.map((question, index) => [question.id, {
    count: 1, lastPractisedAt: 1000 + index, review: index < 3 ? "wrong" : "skipped",
  }]));
  const selected = selectBankQuestions(pool, 5, history, seededRandom(4));
  assert.equal(selected.length, 5);
  assert.equal(new Set(selected.map((question) => question.id)).size, 5);
  assert.ok(selected.every((question) => pool.includes(question)));
  assert.ok(selected.some((question) => question.id === "q0"));
});

test("final bank shuffle can place a review question in every position without mutating input", () => {
  const pool = Array.from({ length: 10 }, (_, index) => ({ id: `q${index}`, text: `Question ${index}` }));
  const history = new Map([["q9", { count: 10, lastPractisedAt: 1000, review: "wrong" }]]);
  const originalPool = structuredClone(pool);
  const originalHistory = structuredClone(history);
  for (let position = 0; position < 5; position++) {
    let initialShuffleCalls = pool.length - 1;
    const selected = selectBankQuestions(pool, 5, history, (upperBound) => {
      if (initialShuffleCalls-- > 0) return upperBound - 1;
      return upperBound === position + 1 ? 0 : upperBound - 1;
    });
    assert.equal(selected.findIndex((question) => question.id === "q9"), position);
    assert.equal(new Set(selected.map((question) => question.id)).size, 5);
    assert.deepEqual(pool, originalPool);
    assert.deepEqual(history, originalHistory);
  }
});

test("500-question bank keeps review places and unseen questions across deterministic random draws", () => {
  const pool = Array.from({ length: 500 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map(pool.slice(0, 350).map((question, index) => [question.id, {
    count: index < 20 ? 8 : 2, lastPractisedAt: 1000 + index,
    review: index < 10 ? "wrong" : index < 20 ? "skipped" : null,
  }]));
  const selections = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const selected = selectBankQuestions(pool, 30, history, seededRandom(seed));
    assert.equal(selected.length, 30);
    assert.equal(new Set(selected.map((question) => question.id)).size, 30);
    assert.ok(selected.every((question) => pool.includes(question)));
    assert.deepEqual(new Set(selected.filter((question) => history.has(question.id)).map((question) => question.id)), new Set(["q0", "q1", "q2", "q3", "q4", "q5"]));
    assert.equal(selected.filter((question) => !history.has(question.id)).length, 24);
    selections.add(selected.map((question) => question.id).join(","));
  }
  assert.ok(selections.size > 1);
});

test("30-question mocks cover all 500 bank questions before ordinary questions repeat", () => {
  const pool = Array.from({ length: 500 }, (_, index) => ({ id: `q${index}` }));
  const history = new Map();
  for (let sitting = 0; sitting < 17; sitting++) {
    const selected = selectBankQuestions(pool, 30, history, seededRandom(sitting + 1));
    const unseenCount = selected.filter((question) => !history.has(question.id)).length;
    assert.equal(unseenCount, sitting < 16 ? 30 : 20);
    assert.equal(new Set(selected.map((question) => question.id)).size, 30);
    for (const question of selected) {
      history.set(question.id, {
        count: (history.get(question.id)?.count ?? 0) + 1,
        lastPractisedAt: sitting + 1, review: null,
      });
    }
  }
  assert.equal(history.size, 500);
  assert.equal([...history.values()].filter((practice) => practice.count === 2).length, 10);
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

test("scoring and TXT exports use answer text from the shuffled snapshot", () => {
  const question = { id: "question-1", position: 1, questionText: "Pick the correct value", options: ["one", "two", "three", "four"], correctIndex: 0 };
  const snapshot = { ...question, ...shuffleQuestionOptions(question, () => 0) };
  const answers = [{ questionId: question.id, selectedIndex: snapshot.correctIndex, timeSpentMs: 1000, markedForReview: false, visited: true }];
  const scored = scoreAttempt({ marksCorrect: 2, marksWrong: 0.5, correctIndexes: new Map([[snapshot.id, snapshot.correctIndex]]), answers });
  assert.equal(scored.score, 2);
  const wrongAnswers = [{ ...answers[0], selectedIndex: 0 }];
  const wrongScore = scoreAttempt({ marksCorrect: 2, marksWrong: 0.5, correctIndexes: new Map([[snapshot.id, snapshot.correctIndex]]), answers: wrongAnswers });
  const result = toExportableResult({
    attempt: { takenBy: "JK", submittedAt: "2026-10-10T00:00:00.000Z", timeTakenSeconds: 1, score: wrongScore.score.toFixed(2), correctCount: wrongScore.correctCount, wrongCount: wrongScore.wrongCount, skippedCount: wrongScore.skippedCount, answers: wrongAnswers },
    mock: { title: "Shuffled", durationMinutes: 20, marksCorrect: "2" }, questions: [snapshot], allScores: [],
  });
  const text = generateResultTxt(result);
  assert.ok(text.includes("Correct option: one"));
  assert.ok(text.includes("Selected wrong option: two"));
  assert.ok(!text.includes("three"));
  assert.ok(!text.includes("four"));
});
