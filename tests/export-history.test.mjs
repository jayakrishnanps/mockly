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
  return text.slice(text.indexOf("QUESTION RECORDS ("));
}

test("all successful answers and their timings remain available without app-made diagnoses", () => {
  const text = report([attempt(1, [
    question("fast", 0, 1000), question("typical", 0, 10000),
    question("slow", 0, 30000), question("zero", 0, 0),
  ])]);
  const body = details(text);
  assert.match(body, /QUESTION RECORDS \(4 unique questions\)/);
  for (const id of ["fast", "typical", "slow", "zero"]) {
    assert.ok(body.includes(`Question: Content for ${id}`));
    assert.ok(body.includes(`Correct option: Correct ${id}`));
  }
  assert.match(body, /CORRECT \| 1s/);
  assert.match(body, /CORRECT \| 30s/);
  assert.doesNotMatch(text, /Active accuracy weaknesses|Read-and-skipped questions|Slow correct questions|Retired weaknesses|Mastered questions|1\.5x/);
  assert.doesNotMatch(body, /Unused choice|Other distractor|Mistake fast/);
});

test("repeated IDs print once despite shuffled positions and options, retaining every chronological outcome", () => {
  const first = question("shared", 1, 12000, { position: 7 });
  const second = question("shared", 3, 10000, { position: 21, options: ["Mistake shared", "Unused choice shared", "Other distractor shared", "Correct shared"], correctIndex: 3 });
  const third = question("shared", 0, 9000);
  const attempts = [sitting(1, first), sitting(2, second), sitting(3, third)];
  const before = structuredClone(attempts);
  const body = details(report(attempts));
  assert.equal(body.split("Question: Content for shared").length - 1, 1);
  assert.equal(body.split("Correct option: Correct shared").length - 1, 1);
  assert.match(body, /Attempt 1 \| WRONG \| 12s \| 1\.09x attempt average \| Selected wrong option: Mistake shared/);
  assert.match(body, /Attempt 2 \| CORRECT \| 10s/);
  assert.match(body, /Attempt 3 \| CORRECT \| 9s/);
  assert.ok(body.indexOf("Attempt 1 |") < body.indexOf("Attempt 2 |"));
  assert.ok(body.indexOf("Attempt 2 |") < body.indexOf("Attempt 3 |"));
  assert.doesNotMatch(body, /Unused choice|Other distractor|Saved version|IST/);
  assert.deepEqual(attempts, before);
});

test("matching wording never merges different saved question IDs", () => {
  const text = report([attempt(1, [question("first", 1, 10000, { questionText: "Same wording" }), question("second", 0, 10000, { questionText: "Same wording" })])]);
  assert.equal(details(text).split("Question: Same wording").length - 1, 2);
  assert.match(text, /QUESTION RECORDS \(2 unique questions\)/);
});

test("skip thresholds remain count-only below five seconds and never inflate answered pace", () => {
  const unvisited = question("unvisited", null, 20000);
  unvisited.answer.visited = false;
  const result = attempt(1, [
    unvisited, question("under-three", null, 2999), question("at-three", null, 3000),
    question("under-five", null, 4999), question("at-five", null, 5000),
    question("wrong", 1, 10000), question("right", 0, 10000),
  ]);
  assert.equal(result.avgTimeMsPerAttempted, 10000);
  const text = report([result]);
  assert.match(text, /Answered average: 10s/);
  assert.match(text, /Unreached or skipped under 3s: 2 questions/);
  assert.match(text, /Skipped 3s to under 5s: 2 questions/);
  for (const id of ["unvisited", "under-three", "at-three", "under-five"]) assert.ok(!text.includes(`Content for ${id}`));
  assert.match(details(text), /SKIPPED \| 5s \| 0\.50x attempt average/);
  assert.match(details(text), /Correct option: Correct at-five/);
  assert.match(details(text), /Question: Content for right/);
});

test("legacy visits use recorded time and all-skipped or zero-time attempts have no pace comparison", () => {
  const read = question("legacy-read", null, 5000);
  delete read.answer.visited;
  const result = attempt(1, [read, question("not-read", null, 0)]);
  assert.equal(result.avgTimeMsPerAttempted, 0);
  const text = report([result]);
  assert.match(details(text), /Content for legacy-read/);
  assert.match(details(text), /SKIPPED \| 5s \| pace N\/A/);
  assert.doesNotMatch(text, /NaN|Infinity|undefined|Content for not-read/);
  assert.match(details(report([attempt(1, [question("zero-correct", 0, 0)])])), /Question: Content for zero-correct/);
});

test("25 attempts retain every summary and every eligible question from the latest ten attempts", () => {
  const attempts = Array.from({ length: 25 }, (_, index) => {
    const questions = [question("repeated-right", 0, 10000), question("repeated-wrong", 1, 10000)];
    if (index === 0) questions.push(question("old-only", 1, 10000));
    return attempt(index + 1, questions);
  });
  const text = report(attempts);
  const body = details(text);
  const summary = text.slice(text.indexOf("ALL ATTEMPT SUMMARIES"), text.indexOf("QUESTION RECORDS ("));
  assert.equal(summary.match(/^Attempt \d+ \|/gm).length, 25);
  assert.equal(body.match(/^Attempt \d+ \|/gm).length, 20);
  assert.match(text, /Question-level logs: attempts 16-25 only/);
  assert.match(text, /Questions seen only before the detail window \(text omitted\): 1/);
  assert.match(body, /Attempt 16 \|/);
  assert.match(body, /Attempt 25 \|/);
  assert.doesNotMatch(body, /Attempt (?:[1-9]|1[0-5]) \||Content for old-only/);
  assert.equal(body.split("Question: Content for repeated-right").length - 1, 1);
  assert.equal(body.split("Question: Content for repeated-wrong").length - 1, 1);
  assert.match(body, /Before detail window: 15 correct, 0 wrong, 0 read-and-skipped/);
  assert.match(body, /Before detail window: 0 correct, 15 wrong, 0 read-and-skipped/);
});

for (const [name, encounters] of [
  ["always fast and correct", [[0, 1000], [0, 1000]]],
  ["one mistake followed by one correction", [[1, 10000], [0, 10000]]],
  ["repeated mistakes followed by corrections", [[1, 10000], [1, 10000], [0, 10000], [0, 9000]]],
  ["correct speed improving", [[0, 30000], [0, 20000], [0, 10000]]],
  ["one meaningful skip followed by success", [[null, 5000], [0, 10000]]],
]) test(`neutral evidence keeps all encounters: ${name}`, () => {
  const text = report(encounters.map(([selected, time], index) => sitting(index + 1, question("target", selected, time))));
  assert.equal(details(text).split("Question: Content for target").length - 1, 1);
  for (const [index, [selected, time]] of encounters.entries()) {
    const outcome = selected === null ? "SKIPPED" : selected === 0 ? "CORRECT" : "WRONG";
    assert.ok(details(text).includes(`Attempt ${index + 1} | ${outcome} | ${time / 1000}s`));
  }
});

test("a mistake is retained even when later attempts draw entirely different questions", () => {
  const text = report([sitting(1, question("not-repeated", 1, 10000)), attempt(2, [question("new-question", 0, 10000)])]);
  assert.match(details(text), /Content for not-repeated/);
  assert.match(details(text), /Content for new-question/);
});

test("before-window counts retain successes, errors and meaningful skips without old timing logs", () => {
  const attempts = Array.from({ length: 25 }, (_, index) => {
    const number = index + 1;
    const selected = number === 1 ? 1 : number === 2 ? null : 0;
    return sitting(number, question(number <= 3 || number >= 24 ? "old-record" : `other-${number}`, selected, selected === null ? 5000 : 10000));
  });
  const body = details(report(attempts));
  assert.match(body, /Before detail window: 1 correct, 1 wrong, 1 read-and-skipped/);
  assert.match(body, /Attempt 24 \|/);
  assert.match(body, /Attempt 25 \|/);
  assert.doesNotMatch(body, /Attempt [123] \|/);
});

test("saved content changes keep their own answer text under the original question identity", () => {
  const first = question("revised", 1, 10000, { questionText: "Earlier wording" });
  const second = question("revised", 1, 10000, { questionText: "Later wording", options: ["Later correct", "Later wrong", "Unchosen 1", "Unchosen 2"] });
  const body = details(report([sitting(1, first), sitting(2, second)]));
  assert.match(body, /Saved version 1:\nQuestion: Earlier wording\nCorrect option: Correct revised/);
  assert.match(body, /Saved version 2:\nQuestion: Later wording\nCorrect option: Later correct/);
  assert.match(body, /Attempt 1 \| Saved version 1 \| WRONG .*Selected wrong option: Mistake revised/);
  assert.match(body, /Attempt 2 \| Saved version 2 \| WRONG .*Selected wrong option: Later wrong/);
  assert.doesNotMatch(body, /Unchosen/);
});

test("label-dependent answers retain the original options so their meaning is not lost", () => {
  for (const dependent of ["Both A and B", "All of the above", "None of the above", "The first option", "Only (B)"]) {
    const entry = question("context", 3, 10000, { questionText: "Choose a true statement.", options: ["First fact", "Second fact", "Third fact", dependent], correctIndex: 3 });
    const body = details(report([attempt(1, [entry])]));
    assert.ok(body.includes(`Correct option: ${dependent}`));
    assert.match(body, /Options \(needed for context\):\nA\) First fact\nB\) Second fact\nC\) Third fact\nD\)/);
  }
});

test("comparisons keep candidate choices once even when option order changes", () => {
  const first = question("largest", 0, 12000, { questionText: "Which of the following fractions is largest?", options: ["1/2", "1/3", "1/4", "1/5"] });
  const second = question("largest", 3, 8000, { questionText: first.questionText, options: ["1/5", "1/4", "1/3", "1/2"], correctIndex: 3 });
  const body = details(report([attempt(1, [first]), attempt(2, [second])]));
  assert.equal(body.split(`Question: ${first.questionText}`).length - 1, 1);
  assert.equal(body.split("Options (needed for context):").length - 1, 1);
  for (const fraction of ["1/2", "1/3", "1/4", "1/5"]) assert.ok(body.includes(`- ${fraction}`));
  assert.doesNotMatch(body, /Saved version/);
});

test("changed contextual options are recorded as changed content, even if the correct answer is unchanged", () => {
  const first = question("context-change", 0, 10000, { questionText: "Which of these is largest?", options: ["10", "1", "2", "3"] });
  const second = question("context-change", 0, 10000, { questionText: first.questionText, options: ["10", "7", "8", "9"] });
  const body = details(report([attempt(1, [first]), attempt(2, [second])]));
  assert.match(body, /Saved version 1:/);
  assert.match(body, /Saved version 2:/);
  assert.match(body, /- 1\n- 10\n- 2\n- 3/);
  assert.match(body, /- 10\n- 7\n- 8\n- 9/);
});

test("Roman-statement choices stay compact when the statement text supplies their context", () => {
  const stem = "Statement I: First statement.\nStatement II: Second statement.\nWhich statements are true?";
  const entry = question("statements", 2, 10000, { questionText: stem, options: ["Only I", "Only II", "Both I and II", "Neither I nor II"], correctIndex: 2 });
  const body = details(report([attempt(1, [entry])]));
  assert.ok(body.includes(`Question: ${stem}`));
  assert.match(body, /Correct option: Both I and II/);
  assert.doesNotMatch(body, /Options \(needed for context\)/);
});

test("large histories stay compact through identity grouping and the time window, never outcome filtering", () => {
  const attempts = Array.from({ length: 25 }, (_, index) => attempt(index + 1,
    Array.from({ length: 50 }, (_, item) => question(`q-${item}`, item === index % 50 ? 1 : 0, 1000 + item * 100))
  ));
  const body = details(report(attempts));
  assert.match(body, /QUESTION RECORDS \(50 unique questions\)/);
  assert.equal(body.match(/^Question: /gm).length, 50);
  assert.equal(body.match(/^Attempt \d+ \|/gm).length, 500);
  assert.doesNotMatch(body, /Unused choice|Other distractor/);
});
