import assert from "node:assert/strict";
import { test } from "node:test";
import { generateMockHistoryTxt, toExportableResult } from "../src/lib/export.ts";
import { scoreAttempt } from "../src/lib/scoring.ts";

function question(id, selectedIndex, timeSpentMs, overrides = {}) {
  return {
    id, position: 1, questionText: `Content for ${id}`,
    options: [`Correct ${id}`, `Mistake ${id}`, `Unused choice ${id}`, `Other distractor ${id}`],
    correctIndex: 0,
    answer: { questionId: id, selectedIndex, timeSpentMs, markedForReview: false, visited: true },
    ...overrides,
  };
}

function attempt(number, questions) {
  const answers = questions.map((entry) => entry.answer);
  const scored = scoreAttempt({
    marksCorrect: 2, marksWrong: 0.5,
    correctIndexes: new Map(questions.map((entry) => [entry.id, entry.correctIndex])), answers,
  });
  return toExportableResult({
    attempt: {
      takenBy: "JK", submittedAt: `2026-10-${String(number).padStart(2, "0")}T00:00:00Z`,
      timeTakenSeconds: answers.reduce((total, answer) => total + answer.timeSpentMs, 0) / 1000,
      score: String(scored.score), correctCount: scored.correctCount, wrongCount: scored.wrongCount,
      skippedCount: scored.skippedCount, answers,
    },
    mock: { title: "Practice", durationMinutes: 30, marksCorrect: "2", questionLimit: 30 },
    questions, allScores: [],
  });
}

function sitting(number, entry, otherTimeMs = 10000) {
  return attempt(number, [entry, question(`baseline-${number}`, 0, otherTimeMs)]);
}

function report(attempts) {
  return generateMockHistoryTxt("Practice", "JK", attempts);
}

function details(text) {
  return text.slice(text.indexOf("1. Active accuracy weaknesses ("));
}

function section(text, number) {
  const titles = ["Active accuracy weaknesses", "Read-and-skipped questions", "Slow correct questions", "Retired weaknesses"];
  const start = text.indexOf(`${number}. ${titles[number - 1]} (`);
  const end = number < 4 ? text.indexOf(`${number + 1}. ${titles[number]} (`, start) : text.length;
  return text.slice(start, end);
}

test("repeated IDs group once despite shuffled positions and options, retaining improvement logs", () => {
  const first = question("shared", 1, 12000, { position: 7 });
  const second = question("shared", 3, 10000, { position: 21, options: ["Mistake shared", "Unused choice shared", "Other distractor shared", "Correct shared"], correctIndex: 3 });
  const third = question("shared", 0, 9000);
  const attempts = [sitting(1, first), sitting(2, second), sitting(3, third)];
  const before = structuredClone(attempts);
  const text = report(attempts);
  const body = details(text);
  assert.equal(body.split("Question: Content for shared").length - 1, 1);
  assert.equal(body.split("Correct option: Correct shared").length - 1, 1);
  assert.match(section(text, 4), /Content for shared/);
  assert.match(body, /Attempt 1 .*WRONG \| 12s \| 1\.09x answered average 11s \| Selected wrong option: Mistake shared/);
  assert.match(body, /Attempt 2 .*CORRECT \| 10s/);
  assert.match(body, /Attempt 3 .*CORRECT \| 9s/);
  assert.ok(body.indexOf("Attempt 1 |") < body.indexOf("Attempt 2 |"));
  assert.ok(body.indexOf("Attempt 2 |") < body.indexOf("Attempt 3 |"));
  assert.doesNotMatch(body, /Unused choice|Other distractor|Saved version/);
  assert.deepEqual(attempts, before);
});

test("matching wording never merges distinct question IDs", () => {
  const text = report([attempt(1, [question("first-id", 1, 10000, { questionText: "Same wording" }), question("second-id", 1, 10000, { questionText: "Same wording" })])]);
  assert.equal(details(text).split("Question: Same wording").length - 1, 2);
  assert.match(text, /1\. Active accuracy weaknesses \(2\)/);
});

test("skip thresholds are count-only below five seconds and do not inflate answered pace", () => {
  const unvisited = question("unvisited", null, 20000);
  unvisited.answer.visited = false;
  const result = attempt(1, [
    unvisited,
    question("under-three", null, 2999),
    question("at-three", null, 3000),
    question("under-five", null, 4999),
    question("at-five", null, 5000),
    question("wrong", 1, 10000), question("right", 0, 10000),
  ]);
  assert.equal(result.avgTimeMsPerAttempted, 10000);
  const text = report([result]);
  assert.match(text, /Answered average: 10s/);
  assert.match(text, /Unreached or skipped under 3s: 2 questions/);
  assert.match(text, /Skipped 3s to under 5s: 2 questions/);
  for (const id of ["unvisited", "under-three", "at-three", "under-five"]) assert.ok(!text.includes(`Content for ${id}`));
  assert.match(section(text, 2), /Content for at-five/);
  assert.match(section(text, 2), /SKIPPED \| 5s \| 0\.50x answered average 10s/);
  assert.match(section(text, 2), /Correct option: Correct at-five/);
  assert.doesNotMatch(section(text, 2), /Selected wrong option|Mistake at-five|Unused choice/);
});

test("legacy visits are inferred from recorded time and all-skipped attempts have no pace ratio", () => {
  const read = question("legacy-read", null, 5000);
  delete read.answer.visited;
  const result = attempt(1, [read, question("not-read", null, 0)]);
  assert.equal(result.avgTimeMsPerAttempted, 0);
  const text = report([result]);
  assert.match(details(text), /Content for legacy-read/);
  assert.match(details(text), /SKIPPED \| 5s \| pace N\/A/);
  assert.doesNotMatch(text, /NaN|Infinity|undefined|Content for not-read/);
});

test("25 attempts retain every summary but only the latest ten question logs", () => {
  const attempts = Array.from({ length: 25 }, (_, index) => {
    const questions = [question("repeated", 1, 10000)];
    if (index === 0) questions.push(question("old-only", 1, 10000));
    return attempt(index + 1, questions);
  });
  const text = report(attempts);
  const body = details(text);
  const summary = text.slice(text.indexOf("ALL ATTEMPT SUMMARIES"), text.indexOf("1. Active accuracy weaknesses ("));
  assert.equal(summary.match(/^Attempt \d+ \|/gm).length, 25);
  assert.equal(body.match(/^Attempt \d+ \|/gm).length, 10);
  assert.match(text, /Question-level logs: attempts 16-25 only/);
  assert.match(body, /Attempt 16 \|/);
  assert.match(body, /Attempt 25 \|/);
  assert.doesNotMatch(body, /Attempt (?:[1-9]|1[0-5]) \||Content for old-only/);
  assert.equal(body.split("Question: Content for repeated").length - 1, 1);
});

for (const [name, encounters, expectedSection] of [
  ["latest wrong", [[0, 10000], [1, 10000]], 1],
  ["two recent errors despite one correction", [[1, 10000], [1, 10000], [0, 10000]], 1],
  ["latest read and skipped", [[0, 10000], [null, 5000]], 2],
  ["latest slow and correct", [[1, 10000], [0, 30000]], 3],
  ["two latest correct at or below average", [[1, 10000], [0, 10000], [0, 9000]], 4],
]) test(`category: ${name}`, () => {
  const text = report(encounters.map(([selected, time], index) => sitting(index + 1, question("target", selected, time))));
  for (let number = 1; number <= 4; number++) {
    assert.equal(section(text, number).includes("Question: Content for target"), number === expectedSection);
  }
  assert.equal(details(text).match(/^Attempt \d+ \|/gm).length, encounters.length);
});

test("slow boundary is inclusive and one normal correction is not marked retired or mastered", () => {
  const boundary = report([sitting(1, question("at-threshold", 0, 15000), 5000)]);
  assert.match(section(boundary, 3), /Content for at-threshold/);
  assert.match(section(boundary, 3), /1\.50x answered average 10s/);
  const below = report([sitting(1, question("below-threshold", 0, 14999), 5001)]);
  assert.doesNotMatch(details(below), /Content for below-threshold/);
  assert.match(below, /Mastered questions \(text omitted\): 2 unique questions/);
  const correctedOnce = report([sitting(1, question("one-correction", 1, 10000)), sitting(2, question("one-correction", 0, 10000))]);
  assert.doesNotMatch(details(correctedOnce), /Content for one-correction/);
  assert.match(correctedOnce, /Other recent questions outside these categories \(text omitted, not labelled mastered\): 1/);
});

test("not drawing a question again does not retire its latest mistake", () => {
  const text = report([sitting(1, question("not-repeated", 1, 10000)), attempt(2, [question("new-question", 0, 10000)])]);
  assert.match(section(text, 1), /Content for not-repeated/);
  assert.doesNotMatch(section(text, 4), /Content for not-repeated/);
});

test("old errors can support retirement without leaking question logs outside the window", () => {
  const attempts = Array.from({ length: 25 }, (_, index) => {
    const number = index + 1;
    return sitting(number, question(number === 1 || number >= 24 ? "old-error" : `other-${number}`, number === 1 ? 1 : 0, 10000));
  });
  const text = report(attempts);
  const retired = section(text, 4);
  assert.match(retired, /Content for old-error/);
  assert.match(retired, /Wrong responses before the detail window: 1/);
  assert.equal(retired.match(/^Attempt \d+ \|/gm).length, 2);
  assert.match(retired, /Attempt 24 \|/);
  assert.match(retired, /Attempt 25 \|/);
});

test("saved content variants keep their own answer text under the same question identity", () => {
  const first = question("revised", 1, 10000, { questionText: "Earlier wording" });
  const second = question("revised", 1, 10000, { questionText: "Later wording", options: ["Later correct", "Later wrong", "Unchosen 1", "Unchosen 2"] });
  const text = report([sitting(1, first), sitting(2, second)]);
  assert.match(text, /1\. Active accuracy weaknesses \(1\)/);
  assert.match(details(text), /Saved version 1:\nQuestion: Earlier wording\nCorrect option: Correct revised/);
  assert.match(details(text), /Saved version 2:\nQuestion: Later wording\nCorrect option: Later correct/);
  assert.match(details(text), /Attempt 1 .*Saved version 1 .*Selected wrong option: Mistake revised/);
  assert.match(details(text), /Attempt 2 .*Saved version 2 .*Selected wrong option: Later wrong/);
  assert.doesNotMatch(details(text), /Unchosen/);
});
