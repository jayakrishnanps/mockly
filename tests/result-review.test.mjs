import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAnswerReview } from "../src/lib/result-review.ts";

function question(id, position, correctIndex = 0) {
  return { id, position, correctIndex, questionText: `Question ${position}`, options: ["One", "Two", "Three", "Four"] };
}

function answer(questionId, selectedIndex, timeSpentMs) {
  return { questionId, selectedIndex, timeSpentMs, markedForReview: false, visited: true };
}

test("answer review shows mistakes, then skips, then correct answers from slowest to fastest", () => {
  const questions = [
    question("fast", 1), question("wrong-fast", 2), question("slow", 3),
    question("skipped", 4), question("wrong-slow", 5), question("medium", 6),
  ];
  const answers = [
    answer("fast", 0, 1000), answer("wrong-fast", 1, 2000), answer("slow", 0, 90000),
    answer("skipped", null, 100000), answer("wrong-slow", 2, 4000), answer("medium", 0, 20000),
  ];
  const review = buildAnswerReview(questions, answers);

  assert.deepEqual(review.map(({ question }) => question.id), [
    "wrong-slow", "wrong-fast", "skipped", "slow", "medium", "fast",
  ]);
  assert.deepEqual(review.map(({ status }) => status), ["wrong", "wrong", "skipped", "correct", "correct", "correct"]);
  assert.deepEqual(review.map(({ question }) => question.position), [5, 2, 4, 3, 6, 1]);
});

test("review keeps saved questions, options and answers unchanged and retains original order for equal times", () => {
  const questions = [question("a", 1, 2), question("b", 2, 3), question("c", 3, 1)];
  const answers = [answer("c", 1, 4000), answer("b", 3, 5000), answer("a", 2, 5000)];
  const savedQuestions = structuredClone(questions);
  const savedAnswers = structuredClone(answers);
  const review = buildAnswerReview(questions, answers);

  assert.deepEqual(review.map(({ question }) => question.id), ["a", "b", "c"]);
  assert.equal(review[0].question, questions[0]);
  assert.equal(review[0].answer, answers[2]);
  assert.deepEqual(questions, savedQuestions);
  assert.deepEqual(answers, savedAnswers);
});

test("review handles empty attempts, missing answers and zero recorded time without omitting questions", () => {
  assert.deepEqual(buildAnswerReview([], []), []);
  const questions = [question("correct", 1), question("missing", 2), question("skipped", 3), question("wrong", 4)];
  const review = buildAnswerReview(questions, [
    answer("correct", 0, 0), answer("skipped", null, 0), answer("wrong", 1, 0),
  ]);

  assert.deepEqual(review.map(({ question }) => question.id), ["wrong", "missing", "skipped", "correct"]);
  assert.equal(review[1].status, "skipped");
  assert.equal(review[1].answer, undefined);
});
