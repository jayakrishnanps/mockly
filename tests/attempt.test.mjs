import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { scoreAttempt, calculatePercentile } from "../src/lib/scoring.ts";
import { gradeFromPercentage } from "../src/lib/grades.ts";
import { validateAnswers, questionState, remainingSeconds, addQuestionTime, readRecovery } from "../src/lib/attempt-state.ts";
import { generateResultTxt } from "../src/lib/export.ts";

const ids = [randomUUID(), randomUUID(), randomUUID()];
const answer = (questionId, selectedIndex = null) => ({ questionId, selectedIndex, timeSpentMs: 1000, markedForReview: false, visited: true });
const score = (choices, marksCorrect = 2, marksWrong = 0.5) => scoreAttempt({ marksCorrect, marksWrong, correctIndexes: new Map(ids.map(id => [id, 0])), answers: choices.map((choice, i) => answer(ids[i], choice)) });

for (const [label, choices, expected] of [
  ["all correct", [0, 0, 0], [6, 3, 0, 0]],
  ["all wrong and negative percentage", [1, 1, 1], [-1.5, 0, 3, 0]],
  ["mixed", [0, 1, null], [1.5, 1, 1, 1]],
  ["zero attempted", [null, null, null], [0, 0, 0, 3]],
  ["missing answers count as skipped", [], [0, 0, 0, 3]],
]) test(`scoring: ${label}`, () => {
  const result = score(choices);
  assert.deepEqual([result.score, result.correctCount, result.wrongCount, result.skippedCount], expected);
  assert.equal(result.scorePercent, result.score / 6 * 100);
  assert.ok(Number.isFinite(result.accuracy));
});
test("fractional and custom marking does not accumulate floating-point cents", () => {
  assert.equal(score([0, 0, 0], 0.1, 0.05).score, 0.3);
  assert.equal(score([0, 1, null], 3.25, 0.75).score, 2.5);
  assert.equal(score([0, 1, null]).avgTimeMsPerAttempted, 1500);
});
for (const [percent, grade] of [[100, "S"], [99.99, "A+"], [95, "A+"], [94.99, "A"], [90, "A"], [89.99, "B+"], [85, "B+"], [80, "B"], [75, "C+"], [70, "C"], [60, "D"], [59.99, "Very Bad"], [-10, "Very Bad"]]) {
  test(`grade boundary ${percent}`, () => assert.equal(gradeFromPercentage(percent), grade));
}
test("percentile uses strictly lower other attempts, with ties sharing rank", () => {
  assert.equal(calculatePercentile(2, [2]), null);
  assert.equal(calculatePercentile(4, [1, 2, 4]), 100);
  assert.equal(calculatePercentile(1, [1, 2, 4]), 0);
  assert.equal(calculatePercentile(2, [1, 2, 2]), 50);
  assert.equal(calculatePercentile(2, [2, 2]), 0);
});
test("all five palette states and clear response preserve review marking", () => {
  const base = { ...answer(ids[0]), timeSpentMs: 0, visited: false };
  assert.equal(questionState(base), "not-visited");
  assert.equal(questionState({ ...base, visited: true }), "not-answered");
  assert.equal(questionState({ ...base, selectedIndex: 0 }), "answered");
  assert.equal(questionState({ ...base, markedForReview: true }), "marked");
  assert.equal(questionState({ ...base, selectedIndex: 0, markedForReview: true }), "answered-marked");
});
test("deadline calculation survives refresh and clamps expiry", () => {
  assert.equal(remainingSeconds(60000, 0), 60);
  assert.equal(remainingSeconds(60000, 22000), 38);
  assert.equal(remainingSeconds(60000, 60001), 0);
});
test("question time accumulates across visits and stops at expiry", () => {
  let answers = ids.map(id => ({ ...answer(id), timeSpentMs: 0 }));
  answers = addQuestionTime(answers, 0, 0, 18000, 60000);
  answers = addQuestionTime(answers, 1, 18000, 24000, 60000);
  answers = addQuestionTime(answers, 0, 24000, 35000, 60000);
  assert.deepEqual(answers.map(a => a.timeSpentMs), [29000, 6000, 0]);
  assert.equal(addQuestionTime(answers, 0, 35000, 90000, 60000)[0].timeSpentMs, 54000);
});
test("answer validation rejects missing, foreign, duplicate and malformed data", () => {
  const answers = ids.map(id => answer(id));
  assert.ok(validateAnswers(answers, ids));
  for (const invalid of [answers.slice(1), [...answers, answers[0]], [{ ...answers[0], selectedIndex: 4 }, ...answers.slice(1)], [{ ...answers[0], timeSpentMs: -1 }, ...answers.slice(1)], [{ ...answers[0], questionId: randomUUID() }, ...answers.slice(1)]]) assert.equal(validateAnswers(invalid, ids), null);
});
test("local recovery checks owner, revision, question set and malformed JSON", () => {
  const attemptId = randomUUID();
  const draft = { version: 1, attemptId, user: "JK", revision: 3, current: 1, answers: ids.map(id => answer(id)) };
  const raw = JSON.stringify(draft);
  assert.deepEqual(readRecovery(raw, attemptId, "JK", 3, ids), draft);
  assert.equal(readRecovery(raw, attemptId, "HE", 3, ids), null);
  assert.equal(readRecovery(raw, attemptId, "JK", 4, ids), null);
  assert.equal(readRecovery("{", attemptId, "JK", 3, ids), null);
});
test("text export keeps raw LaTeX, negatives, skipped answers and zero timing", () => {
  const text = generateResultTxt({ mockTitle: "Export", user: "JK", dateStr: "today", durationMinutes: 1, timeTakenSeconds: 0, score: -0.5, maxScore: 2, scorePercent: -25, grade: "Very Bad", percentile: null, attempted: 1, correctCount: 0, wrongCount: 1, skippedCount: 0, totalQuestions: 1, accuracy: 0, avgTimeMsPerAttempted: 0,
    questions: [{ position: 1, questionText: String.raw`$\frac{3}{4}$`, options: ["a", "b", "c", "d"], correctIndex: 1, answer: answer(ids[0], 0) }] });
  assert.ok(text.includes(String.raw`$\frac{3}{4}$`));
  assert.ok(text.includes("-25.00%"));
  assert.ok(text.includes("Average time per attempted question: 0s"));
  assert.ok(text.includes("Correct answer: B | Your answer: A | Result: WRONG"));
});
